create unique index once_missing on mt.notifications(recipient,id) where event='missing';
create function mt.sync_missing() returns void language plpgsql set search_path='' as $$
begin
 update mt.notifications n set resolved=true where event='missing' and not resolved and not exists(select from mt.shifts s where s.id=n.id and (mt.shift_json(s)->>'missing')::boolean);
 insert into mt.notifications(recipient,id,day,event,actor,at,title,body,category,topic)
 select p.id,s.id,s.day,'missing',s.staff,clock_timestamp(),'Uren ontbreken',to_char(s.starts,'HH24:MI')||' – '||to_char(s.ends,'HH24:MI'),'action','missing' from mt.shifts s join mt.people p on p.active and (p.id=s.staff or p.role='admin' or exists(select from mt.working_leads w where w.day=s.day and w.staff=p.id)) where (mt.shift_json(s)->>'missing')::boolean
 on conflict(recipient,id) where event='missing' do update set resolved=false where mt.notifications.resolved;
end $$;
revoke all on function mt.sync_missing() from public,anon,authenticated;
alter table mt.leave_periods rename to time_off_requests;
alter table mt.time_off_requests add column weekday int not null default 0 check(weekday between 0 and 7), add column spec jsonb not null default '{"mode":"off"}';
create view mt.leave_periods as select * from mt.time_off_requests;
revoke all on mt.leave_periods from public,anon,authenticated;
create or replace function mt.change_availability(op text,p jsonb) returns void language plpgsql set search_path='' as $$
declare who uuid:=auth.uid();d date:=(p->>'date')::date;e date:=coalesce((p->>'through')::date,d); wd int:=coalesce((p->>'weekday')::int,0);m text:=p->>'mode';a time;b time;day_i date;l mt.leave_periods;affected jsonb;s mt.shifts;slot_record mt.leave_requests;
begin
 if op in ('availabilityClear','weeklyRequest','availabilitySave','periodRequest') and (d is null or d<(now() at time zone 'Europe/Amsterdam')::date or e<d) then raise exception 'Controleer de periode.';end if;
 if op='availabilityClear' then
 delete from mt.availability_rules where staff=who and day=d and weekday=0;
 perform mt.log_change('availabilityChange',gen_random_uuid()::text,null,jsonb_build_object('date',d,'user',who,'message','Terug naar vaste week'));return;
 elsif op='weeklyRequest' then
 if wd not between 1 and 7 or m not in ('off','all','from','until','range') or m is null then raise exception 'Controleer de vaste week.';end if;
 if m in ('from','range') then a:=mt.wall_time(p->>'start');if a is null then raise exception 'Begintijd ontbreekt.';end if;end if;
 if m in ('until','range') then b:=mt.wall_time(p->>'end');if b is null then raise exception 'Eindtijd ontbreekt.';end if;end if;
 if a>=b or exists(select from mt.time_off_requests where staff=who and weekday=wd and status='pending') then raise exception 'Controleer de tijden en open aanvragen.';end if;
 insert into mt.leave_periods(staff,first_day,last_day,weekday,spec,reason,days) values(who,d,d,wd,jsonb_build_object('mode',m,'start',coalesce(to_char(a,'HH24:MI'),''),'end',coalesce(to_char(b,'HH24:MI'),'')),p->>'reason',d-(now() at time zone 'Europe/Amsterdam')::date) returning * into l;
 perform mt.log_change('leaveRequest',l.id::text,null,to_jsonb(l));return;
 end if;
 if op='slotCounter' then
 a:=mt.wall_time(p->>'start');b:=mt.wall_time(p->>'end');if a is null or b is null or b<=a then raise exception 'Controleer de tijden.';end if;
 update mt.leave_requests set status='pending',revision=revision+1,starts=a,ends=b,response=p->>'reason' where id=(p->>'id')::uuid and staff=who and slot and status='counter' and revision=(p->>'revision')::int returning * into strict slot_record;
 perform mt.log_change('leaveApprove',slot_record.id::text,null,to_jsonb(slot_record));
 elsif op='availabilitySave' then
 if wd<>0 or m='off' or e-d>=31 then raise exception 'Een vaste week of vrije dag vereist een aanvraag. Kies maximaal 31 dagen per uitzondering.';end if;
 if m in ('from','range') then a:=mt.wall_time(p->>'start');if a is null then raise exception 'Begintijd ontbreekt.';end if;end if;
 if m in ('until','range') then b:=mt.wall_time(p->>'end');if b is null then raise exception 'Eindtijd ontbreekt.';end if;end if;
 if b<=a then raise exception 'Controleer de tijden.';end if;
 insert into mt.availability_rules select who,d+i,wd,m,a,b,p->>'reason' from generate_series(0,case when wd=0 then e-d else 0 end)i on conflict (staff,day,weekday) do update set mode=excluded.mode,starts=excluded.starts,ends=excluded.ends,reason=excluded.reason;
 perform mt.log_change('availabilityChange',gen_random_uuid()::text,null,jsonb_build_object('date',d,'user',who,'message','Beschikbaarheid gewijzigd'));
 elsif op='periodRequest' then
 if exists(select from mt.leave_requests where staff=who and mode='off' and status in ('pending','approved') and day between d and e) or exists(select from mt.leave_periods where staff=who and weekday=0 and status in ('pending','approved') and first_day<=e and last_day>=d) then raise exception 'Deze periode overlapt een vrijaanvraag.';end if;
 insert into mt.leave_periods(staff,first_day,last_day,days,reason) values(who,d,e,d-(now() at time zone 'Europe/Amsterdam')::date,p->>'reason') returning * into l;
 perform mt.log_change('leaveRequest',l.id::text,null,to_jsonb(l));
 else
 if not exists(select from mt.people where id=who and active and role='admin') then raise exception 'Alleen voor de bedrijfsleider.';end if;
 select * into strict l from mt.leave_periods where id=(p->>'id')::uuid and status='pending' for update;
 if op='periodExpire' then
 if l.weekday<>0 or l.last_day>=(now() at time zone 'Europe/Amsterdam')::date then raise exception 'Deze aanvraag is nog niet verstreken.';end if;
 update mt.leave_periods set status='expired' where id=l.id returning * into l;
 perform mt.log_change('leaveReject',l.id::text,null,to_jsonb(l));return;
 elsif op='periodApprove' and l.weekday>0 then
 if l.spec->>'mode'='off' and exists(select from mt.shifts where staff=l.staff and day>=l.first_day and extract(isodow from day)=l.weekday and kind not in ('off','cancelled')) then raise exception 'Pas eerst de geplande diensten op deze weekdag aan.';end if;
 insert into mt.availability_rules values(l.staff,l.first_day,l.weekday,l.spec->>'mode',nullif(l.spec->>'start','')::time,nullif(l.spec->>'end','')::time,l.reason) on conflict(staff,day,weekday) do update set mode=excluded.mode,starts=excluded.starts,ends=excluded.ends,reason=excluded.reason;
 elsif op='periodApprove' then
 select coalesce(jsonb_agg(jsonb_build_array(id,coalesce(to_char(starts,'HH24:MI'),''),coalesce(to_char(ends,'HH24:MI'),'')) order by id),'[]') into affected from mt.shifts where staff=l.staff and day between l.first_day and l.last_day and kind not in ('off','cancelled');
 if affected is distinct from p->'changes' then raise exception 'Controleer de geplande diensten opnieuw.';end if;
 for day_i in select l.first_day+i from generate_series(0,l.last_day-l.first_day)i loop
 perform mt.require_open(day_i);
 for s in select * from mt.shifts where staff=l.staff and day=day_i and kind not in ('off','cancelled') loop
 if (mt.shift_json(s)->'entry') is distinct from 'null'::jsonb and mt.shift_json(s)->'entry' is not null then raise exception 'Er zijn al uren ingediend.';end if;
 perform public.mt_act('cancel',jsonb_build_object('id',s.id,'reason','Vrijaanvraag goedgekeurd'));end loop;
 if not exists(select from mt.shifts where staff=l.staff and day=day_i and kind='off') then insert into mt.shifts(id,staff,day,kind) values(l.id::text||'-'||day_i,l.staff,day_i,'off');end if;
 end loop;
 elsif trim(coalesce(p->>'reason',''))='' then raise exception 'Geef een reden.';end if;
 update mt.leave_periods set status=case when op='periodApprove' then 'approved' else 'rejected' end,response=p->>'reason' where id=l.id returning * into l;
 perform mt.log_change(case when op='periodApprove' then 'leaveApprove' else 'leaveReject' end,l.id::text,null,to_jsonb(l));
 end if;end $$;
create or replace function mt.enforce_availability() returns trigger language plpgsql set search_path='' as $$
declare r mt.availability_rules;
begin
 if new.kind not in ('shift','extra','standby','office') or exists(select from mt.leave_requests t where t.slot and t.status='booked' and t.id::text=new.id and t.staff=new.staff and t.day=new.day and t.starts=new.starts and t.ends=new.ends) or exists(select from mt.audit where action='acceptedSlot' and shift_id=new.id and after_value->>'start'=to_char(new.starts,'HH24:MI') and after_value->>'end'=to_char(new.ends,'HH24:MI')) then return new;end if;
 if (select mode='off' from mt.availability_rules where staff=new.staff and weekday=extract(isodow from new.day) and day<=new.day order by day desc limit 1) then raise exception 'Deze medewerker heeft een goedgekeurde vaste vrije dag.';end if;
 select * into r from mt.availability_rules where staff=new.staff and ((weekday=0 and day=new.day) or (weekday=extract(isodow from new.day) and day<=new.day)) order by weekday,day desc limit 1;
 if r.mode='off' or coalesce(current_setting('mt.confirm_availability',true),'')<>'yes' and r.mode in ('from','until','range') and (new.starts is null or new.ends is null or new.starts<r.starts or new.ends>r.ends) then raise exception 'Deze dienst valt buiten de beschikbaarheid. Vraag toestemming aan de medewerker.';end if;
 return new;end $$;
create or replace function mt.deliver_event(new mt.audit) returns void language plpgsql set search_path='' as $$
declare owner_id uuid; d date; topic_name text; label text; v jsonb:=new.after_value; a text:=new.action;
begin
 label:='{"submit": "Uren ingediend", "approve": "Uren goedgekeurd", "selfApprove": "Eigen uren goedgekeurd", "return": "Aanpassing gevraagd", "reject": "Uren afgewezen", "extra": "Ongeplande dienst", "plan": "Planning gewijzigd", "cancel": "Dienst vervallen", "restore": "Dienst hersteld", "swap": "Dienst geruild", "replacement": "Vervangende dienst", "call": "Oproep voor dienst", "message": "Bericht", "leaveRequest": "Beschikbaarheid doorgegeven", "leaveApprove": "Reactie op beschikbaarheid", "leaveReject": "Aanvraag afgewezen"}'::jsonb->>a;
 if a='availabilityChange' then
 insert into mt.notifications(recipient,id,day,event,actor,at,title,body,category,topic) select id,new.shift_id,(v->>'date')::date,a,new.actor,new.at,'Beschikbaarheid gewijzigd',v->>'message','info','availability' from mt.people where active and role='admin' and id<>new.actor;return;end if;
 if label is null then return; end if;
 if a like 'leave%' then select staff,day into owner_id,d from mt.leave_requests where id::text=new.shift_id;if owner_id is null then select staff,first_day into owner_id,d from mt.leave_periods where id::text=new.shift_id;end if;topic_name:='leave';
 else select staff,day into owner_id,d from mt.shifts where id=new.shift_id;
 topic_name:=case when a='message' then 'message' when a in ('submit','approve','selfApprove','return','reject','extra') then 'hours' else 'plan' end;end if;
 if owner_id is null then return;end if;
 update mt.notifications set resolved=true where id=new.shift_id and topic=topic_name and category='action' and (topic_name<>'message' or recipient=new.actor or actor=owner_id and new.actor<>owner_id);
 insert into mt.notifications(recipient,id,day,event,actor,at,title,body,category,topic)
 select person,new.shift_id,d,a,new.actor,new.at,label,coalesce(v->>'message',v->>'response',v->>'reason',v#>>'{entry,reason}',''),kind,topic_name from (
 select p.id person,case when p.id=owner_id then case when a='return' or a='message' and not(v ? 'decision') or topic_name='leave' and v->>'status'='counter' then 'action' else 'info' end
 when p.role='admin' then case when topic_name='leave' and v->>'status'='pending' or a='message' and new.actor=owner_id and not(v ? 'decision') or a in ('submit','extra') and not exists(select from mt.working_leads where day=d and staff<>owner_id) then 'action' else 'activity' end
 when topic_name<>'leave' and exists(select from mt.working_leads where day=d and staff=p.id) then case when a in ('submit','extra') or a='message' and new.actor=owner_id then case when v ? 'decision' then 'info' else 'action' end when topic_name='plan' then 'info' end end kind
 from mt.people p where p.active and p.id<>new.actor) recipients where kind is not null;
 return;end $$;
CREATE OR REPLACE FUNCTION public.mt_act(action text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare batch_start bigint;old jsonb; caller mt.people; s mt.shifts; old_shift mt.shifts; person mt.people; new_person mt.people;
  item jsonb; period_key text:=payload->>'month'; period_start date; target_day date; employee uuid; prev jsonb;
  note text:=trim(coalesce(payload->>'reason',payload->>'message','')); rev integer; snapshot jsonb;
  nonce text:=nullif(payload->>'requestId',''); prior mt.requests; effective_day date;
begin
  if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Object met invoervelden verwacht.'; end if;
  -- A small single-venue app: serialise mutating transactions, including cross-row month locks,
  -- overlapping entries on different shifts, permission changes and simultaneous last-admin updates.
  perform pg_advisory_xact_lock(166312,41);
  select * into caller from mt.people where id=auth.uid() and active;
  if not found then raise exception 'Geen actief account.' using errcode='42501'; end if;
  if action='syncMissing' then perform mt.sync_missing();return public.mt_state();end if;
  if action='notifVisit' then
   insert into mt.inbox_visit values(caller.id,coalesce((select max(key) from mt.notifications where recipient=caller.id),0)) on conflict(staff) do update set last_key=excluded.last_key;
   return public.mt_state();
  end if;
  if action in ('notifRead','notifUnread','notifDismiss','notifReadAll','notifDismissRead','notifMore') then
   update mt.notifications set seen=case when action in ('notifRead','notifReadAll') then true when action='notifUnread' then false else seen end,
     dismissed=dismissed or action='notifDismiss' or (action='notifDismissRead' and seen)
     where recipient=caller.id and (action in ('notifReadAll','notifDismissRead') or key::text=payload->>'key' or coalesce(payload->'keys','[]') ? key::text);
   return public.mt_state()||mt.inbox_state(caller.id,greatest(200,coalesce((payload->>'limit')::int,200)));
  end if;
  if action in ('history','audit') then
    select * into s from mt.shifts where id=payload->>'id';
    if not found or not(s.staff=caller.id or mt.can_review(s.day)) then raise exception 'Geen toegang tot deze historie.' using errcode='42501'; end if;
    return (select coalesce(jsonb_agg(jsonb_build_object('actor',actor,'at',at,'action',a.action,'before',before_value,'after',after_value) order by seq),'[]'::jsonb)
      from mt.audit a where a.shift_id=s.id);
  end if;
  if nonce is not null then
    if length(nonce)>120 then raise exception 'Ongeldig aanvraagnummer.'; end if;
    select * into prior from mt.requests r where r.staff=caller.id and r.request_id=nonce;
    if found then
      if prior.action is distinct from action or prior.payload is distinct from payload then raise exception 'Aanvraagnummer is al gebruikt.'; end if;
      return public.mt_state();
    end if;
  end if;
   if action in ('leaveRequest','leaveApprove','leaveReject') then
   perform mt.handle_leave(action,payload);
   if nonce is not null then insert into mt.requests values(caller.id,nonce,action,payload); end if;
   return public.mt_state();
 end if;
 if action in ('periodExpire','availabilityClear','weeklyRequest','slotCounter','availabilitySave','periodRequest','periodApprove','periodReject') then perform mt.change_availability(action,payload);
   if nonce is not null then insert into mt.requests values(caller.id,nonce,action,payload);end if;return public.mt_state();
  elsif action in ('draftSave','draftDrop','draftPublish') then
   if caller.role<>'admin' then raise exception 'Alleen voor de bedrijfsleider.'; end if;
   if action='draftPublish' and payload->>'confirmAvailability'='true' then perform set_config('mt.confirm_availability','yes',true);end if;
   if action='draftPublish' then select coalesce(max(key),0) into batch_start from mt.notifications;end if;
   perform mt.handle_draft(action,payload);
   if action='draftPublish' then
     with grouped as (delete from mt.notifications where key>batch_start and topic='plan' and id like 'excel:%' returning recipient,category)
     insert into mt.notifications(recipient,id,day,event,actor,at,title,body,category,topic)
     select recipient,'rooster',(payload->>'date')::date,'importSummary',caller.id,clock_timestamp(),'Rooster gepubliceerd',count(*)||' roosterwijzigingen',min(category),'import' from grouped group by recipient;
   end if;
   perform set_config('mt.confirm_availability','',true);
   if nonce is not null then insert into mt.requests values(caller.id,nonce,action,payload); end if;
   return public.mt_state();
 end if;
 if action='approveExact' then
   select * into s from mt.shifts where id=payload->>'id' and mt.can_review(day) and staff<>caller.id;
   if not found or not exists(select from mt.entries e where e.shift_id=s.id and
     (e.actual_start at time zone 'Europe/Amsterdam')::time=s.starts and
     (e.actual_end at time zone 'Europe/Amsterdam')::time=s.ends) then raise exception 'De uren wijken af.'; end if;
   perform mt.require_open(s.day);
   perform mt.review(s,'approve',payload);
   if nonce is not null then insert into mt.requests values(caller.id,nonce,action,payload); end if;
   return public.mt_state();
 end if;
 if action in ('offer','acceptOffer','declineOffer','counterOffer','approveCounter','rejectCounter') then
   perform mt.handle_offer(action,payload);
   if nonce is not null then insert into mt.requests values(caller.id,nonce,action,payload); end if;
   return public.mt_state();
 end if;
 if action='seen' then
 insert into mt.seen values(caller.id,payload->>'key') on conflict do nothing;
 return public.mt_state();
 end if;
 if action='extra' then
 if exists(select from mt.shifts x left join mt.entries e on e.shift_id=x.id
 where x.staff=coalesce((payload->>'user')::uuid,caller.id) and x.day=(payload->>'date')::date
 and x.kind in ('shift','office','extra')
 and mt.wall_time(payload->>'start')<coalesce((e.actual_end at time zone 'Europe/Amsterdam')::time,x.ends)
 and mt.wall_time(payload->>'end')>coalesce((e.actual_start at time zone 'Europe/Amsterdam')::time,x.starts)) then
 raise exception 'Je hebt al een overlappende dienst. Pas die registratie aan.';
 end if;
 end if;
 if action in ('message','restore','reject') then
 select * into s from mt.shifts where id=payload->>'id' and (staff=caller.id or mt.can_review(day));
 if not found then raise exception 'Geen toegang tot deze dienst.' using errcode='42501'; end if;
 perform mt.require_open(s.day);
 if note='' or length(note)>1000 then raise exception 'Vul een toelichting van maximaal 1000 tekens in.'; end if;
 if action='message' then
 if nonce is not null then insert into mt.requests values(caller.id,nonce,action,payload); end if;
 perform mt.log_change('message',s.id,null,jsonb_build_object('message',note));
 return public.mt_state();
 end if;
 if not mt.can_review(s.day) or s.staff=caller.id then raise exception 'Geen beoordelingsrechten.' using errcode='42501'; end if;
 if action='reject' then
 select to_jsonb(e) into old from mt.entries e where shift_id=s.id and status='pending' and revision=(payload->>'version')::int;
 if old is null then raise exception 'De registratie is inmiddels gewijzigd.'; end if;
 update mt.entries set status='rejected',reason=note,revision=revision+1,reviewer=caller.id,changed_at=now() where shift_id=s.id;
 elsif action='restore' then
 if s.kind<>'cancelled' and not exists(select from mt.entries where shift_id=s.id and status='rejected') then raise exception 'Deze dienst is al actief.'; end if;
 old:=mt.shift_json(s);
 update mt.shifts set kind=case when kind='cancelled' then 'shift' else kind end where id=s.id;
 update mt.entries set status='pending',revision=revision+1,reason=note,changed_at=now() where shift_id=s.id;

 end if;
 if action<>'cancel' and nonce is not null then insert into mt.requests values(caller.id,nonce,action,payload); end if;
 perform mt.log_change(action,s.id,old,jsonb_build_object('reason',note));
 return public.mt_state();
 end if;

  if action in ('norm','close','reopen','profile') and caller.role<>'admin' then raise exception 'Alleen voor de bedrijfsleider.' using errcode='42501'; end if;
  if action in ('submit','approve','return','cancel','swap','call') then
    select * into s from mt.shifts where id=payload->>'id' and (staff=caller.id or mt.can_review(day));
    if not found then raise exception 'Onbekende of ontoegankelijke dienst.' using errcode='42501'; end if;
    perform mt.require_open(s.day);
    if action in ('cancel','swap','call') and not mt.can_review(s.day) then raise exception 'Geen dagrechten.' using errcode='42501'; end if;
  end if;

  if action='submit' then perform mt.submit(s,payload);
  elsif action in ('approve','return') then perform mt.review(s,action,payload);
  elsif action='plan' then
    if caller.role='admin' and payload->>'confirmAvailability'='true' then perform set_config('mt.confirm_availability','yes',true);end if;
    if caller.role<>'admin' and (jsonb_array_length(payload->'shifts')<>1 or jsonb_array_length(coalesce(payload->'cancelIds','[]'))<>0 or not exists(select from mt.shifts x where x.id=payload#>>'{shifts,0,id}' and x.kind<>'off' and payload#>>'{shifts,0,kind}'<>'off' and mt.can_review(x.day))) then raise exception 'Geen dagrechten.'; end if;
    if jsonb_typeof(payload->'shifts') is distinct from 'array' then raise exception 'Geen roosterregels.'; end if;
    for item in select value from jsonb_array_elements(payload->'shifts') loop perform mt.save_plan(item); end loop;
    for item in select value from jsonb_array_elements(coalesce(payload->'cancelIds','[]')) loop
      select * into s from mt.shifts where id=item#>>'{}';
      if not found then raise exception 'Vervallen regel is niet meer gevonden.'; end if;
      if s.kind<>'cancelled' then perform public.mt_act('cancel',jsonb_build_object('id',s.id,'reason','Verdwenen uit rooster-import')); end if;
    end loop;
  elsif action='extra' then
    target_day:=(payload->>'date')::date;
    employee:=coalesce((payload->>'user')::uuid,caller.id);
    if employee<>caller.id and not mt.can_review(target_day) then raise exception 'Geen dagrechten.' using errcode='42501'; end if;
    if exists(select from mt.shifts where id=payload->>'id') then raise exception 'Deze dienst-ID bestaat al.'; end if;
    perform mt.save_plan(payload||jsonb_build_object('kind','extra','user',employee));
  if payload ? 'pause' then
    select * into s from mt.shifts where id=payload->>'id';
    perform mt.submit(s,jsonb_build_object('start',payload->'start','end',payload->'end','pause',payload->'pause','version',0));
  end if;
  elsif action in ('cancel','swap','call') then
    old_shift:=s;
    if action='call' then
      if s.kind<>'standby' then raise exception 'Alleen een stand-by kan worden opgeroepen.'; end if;
      s.kind:='shift'; s.starts:=mt.wall_time(payload->>'start'); s.ends:=mt.wall_time(payload->>'end');
      perform mt.instant(s.day,s.starts); perform mt.instant(s.day,s.ends);
    elsif action='swap' then
      employee:=(payload->>'user')::uuid;
      if not exists(select from mt.people where id=employee and active) then raise exception 'Kies een actieve invaller.'; end if;
      if s.kind not in ('office','shift','extra') or employee=s.staff then raise exception 'Ongeldige ruil.'; end if;
      if exists(select from mt.entries where shift_id=s.id) then
        -- Preserve the original registration on its author and record a linked replacement duty.
        s.id:=gen_random_uuid()::text; s.staff:=employee;
        insert into mt.shifts select s.*;
        perform mt.log_change('swap',old_shift.id,to_jsonb(old_shift),to_jsonb(s));
        perform mt.log_change('replacement',s.id,to_jsonb(old_shift),to_jsonb(s));
        if nonce is not null then insert into mt.requests values(caller.id,nonce,action,payload); end if;
        return public.mt_state();
      end if;
      s.staff:=employee;
    else
      if exists(select from mt.entries where shift_id=s.id) then raise exception 'Deze dienst heeft al een inzending.'; end if;
      if note='' or length(note)>1000 then raise exception 'Vul een reden in.'; end if;
      s.kind:='cancelled';
    end if;
    update mt.shifts set staff=s.staff,kind=s.kind,starts=s.starts,ends=s.ends where id=s.id;
    perform mt.log_change(action,s.id,to_jsonb(old_shift),to_jsonb(s)||case when action='cancel' then jsonb_build_object('reason',note) else '{}'::jsonb end);
  elsif action in ('norm','close','reopen') then
    if coalesce(period_key,'') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Kies een geldige maand.'; end if;
    period_start:=(period_key||'-01')::date;
    if action<>'reopen' then perform mt.require_open(period_start); end if;
    if action='norm' then
      if note='' or length(note)>300 then raise exception 'Vul een reden in van maximaal 300 tekens.'; end if;
      employee:=(payload->>'user')::uuid;
      select to_jsonb(n) into prev from mt.norms n where staff=employee and month=period_key;
      insert into mt.norms(month,staff,norm,paid,reason) values(period_key,employee,(payload->>'norm')::integer,(payload->>'paid')::integer,note)
        on conflict(month,staff) do update set norm=excluded.norm,paid=excluded.paid,reason=excluded.reason;
    elsif action='close' then
      if exists(select from mt.shifts x left join mt.entries e on e.shift_id=x.id
         where x.day>=period_start and x.day<(period_start+interval '1 month') and x.kind in ('office','shift','extra')
         and e.status is distinct from 'approved') and note='' then raise exception 'Open diensten aanwezig. Handel ze af of verantwoord de uitzondering.'; end if;
      select jsonb_build_object('shifts',coalesce((select jsonb_agg(mt.shift_json(x)) from mt.shifts x where to_char(x.day,'YYYY-MM')=period_key),'[]'::jsonb),
         'norms',coalesce((select jsonb_agg(to_jsonb(n)) from mt.norms n where n.month=period_key),'[]'::jsonb),
         'contracts',coalesce((select jsonb_agg(to_jsonb(c)) from mt.contracts c where c.effective<period_start+interval '1 month'),'[]'::jsonb))
         into snapshot;
      insert into mt.periods values(period_key,true,1) on conflict(month) do update set closed=true,revision=mt.periods.revision+1 returning revision into rev;
      insert into mt.closures(month,revision,closed_by,reason,snapshot) values(period_key,rev,caller.id,note,snapshot);
    else
      if note='' then raise exception 'Geef een reden voor heropening.'; end if;
      update mt.periods set closed=false where month=period_key and closed;
      if not found then raise exception 'Deze maand is al open.'; end if;
    end if;
    perform mt.log_change(action,null,prev,payload-'requestId');
  elsif action='profile' then
    employee:=(payload->>'user')::uuid;
    select * into person from mt.people where id=employee;
    if not found then raise exception 'Medewerker ontbreekt.'; end if;
    new_person:=person;
    new_person.name:=coalesce(payload->>'name',person.name); new_person.role:=coalesce(payload->>'role',person.role);
    new_person.active:=coalesce((payload->>'active')::boolean,person.active);
    new_person.contract:=coalesce(payload->>'contract',person.contract);
    if person.active and person.role='admin' and (not new_person.active or new_person.role<>'admin') and
       not exists(select from mt.people where active and role='admin' and id<>employee) then raise exception 'Er moet een actieve bedrijfsleider blijven.'; end if;
    if new_person.contract<>person.contract or payload ? 'weeklyMinutes' then
      effective_day:=coalesce((payload->>'effective')::date,(now() at time zone 'Europe/Amsterdam')::date);
      if effective_day>(now() at time zone 'Europe/Amsterdam')::date then raise exception 'Gebruik een ingangsdatum op of voor vandaag.'; end if;
      if exists(select from mt.periods where closed and month>=to_char(effective_day,'YYYY-MM')) then raise exception 'Contractwijziging raakt een afgesloten maand.'; end if;
      if exists(select from mt.contracts where staff=employee and effective>effective_day) then raise exception 'Een latere contractafspraak bestaat al.'; end if;
      insert into mt.contracts values(employee,effective_day,new_person.contract,(payload->>'weeklyMinutes')::integer)
        on conflict(staff,effective) do update set contract=excluded.contract,weekly_minutes=excluded.weekly_minutes;
    end if;
    update mt.people set name=new_person.name,role=new_person.role,active=new_person.active,contract=new_person.contract where id=employee;

    perform mt.log_change(action,null,to_jsonb(person),to_jsonb(new_person));
  else raise exception 'Onbekende actie.';
  end if;
  if nonce is not null then insert into mt.requests values(caller.id,nonce,action,payload); end if;
  if not exists(select from mt.people where id=caller.id and active) then return '{}'::jsonb; end if;
  return public.mt_state();
end $function$;



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
 return result||jsonb_build_object('availability',coalesce((select jsonb_agg(jsonb_build_object('user',staff,'date',day,'weekday',weekday,'mode',mode,'start',coalesce(to_char(starts,'HH24:MI'),''),'end',coalesce(to_char(ends,'HH24:MI'),''),'reason',reason)) from mt.availability_rules where staff=caller.id or caller.role='admin'),'[]'::jsonb),'periodLeave',coalesce((select jsonb_agg(jsonb_build_object('user',staff,'id',id,'date',first_day,'through',last_day,'weekday',weekday,'mode',spec->>'mode','start',spec->>'start','end',spec->>'end','status',status,'reason',reason,'response',response,'days',days)) from mt.leave_periods where staff=caller.id or caller.role='admin'),'[]'::jsonb))||mt.inbox_state(caller.id,200)||jsonb_build_object('drafts',case when caller.role='admin' then coalesce((select jsonb_agg(d.row_data||jsonb_build_object('before',d.original,'revision',d.revision)) from mt.roster_drafts d),'[]'::jsonb) else '[]'::jsonb end,'notifications',notes,'leave',coalesce((select jsonb_agg(jsonb_build_object('id',id,'user',staff,'date',day,'status',status,'reason',reason,'response',response,'slot',slot,'mode',mode,'start',coalesce(to_char(starts,'HH24:MI'),''),'end',coalesce(to_char(ends,'HH24:MI'),''),'days',days_notice,'revision',revision,'seen',exists(select from mt.seen z where z.staff=caller.id and z.key='availability:'||id||':'||revision))) from mt.leave_requests where staff=caller.id or caller.role='admin' or (status='approved' and mt.can_review(day))),'[]'::jsonb));
end $function$;

-- Move single-day leave, preserving its identity and notification references.
insert into mt.time_off_requests(id,staff,first_day,last_day,status,reason,response,days)
select id,staff,day,day,status,reason,response,coalesce(days_notice,0) from mt.leave_requests where not slot and mode='off' and status in ('pending','approved','rejected')
on conflict(id) do nothing;
delete from mt.leave_requests l using mt.time_off_requests t where t.id=l.id and not l.slot and l.mode='off' and l.status in ('pending','approved','rejected');

create or replace function public.mt_mail_claim(after_time time) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item record; acquired uuid;
begin
 perform mt.sync_missing();
 for item in
   select c.*,u.email from mt.mail_candidates(clock_timestamp() at time zone 'Europe/Amsterdam',after_time) c
   join auth.users u on u.id=c.staff left join mt.mail_delivery d on d.day=c.day and d.recipient=c.staff and d.kind=c.kind
   where u.email is not null and (d.recipient is null or (d.delivery_state<>'sent' and d.retry_after<=clock_timestamp()))
   order by c.day,c.kind,c.staff
 loop
   insert into mt.mail_delivery as d(day,recipient,kind,lease,retry_after,delivery_state)
   values(item.day,item.staff,item.kind,gen_random_uuid(),clock_timestamp()+interval '5 minutes','sending')
   on conflict(day,recipient,kind) do update set lease=excluded.lease,retry_after=excluded.retry_after,delivery_state='sending',attempts=d.attempts+1
   where d.delivery_state<>'sent' and d.retry_after<=clock_timestamp() returning lease into acquired;
   if acquired is not null then return jsonb_build_object('day',item.day,'recipient',item.staff,'email',item.email,'kind',item.kind,'lease',acquired,'details',item.details); end if;
 end loop;
 return null;
end $$;
create or replace function mt.inbox_state(who uuid,lim integer) returns jsonb language sql stable set search_path='' as $$
with items as (select n.*,p.name from mt.notifications n join mt.people p on p.id=n.actor where n.recipient=who and not n.dismissed)
select jsonb_build_object('newCount',count(*) filter(where not seen and category<>'activity' and not(category='info' and topic='plan') and key>coalesce((select last_key from mt.inbox_visit where staff=who),0)),'inboxTotal',count(*),'unreadCount',count(*) filter(where not seen and category<>'activity' and not(category='info' and topic='plan')),'actionCount',count(*) filter(where category='action' and not resolved),'inbox',coalesce((select jsonb_agg(jsonb_build_object('key',key::text,'id',id,'date',day,'actor',actor,'actorName',name,'at',at,'action',event,'title',title,'text',body,'type',category,'seen',seen,'resolved',resolved,'availability',topic='leave') order by key desc) from (select * from items order by key desc limit lim) x),'[]')) from items $$;
create function mt.sync_legacy_rule() returns trigger language plpgsql set search_path='' as $$
begin
 if not new.slot and new.status='approved' and new.mode<>'off' then
 insert into mt.availability_rules values(new.staff,new.day,0,new.mode,new.starts,new.ends,new.reason) on conflict(staff,day,weekday) do update set mode=excluded.mode,starts=excluded.starts,ends=excluded.ends,reason=excluded.reason;end if;
 return new;end $$;
create trigger legacy_rule after insert or update on mt.leave_requests for each row execute function mt.sync_legacy_rule();
revoke all on function mt.sync_legacy_rule() from public,anon,authenticated;

alter table mt.shifts drop constraint shifts_kind_check;
alter table mt.shifts add constraint shifts_kind_check check(kind in ('shift','extra','off','standby','cancelled'));
-- Old directly saved unavailability has no approval record.
do $$
declare rule mt.availability_rules;req mt.time_off_requests;
begin
 for rule in delete from mt.availability_rules where mode='off' returning * loop
 insert into mt.time_off_requests(staff,first_day,last_day,weekday,reason,days,status)
 values(rule.staff,rule.day,rule.day,rule.weekday,rule.reason,rule.day-(now() at time zone 'Europe/Amsterdam')::date,case when rule.weekday=0 and rule.day<(now() at time zone 'Europe/Amsterdam')::date then 'expired' else 'pending' end) returning * into req;
 if req.status='pending' then
 insert into mt.notifications(recipient,id,day,event,actor,at,title,body,category,topic)
 select id,req.id::text,req.first_day,'leaveRequest',req.staff,clock_timestamp(),'Vrijaanvraag beoordelen',req.reason,'action','leave' from mt.people where active and role='admin';
 end if;
 end loop;
end $$;
