alter table mt.leave_requests add column slot boolean not null default false,add column mode text not null default 'off' check(mode in ('all','from','until','range','off')),add column starts time,add column ends time,add column days_notice integer,add column revision integer not null default 1;
alter table mt.leave_requests drop constraint leave_requests_status_check;
alter table mt.leave_requests add check(status in ('approved','pending','counter','replaced','rejected','booked'));
drop index mt.leave_active;
create unique index leave_open on mt.leave_requests(staff,day) where status in ('pending','counter');
create unique index leave_current on mt.leave_requests(staff,day) where status='approved';
update mt.leave_requests l set days_notice=l.day-(select min(a.at) at time zone 'Europe/Amsterdam' from mt.audit a where a.shift_id=l.id::text and a.action='leaveRequest')::date;
create function mt.availability_changes(l mt.leave_requests) returns jsonb language sql stable set search_path='' as $$
with bounds as (
 select s.*,greatest(s.starts,l.starts) a,least(s.ends,l.ends) b from mt.shifts s where s.day=l.day and s.staff=l.staff and s.kind not in ('off','cancelled')
),changes as (
 select id,kind,starts,ends,case when l.mode='off' or starts is null or ends is null or a>=b then null else jsonb_build_array(to_char(a,'HH24:MI'),to_char(b,'HH24:MI')) end times
 from bounds where l.mode='off' or (l.mode<>'all' and (starts is null or ends is null or a<>starts or b<>ends))
)
select coalesce(jsonb_agg(jsonb_build_object('id',id,'before',jsonb_build_array(kind,coalesce(to_char(starts,'HH24:MI'),''),coalesce(to_char(ends,'HH24:MI'),'')),'after',times) order by id),'[]'::jsonb) from changes
$$;
create function mt.enforce_availability() returns trigger language plpgsql set search_path='' as $$
begin
 if new.kind in ('shift','extra','standby') and not exists(select from mt.leave_requests t where t.slot and t.status='booked' and t.id::text=new.id and t.staff=new.staff and t.day=new.day and t.starts=new.starts and t.ends=new.ends) and exists(select from mt.leave_requests l where l.staff=new.staff and l.day=new.day and l.status='approved' and l.mode in ('from','until','range') and (new.starts is null or new.ends is null or new.starts<l.starts or new.ends>l.ends)) then raise exception 'Deze dienst valt buiten de opgegeven beschikbaarheid. Bespreek andere tijden met de medewerker.';end if;
 return new;
end $$;
create trigger enforce_availability before insert or update on mt.shifts for each row execute function mt.enforce_availability();

create or replace function mt.handle_leave(op text,p jsonb) returns void language plpgsql set search_path='' as $$
declare slot_request boolean:=coalesce((p->>'proposeShift')::boolean,false);owner_id uuid:=auth.uid(); l mt.leave_requests; old_value jsonb; who uuid:=auth.uid(); d date; days integer; proposed text:=coalesce(p->>'mode','off'); a time;b time; direct boolean; c jsonb; changes jsonb; s mt.shifts; previous mt.shifts; note text:=trim(coalesce(p->>'reason','')); alternative boolean:=coalesce((p->>'alternative')::boolean,false);
begin
 if length(note)>1000 then raise exception 'Toelichting is te lang.';end if;
 if op='leaveRequest' or alternative then
   if proposed not in ('all','from','until','range','off') then raise exception 'Onbekende keuze.';end if;
   if proposed in ('from','range') then a:=mt.wall_time(p->>'start');if a is null then raise exception 'Begintijd ontbreekt.';end if;end if;
   if proposed in ('until','range') then b:=mt.wall_time(p->>'end');if b is null then raise exception 'Eindtijd ontbreekt.';end if;end if;
   if a>=b then raise exception 'Controleer de tijden.';end if;
 end if;
 if op='leaveRequest' then
   d:=(p->>'date')::date;days:=d-(now() at time zone 'Europe/Amsterdam')::date;
   if days is null or days<0 then raise exception 'Kies vandaag of een toekomstige datum.';end if;
   perform mt.require_open(d);
   if slot_request then
     owner_id:=(p->>'user')::uuid;
     if owner_id=who or not mt.can_review(d) or proposed<>'range' or not exists(select from mt.people where id=owner_id and active) then raise exception 'Geen dagrechten of ongeldige medewerker.';end if;
     if exists(select from mt.shifts where staff=owner_id and day=d and kind='off') then raise exception 'Open de vrijmelding om werktijden voor te stellen.';end if;
   end if;
   if exists(select from mt.leave_requests where staff=owner_id and day=d and status in ('pending','counter')) then raise exception 'Er staat al een aanvraag open.';end if;
   direct:=not slot_request and days>=21 and proposed<>'off' and not exists(select from mt.shifts where staff=owner_id and day=d and kind<>'cancelled');
   if direct then update mt.leave_requests set status='replaced' where staff=owner_id and day=d and status='approved';end if;
   insert into mt.leave_requests(staff,day,status,reason,mode,starts,ends,days_notice,slot) values(owner_id,d,case when slot_request then 'counter' when direct then 'approved' else 'pending' end,note,proposed,a,b,days,slot_request) returning * into l;
 else
   select * into l from mt.leave_requests where id=(p->>'id')::uuid and status in ('pending','counter') for update;
   if not found or l.revision<>coalesce((p->>'revision')::integer,1) then raise exception 'Deze aanvraag is gewijzigd. Open de nieuwste versie.';end if;
   if l.status='counter' then
     if l.staff<>who or alternative then raise exception 'De medewerker moet antwoorden.';end if;
   elsif not exists(select from mt.people where id=who and active and role='admin') then raise exception 'Alleen voor de bedrijfsleider.';end if;
   perform mt.require_open(l.day);old_value:=to_jsonb(l);
   if op='leaveReject' then
     if note='' then raise exception 'Geef een reden.';end if;
     update mt.leave_requests set status='rejected',response=note,revision=revision+1 where id=l.id returning * into l;
   elsif alternative then
     update mt.leave_requests set status='counter',mode=proposed,starts=a,ends=b,response=note,revision=revision+1 where id=l.id returning * into l;
   elsif l.slot then
     update mt.leave_requests set status='booked',revision=revision+1 where id=l.id returning * into l;
     perform mt.save_plan(jsonb_build_object('id',l.id,'user',l.staff,'date',l.day,'kind','shift','start',to_char(l.starts,'HH24:MI'),'end',to_char(l.ends,'HH24:MI')));
   else
     changes:=mt.availability_changes(l);
     if jsonb_array_length(changes)<>jsonb_array_length(coalesce(p->'changes','[]')) or not (changes @> coalesce(p->'changes','[]')) then raise exception 'Het rooster is gewijzigd. Controleer de dienst opnieuw.';end if;
     update mt.leave_requests set status='replaced' where staff=l.staff and day=l.day and status='approved';
     if l.mode<>'off' then update mt.shifts set kind='cancelled' where staff=l.staff and day=l.day and kind='off';end if;
     for c in select value from jsonb_array_elements(changes) loop
       select * into previous from mt.shifts where id=c->>'id';
       if exists(select from mt.entries where shift_id=previous.id) then raise exception 'Bij deze dienst zijn al uren ingediend.';end if;
       if c->'after'='null'::jsonb then update mt.shifts set kind='cancelled' where id=previous.id returning * into s;
       else update mt.shifts set starts=(c#>>'{after,0}')::time,ends=(c#>>'{after,1}')::time where id=previous.id returning * into s;end if;
       perform mt.log_change(case when s.kind='cancelled' then 'cancel' else 'plan' end,s.id,to_jsonb(previous),to_jsonb(s)||jsonb_build_object('reason','Beschikbaarheid goedgekeurd'));
     end loop;
     if l.mode='off' and not exists(select from mt.shifts where staff=l.staff and day=l.day and kind='off') then perform mt.save_plan(jsonb_build_object('id',l.id,'user',l.staff,'date',l.day,'kind','off'));end if;
     update mt.leave_requests set status='approved',revision=revision+1 where id=l.id returning * into l;
   end if;
 end if;
 perform mt.log_change(op,l.id::text,old_value,to_jsonb(l));
end $$;
revoke all on function mt.availability_changes(mt.leave_requests),mt.enforce_availability() from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.mt_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare notes jsonb; caller mt.people; result jsonb;
begin
  select * into caller from mt.people where id=auth.uid() and active;
  if not found then raise exception 'Geen actief account.' using errcode='42501'; end if;
  with visible as materialized (
    select s.staff,s.day,s.starts,s.id,s as original from mt.shifts s where s.staff=caller.id or mt.can_review(s.day)
  )
  select jsonb_build_object('me',caller.id,
     'people',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'role',p.role,
        'contract',case when p.id=caller.id or caller.role='admin' then p.contract end,
        'active',p.active) order by p.name,p.id)
       from mt.people p where p.id=caller.id or caller.role='admin' or exists(select from visible v where v.staff=p.id)
       or exists(select from mt.working_leads l join visible v on l.day=v.day where l.staff=p.id)),'[]'::jsonb),
     'rosterPeople',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name,p.id)
       from mt.people p where p.active and (caller.role='admin' or (caller.role='lead' and exists(
          select from mt.working_leads l left join mt.periods m on m.month=to_char(l.day,'YYYY-MM')
          where l.staff=caller.id and not coalesce(m.closed,false))))),'[]'::jsonb),
     'shifts',coalesce((select jsonb_agg(mt.shift_json(v.original) order by v.day,v.starts,v.id) from visible v),'[]'::jsonb),
     'leads',coalesce((select jsonb_object_agg(g.day,g.staff) from (select l.day,jsonb_agg(l.staff order by l.staff) staff from mt.working_leads l where exists(select from visible v where v.day=l.day) group by l.day) g),'{}'::jsonb),
     'closed',coalesce((select jsonb_agg(month order by month) from mt.periods where closed),'[]'::jsonb),
     'periodVersions',coalesce((select jsonb_object_agg(month,revision) from mt.periods),'{}'::jsonb),
     'norms',coalesce((select jsonb_object_agg(n.month||':'||n.staff,jsonb_build_object('norm',n.norm,'paid',n.paid))
       from mt.norms n where caller.role='admin' or n.staff=caller.id),'{}'::jsonb),
     'contracts',coalesce((select jsonb_agg(jsonb_build_object('user',c.staff,'effective',c.effective,'contract',c.contract,'weeklyMinutes',c.weekly_minutes) order by c.effective)
       from mt.contracts c where caller.role='admin' or c.staff=caller.id),'[]'::jsonb)) into result;

 select coalesce(jsonb_agg(n order by seq desc),'[]') into notes from (
 select a.seq,jsonb_build_object('key',a.seq::text,'id',s.id,'at',a.at,'actor',a.actor,'actorName',(select name from mt.people where id=a.actor),'action',a.action,
 'text',coalesce(a.after_value->>'message',a.after_value->>'reason',a.after_value#>>'{entry,reason}',''),
 'seen',exists(select from mt.seen r where r.staff=auth.uid() and r.key=a.seq::text)) n
 from mt.audit a join mt.shifts s on s.id=a.shift_id
 where a.actor<>auth.uid() and (s.staff=auth.uid() or mt.can_review(s.day))
 and a.action in ('return','reject','cancel','plan','restore','message','submit')
 order by a.seq desc limit 100) q;
 result:=result||jsonb_build_object('acceptedSlots',coalesce((select jsonb_object_agg(s.id,a.after_value->>'off') from mt.audit a join mt.shifts s on s.id=a.shift_id where a.action='acceptedSlot' and s.kind in ('shift','extra','office') and (s.staff=caller.id or mt.can_review(s.day))),'{}'::jsonb),'offers',coalesce((select jsonb_object_agg(s.id,x.after_value) from mt.shifts s cross join lateral (select after_value from mt.audit where shift_id=s.id and (after_value ? 'offer' or after_value ? 'decision') order by seq desc limit 1) x where s.kind='off' and (s.staff=caller.id or mt.can_review(s.day))),'{}'::jsonb));
 return result||jsonb_build_object('notifications',notes,'leave',coalesce((select jsonb_agg(jsonb_build_object('id',id,'user',staff,'date',day,'status',status,'reason',reason,'response',response,'slot',slot,'mode',mode,'start',coalesce(to_char(starts,'HH24:MI'),''),'end',coalesce(to_char(ends,'HH24:MI'),''),'days',days_notice,'revision',revision,'seen',exists(select from mt.seen z where z.staff=caller.id and z.key='availability:'||id||':'||revision))) from mt.leave_requests where staff=caller.id or caller.role='admin' or (status='approved' and mt.can_review(day))),'[]'::jsonb));
end $function$;
