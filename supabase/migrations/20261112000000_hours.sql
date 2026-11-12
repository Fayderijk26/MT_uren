-- One venue. Only mt_state and mt_act are exposed to authenticated REST clients.
begin;
create schema mt;
revoke all on schema mt from public, anon, authenticated;
alter default privileges in schema mt revoke execute on functions from public;

create table mt.people (
  id uuid primary key references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 160),
  role text not null default 'employee' check (role in ('employee','lead','admin')),
  contract text not null default 'zero' check (contract in ('fixed','zero')),
  active boolean not null default true
);
create table mt.contracts (
  staff uuid references mt.people not null,
  effective date not null,
  contract text not null check (contract in ('fixed','zero')),
  weekly_minutes integer check (weekly_minutes between 0 and 10080),
  primary key (staff,effective)
);
create table mt.leads (
  day date primary key,
  staff uuid not null references mt.people
);
create table mt.shifts (
  id text primary key check (length(id) between 1 and 200),
  staff uuid not null references mt.people,
  day date not null,
  starts time,
  ends time,
  area text not null default '' check (length(area)<=160),
  task text not null default '' check (length(task)<=160),
  kind text not null check (kind in ('shift','office','extra','off','standby','cancelled')),
  deadline time,
  raw text not null default '' check (length(raw)<=250),
  check (ends is null or (starts is not null and ends > starts)),
  check (kind not in ('shift','extra') or (starts is not null and ends is not null)),
  check (kind not in ('off','standby') or (starts is null and ends is null)),
  check (kind in ('standby','shift','cancelled') or deadline is null)
);
create index shifts_staff_day on mt.shifts(staff,day);
create index shifts_day on mt.shifts(day);
create table mt.entries (
  shift_id text primary key references mt.shifts,
  actual_start timestamptz not null,
  actual_end timestamptz not null,
  pause integer not null check (pause>=0),
  net integer not null check (net>0),
  status text not null check (status in ('pending','approved','returned')),
  revision integer not null check (revision>0),
  reason text not null default '',
  reviewer uuid references mt.people,
  changed_at timestamptz not null default now(),
  check (actual_end>actual_start)
);
create table mt.norms (
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  staff uuid references mt.people not null,
  norm integer not null check (norm between 0 and 44640),
  paid integer not null check (paid between 0 and 44640),
  primary key (month,staff)
);
create table mt.periods (
  month text primary key,
  closed boolean not null,
  revision integer not null
);
create table mt.audit (
  seq bigint generated always as identity primary key,
  actor uuid not null references mt.people,
  at timestamptz not null default clock_timestamp(),
  action text not null,
  shift_id text,
  before_value jsonb,
  after_value jsonb
);
create index audit_shift on mt.audit(shift_id,seq);
create table mt.closures (
  month text not null, revision integer not null,
  closed_at timestamptz not null default now(),
  closed_by uuid not null references mt.people,
  reason text not null default '',
  snapshot jsonb not null,
  primary key(month,revision)
);
create table mt.requests (
  staff uuid references mt.people not null, request_id text not null,
  action text not null, payload jsonb not null, primary key(staff,request_id)
);

do $$
declare t text;
begin
  foreach t in array array['people','contracts','leads','shifts','entries','norms','periods','audit','closures','requests'] loop
    execute format('alter table mt.%I enable row level security',t);
  end loop;
end $$;
revoke all on all tables in schema mt from public,anon,authenticated;
revoke all on all sequences in schema mt from public,anon,authenticated;

create function mt.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Authorization values never come from editable user metadata.
  insert into mt.people(id,name) values(new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),nullif(split_part(new.email,'@',1),''),'Medewerker'),160));
  insert into mt.contracts(staff,effective,contract) values(new.id,(now() at time zone 'Europe/Amsterdam')::date,'zero');
  return new;
end $$;
create trigger mt_account_created after insert on auth.users for each row execute function mt.handle_new_user();

create function mt.can_review(target_day date) returns boolean
language sql stable set search_path='' as $$
 select exists(select from mt.people p where p.id=auth.uid() and p.active and
    (p.role='admin' or (p.role='lead' and exists(select from mt.leads l where l.day=target_day and l.staff=p.id))))
$$;

create function mt.require_open(target_day date) returns void language plpgsql set search_path='' as $$
begin
  if target_day is null then raise exception 'Datum ontbreekt.'; end if;
  if exists(select from mt.periods where month=to_char(target_day,'YYYY-MM') and closed) then raise exception 'Deze maand is afgesloten.'; end if;
end $$;

create function mt.wall_time(value text) returns time language plpgsql immutable set search_path='' as $$
begin
  if value is null or value='' then return null; end if;
  if value !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Gebruik een geldige tijd in uren en minuten.'; end if;
  return value::time;
end $$;

create function mt.instant(target_day date, wall time) returns timestamptz language plpgsql stable set search_path='' as $$
declare local_value timestamp:=target_day+wall; instant_value timestamptz:=local_value at time zone 'Europe/Amsterdam';
begin
  if local_value is null then raise exception 'Vul begin en einde in.'; end if;
  if instant_value at time zone 'Europe/Amsterdam' <> local_value or
    (instant_value-interval '1 hour') at time zone 'Europe/Amsterdam'=local_value or
    (instant_value+interval '1 hour') at time zone 'Europe/Amsterdam'=local_value
  then raise exception 'Dit lokale tijdstip is onzeker door het verzetten van de klok.'; end if;
  return instant_value;
end $$;

create function mt.entry_json(e mt.entries) returns jsonb language sql stable strict set search_path='' as $$
 select jsonb_build_object('start',to_char(e.actual_start at time zone 'Europe/Amsterdam','HH24:MI'),
   'end',to_char(e.actual_end at time zone 'Europe/Amsterdam','HH24:MI'),'pause',e.pause,'net',e.net,
   'status',e.status,'version',e.revision,'reason',e.reason,'reviewer',e.reviewer,'changedAt',e.changed_at)
$$;
create function mt.shift_json(s mt.shifts) returns jsonb language sql stable strict set search_path='' as $$
 select jsonb_build_object('id',s.id,'user',s.staff,'date',s.day,'start',to_char(s.starts,'HH24:MI'),
    'end',to_char(s.ends,'HH24:MI'),'kind',s.kind,'area',s.area,'task',s.task,'raw',s.raw,
    'deadline',to_char(s.deadline,'HH24:MI'),'entry',(select mt.entry_json(e) from mt.entries e where e.shift_id=s.id))
$$;

create function public.mt_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare caller mt.people; result jsonb;
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
       or exists(select from mt.leads l join visible v on l.day=v.day where l.staff=p.id)),'[]'::jsonb),
     'rosterPeople',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name,p.id)
       from mt.people p where p.active and (caller.role='admin' or (caller.role='lead' and exists(
          select from mt.leads l left join mt.periods m on m.month=to_char(l.day,'YYYY-MM')
          where l.staff=caller.id and not coalesce(m.closed,false))))),'[]'::jsonb),
     'shifts',coalesce((select jsonb_agg(mt.shift_json(v.original) order by v.day,v.starts,v.id) from visible v),'[]'::jsonb),
     'leads',coalesce((select jsonb_object_agg(l.day,l.staff) from mt.leads l where caller.role='admin' or l.staff=caller.id or exists(select from visible v where v.day=l.day)),'{}'::jsonb),
     'closed',coalesce((select jsonb_agg(month order by month) from mt.periods where closed),'[]'::jsonb),
     'periodVersions',coalesce((select jsonb_object_agg(month,revision) from mt.periods),'{}'::jsonb),
     'norms',coalesce((select jsonb_object_agg(n.month||':'||n.staff,jsonb_build_object('norm',n.norm,'paid',n.paid))
       from mt.norms n where caller.role='admin' or n.staff=caller.id),'{}'::jsonb),
     'contracts',coalesce((select jsonb_agg(jsonb_build_object('user',c.staff,'effective',c.effective,'contract',c.contract,'weeklyMinutes',c.weekly_minutes) order by c.effective)
       from mt.contracts c where caller.role='admin' or c.staff=caller.id),'[]'::jsonb)) into result;
  return result;
end $$;

create function mt.log_change(op text, shift_key text, old_value jsonb, new_value jsonb)
returns void language sql set search_path='' as $$
 insert into mt.audit(actor,action,shift_id,before_value,after_value) values(auth.uid(),op,shift_key,old_value,new_value)
$$;

create function mt.save_plan(item jsonb) returns void language plpgsql set search_path='' as $$
declare prev mt.shifts; next_shift mt.shifts;
begin
  next_shift.id := item->>'id'; next_shift.staff := (item->>'user')::uuid; next_shift.day := (item->>'date')::date;
  next_shift.kind := coalesce(nullif(item->>'kind',''),'shift');
  next_shift.starts := mt.wall_time(item->>'start'); next_shift.ends := mt.wall_time(item->>'end');
  next_shift.deadline := mt.wall_time(item->>'deadline');
  next_shift.area:=coalesce(item->>'area',''); next_shift.task:=coalesce(item->>'task',''); next_shift.raw:=coalesce(item->>'raw','');
  if next_shift.starts is not null and next_shift.ends is null then next_shift.ends:='18:00'; end if;
  if not exists(select from mt.people where id=next_shift.staff and active) then raise exception 'Kies een actieve medewerker.'; end if;
  select * into prev from mt.shifts where id=next_shift.id;
  if found then
    if prev is not distinct from next_shift then return; end if;
    if prev.staff is distinct from next_shift.staff or prev.day is distinct from next_shift.day then
      raise exception 'Medewerker of datum is gewijzigd. Gebruik een ruil of een nieuwe dienst.';
    end if;
    if item ? 'before' and mt.shift_json(prev)-'entry' is distinct from (item->'before')-'entry' then
      raise exception 'De planning is ondertussen gewijzigd. Controleer het importvoorbeeld opnieuw.';
    end if;
  end if;
  perform mt.require_open(next_shift.day);
  if next_shift.starts is not null then perform mt.instant(next_shift.day,next_shift.starts); end if;
  if next_shift.ends is not null then perform mt.instant(next_shift.day,next_shift.ends); end if;
  if next_shift.kind in ('off','standby','cancelled') and exists(select from mt.entries where shift_id=next_shift.id) then
    raise exception 'Deze dienst heeft ingediende uren. Handel de inzending eerst afzonderlijk af.';
  end if;
  insert into mt.shifts select next_shift.*
    on conflict(id) do update set starts=excluded.starts,ends=excluded.ends,kind=excluded.kind,
      area=excluded.area,task=excluded.task,deadline=excluded.deadline,raw=excluded.raw;
  perform mt.log_change('plan',next_shift.id,to_jsonb(prev),to_jsonb(next_shift));
end $$;

create function mt.submit(s mt.shifts, payload jsonb) returns void language plpgsql set search_path='' as $$
declare old_entry mt.entries; saved mt.entries; a timestamptz; b timestamptz; rest integer; mins integer;
  expected integer:=(payload->>'version')::integer;
begin
  if s.staff<>auth.uid() then raise exception 'Je kunt alleen je eigen uren indienen.' using errcode='42501'; end if;
  if payload - array['id','start','end','pause','version','requestId'] <> '{}'::jsonb then raise exception 'Onbekende invoervelden.'; end if;
  if s.kind not in ('office','shift','extra') then raise exception 'Deze roostervermelding is geen gewerkte dienst.'; end if;
  a:=mt.instant(s.day,mt.wall_time(payload->>'start')); b:=mt.instant(s.day,mt.wall_time(payload->>'end'));
  if b<=a or b>clock_timestamp() then raise exception 'Einde moet na het begin liggen en mag niet in de toekomst liggen.'; end if;
  if coalesce(payload->>'pause','') !~ '^[0-9]{1,4}$' then raise exception 'Vul de pauze in als heel aantal minuten vanaf nul.'; end if;
  rest:=(payload->>'pause')::integer; mins:=(extract(epoch from b-a)/60)::integer-rest;
  if mins<=0 then raise exception 'Pauze moet korter zijn dan de dienst.'; end if;
  select * into old_entry from mt.entries where shift_id=s.id;
  if expected is distinct from coalesce(old_entry.revision,0) then
    if expected=old_entry.revision-1 and old_entry.status='pending' and old_entry.actual_start=a and old_entry.actual_end=b and old_entry.pause=rest then return; end if;
    raise exception 'De inzending is gewijzigd. Open de nieuwste versie.';
  end if;
  if exists(select from mt.entries e join mt.shifts other on other.id=e.shift_id
    where other.staff=s.staff and other.day=s.day and other.id<>s.id and e.actual_start<b and a<e.actual_end) then raise exception 'Deze uren overlappen een andere inzending.'; end if;
  insert into mt.entries(shift_id,actual_start,actual_end,pause,net,status,revision)
  values(s.id,a,b,rest,mins,'pending',expected+1)
  on conflict(shift_id) do update set actual_start=excluded.actual_start,actual_end=excluded.actual_end,pause=excluded.pause,
     net=excluded.net,status='pending',revision=excluded.revision,reason='',reviewer=null,changed_at=now()
  returning * into saved;
  perform mt.log_change('submit',s.id,to_jsonb(old_entry),to_jsonb(saved));
end $$;

create function mt.review(s mt.shifts, op text, payload jsonb) returns void language plpgsql set search_path='' as $$
declare previous mt.entries; saved mt.entries; feedback text:=trim(coalesce(payload->>'reason',''));
begin
  if not mt.can_review(s.day) or s.staff=auth.uid() then raise exception 'Je mag deze dienst niet beoordelen.' using errcode='42501'; end if;
  if payload-array['id','version','reason','requestId'] <> '{}'::jsonb then raise exception 'Onbekende beoordelingsvelden.'; end if;
  select * into previous from mt.entries where shift_id=s.id;
  if not found or previous.status<>'pending' or previous.revision is distinct from (payload->>'version')::integer then
    raise exception 'Deze versie staat niet meer ter beoordeling.';
  end if;
  if op='return' and feedback='' then raise exception 'Geef aan wat aangepast moet worden.'; end if;
  if length(feedback)>1000 then raise exception 'Houd de toelichting onder 1000 tekens.'; end if;
  update mt.entries set status=case when op='approve' then 'approved' else 'returned' end,
    revision=revision+1, reviewer=auth.uid(), reason=case when op='return' then feedback else '' end,changed_at=now()
    where shift_id=s.id returning * into saved;
  perform mt.log_change(op,s.id,to_jsonb(previous),to_jsonb(saved));
end $$;

create function public.mt_act(action text, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller mt.people; s mt.shifts; old_shift mt.shifts; person mt.people; new_person mt.people;
  item jsonb; period_key text:=payload->>'month'; period_start date; target_day date; employee uuid; prev jsonb;
  note text:=trim(coalesce(payload->>'reason','')); rev integer; snapshot jsonb;
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
      if s.kind<>'cancelled' then perform public.mt_act('cancel',jsonb_build_object('id',s.id)); end if;
    end loop;
  elsif action='extra' then
    target_day:=(payload->>'date')::date;
    employee:=coalesce((payload->>'user')::uuid,caller.id);
    if employee<>caller.id and not mt.can_review(target_day) then raise exception 'Geen dagrechten.' using errcode='42501'; end if;
    if exists(select from mt.shifts where id=payload->>'id') then raise exception 'Deze dienst-ID bestaat al.'; end if;
    perform mt.save_plan(payload||jsonb_build_object('kind','extra','user',employee));
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
      s.kind:='cancelled';
    end if;
    update mt.shifts set staff=s.staff,kind=s.kind,starts=s.starts,ends=s.ends where id=s.id;
    perform mt.log_change(action,s.id,to_jsonb(old_shift),to_jsonb(s));
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
end $$;
revoke all on function public.mt_state(),public.mt_act(text,jsonb) from public,anon,authenticated;
grant execute on function public.mt_state(),public.mt_act(text,jsonb) to authenticated;
commit;
