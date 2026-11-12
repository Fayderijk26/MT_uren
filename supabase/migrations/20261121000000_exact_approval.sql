CREATE OR REPLACE FUNCTION public.mt_act(action text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare old jsonb; caller mt.people; s mt.shifts; old_shift mt.shifts; person mt.people; new_person mt.people;
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

  if action in ('plan','lead','norm','close','reopen','profile') and caller.role<>'admin' then raise exception 'Alleen voor de bedrijfsleider.' using errcode='42501'; end if;
  if action in ('submit','approve','return','cancel','swap','call') then
    select * into s from mt.shifts where id=payload->>'id' and (staff=caller.id or mt.can_review(day));
    if not found then raise exception 'Onbekende of ontoegankelijke dienst.' using errcode='42501'; end if;
    perform mt.require_open(s.day);
    if action in ('cancel','swap','call') and not mt.can_review(s.day) then raise exception 'Geen dagrechten.' using errcode='42501'; end if;
  end if;

  if action='submit' then perform mt.submit(s,payload);
  elsif action in ('approve','return') then perform mt.review(s,action,payload);
  elsif action='plan' then
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
  elsif action='lead' then
    target_day:=(payload->>'date')::date; employee:=nullif(payload->>'user','')::uuid;
    perform mt.require_open(target_day);
    select to_jsonb(l) into prev from mt.leads l where day=target_day;
    if employee is null then delete from mt.leads where day=target_day;
    else
      if not exists(select from mt.people where id=employee and active and role in ('lead','admin')) then raise exception 'Kies een bevoegde dagleider.'; end if;
      insert into mt.leads(day,staff) values(target_day,employee) on conflict(day) do update set staff=excluded.staff;
    end if;
    perform mt.log_change(action,null,prev,payload-'requestId');
  elsif action in ('norm','close','reopen') then
    if coalesce(period_key,'') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Kies een geldige maand.'; end if;
    period_start:=(period_key||'-01')::date;
    if action<>'reopen' then perform mt.require_open(period_start); end if;
    if action='norm' then
      employee:=(payload->>'user')::uuid;
      select to_jsonb(n) into prev from mt.norms n where staff=employee and month=period_key;
      insert into mt.norms(month,staff,norm,paid) values(period_key,employee,(payload->>'norm')::integer,(payload->>'paid')::integer)
        on conflict(month,staff) do update set norm=excluded.norm,paid=excluded.paid;
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
    if not new_person.active or new_person.role='employee' then
      delete from mt.leads where staff=employee and day>=(now() at time zone 'Europe/Amsterdam')::date;
    end if;
    perform mt.log_change(action,null,to_jsonb(person),to_jsonb(new_person));
  else raise exception 'Onbekende actie.';
  end if;
  if nonce is not null then insert into mt.requests values(caller.id,nonce,action,payload); end if;
  if not exists(select from mt.people where id=caller.id and active) then return '{}'::jsonb; end if;
  return public.mt_state();
end $function$;

create or replace function mt.review(s mt.shifts, op text, payload jsonb) returns void language plpgsql set search_path='' as $$
declare previous mt.entries; saved mt.entries; feedback text:=trim(coalesce(payload->>'reason',''));
begin
  if not mt.can_review(s.day) or (s.staff=auth.uid() and not (op='approve' and exists(select from mt.people where id=auth.uid() and active and role='admin'))) then raise exception 'Je mag deze dienst niet beoordelen.' using errcode='42501'; end if;
  if payload-array['id','version','reason','requestId'] <> '{}'::jsonb then raise exception 'Onbekende beoordelingsvelden.'; end if;
  select * into previous from mt.entries where shift_id=s.id;
  if not found or (previous.status<>'pending' and not (previous.status='approved' and op='return' and exists(select from mt.people where id=auth.uid() and active and role='admin'))) or previous.revision is distinct from (payload->>'version')::integer then
    raise exception 'Deze versie staat niet meer ter beoordeling.';
  end if;
  if op='return' and feedback='' then raise exception 'Geef aan wat aangepast moet worden.'; end if;
  if length(feedback)>1000 then raise exception 'Houd de toelichting onder 1000 tekens.'; end if;
  update mt.entries set status=case when op='approve' then 'approved' else 'returned' end,
    revision=revision+1, reviewer=auth.uid(), reason=case when op='return' then feedback else '' end,changed_at=now()
    where shift_id=s.id returning * into saved;
  perform mt.log_change(case when s.staff=auth.uid() then 'selfApprove' else op end,s.id,to_jsonb(previous),to_jsonb(saved));
end $$;
