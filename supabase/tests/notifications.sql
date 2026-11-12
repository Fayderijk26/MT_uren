-- Run with psql -v ON_ERROR_STOP=1 against an empty local test project. Rolls back.
begin;
do $$
declare
  d date := (now() at time zone 'Europe/Amsterdam')::date;
  worker uuid := gen_random_uuid();
  lead1 uuid := gen_random_uuid();
  lead2 uuid := gen_random_uuid();
  standby uuid := gen_random_uuid();
  item jsonb;
  outcome text;
begin
  if exists (select from mt.shifts where day=d) then raise exception 'Gebruik een leeg testproject'; end if;
  if (now() at time zone 'Europe/Amsterdam')::time < time '00:02' then raise exception 'Herhaal na 00.02 lokale tijd'; end if;
  if has_function_privilege('authenticated','public.mt_mail_claim(time)','execute') or
     has_function_privilege('anon','public.mt_mail_finish(uuid,text)','execute') then raise exception 'Publieke mailfunctie'; end if;
  insert into auth.users(id,email,raw_user_meta_data) values
    (worker,'worker@example.test','{}'),(lead1,'lead1@example.test','{}'),
    (lead2,'lead2@example.test','{}'),(standby,'standby@example.test','{}');
  update mt.people set active=true where id in (worker,lead1,lead2,standby);
  update mt.people set role='lead' where id in (lead1,lead2);
  insert into mt.leads values(d,lead1);
  insert into mt.shifts(id,staff,day,kind,starts,ends) values
    ('test-mail-normal',worker,d,'shift','00:00','00:01'),('test-mail-standby',standby,d,'standby',null,null);
  item:=public.mt_mail_claim('00:00');
  if (item->>'recipient')::uuid is distinct from lead1 or item->>'kind'<>'closing' then raise exception 'Verkeerde dagleiding'; end if;
  perform public.mt_mail_finish((item->>'lease')::uuid,'test-provider-id');
  item:=public.mt_mail_claim('00:00');
  if (item->>'recipient')::uuid is distinct from worker or item->>'kind'<>'missing' then raise exception 'Verkeerde medewerker'; end if;
  perform public.mt_mail_finish((item->>'lease')::uuid,null);
  if public.mt_mail_claim('00:00') is not null then raise exception 'Duplicaat of onterechte stand-by'; end if;
  update mt.leads set staff=lead2 where day=d;
  item:=public.mt_mail_claim('00:00');
  if (item->>'recipient')::uuid is distinct from lead2 then raise exception 'Overdracht mislukt'; end if;
  perform public.mt_mail_finish((item->>'lease')::uuid,'test-new-lead');
  update mt.mail_delivery set retry_after=now()-interval '1 minute' where recipient=worker;
  update mt.shifts set kind='cancelled' where id='test-mail-normal';
  if public.mt_mail_claim('00:00') is not null then raise exception 'Geannuleerde dienst opnieuw gestuurd'; end if;
  update mt.shifts set kind='shift' where id='test-mail-normal';
  item:=public.mt_mail_claim('00:00');
  if (item->>'recipient')::uuid is distinct from worker then raise exception 'Herkansing mislukt'; end if;
  perform public.mt_mail_finish((item->>'lease')::uuid,'test-delivery');
  select delivery_state into outcome from mt.mail_delivery where day=d and recipient=worker and kind='missing';
  if outcome<>'sent' then raise exception 'Verzendstatus ontbreekt'; end if;
  if public.mt_mail_claim('00:00') is not null then raise exception 'Duplicaat na herkansing'; end if;
end $$;
rollback;
