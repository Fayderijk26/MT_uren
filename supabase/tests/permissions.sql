-- Starts and rolls back its own fictional records. PostgreSQL's authenticated
-- role plus a per-session subject reproduces the database side of a signed request.
begin;
insert into auth.users(id,email,invited_at) values
('00000000-0000-4000-8000-000000000001','local-worker@example.invalid',now()),
('00000000-0000-4000-8000-000000000002','local-reviewer@example.invalid',now()),
('00000000-0000-4000-8000-000000000003','local-admin@example.invalid',now()),
('00000000-0000-4000-8000-000000000004','dormant@example.invalid',null);
update mt.people set role='admin' where id='00000000-0000-4000-8000-000000000003';
update mt.people set role='lead' where id='00000000-0000-4000-8000-000000000002';
insert into mt.shifts(id,staff,day,starts,ends,kind) values ('qa-duty','00000000-0000-4000-8000-000000000002','2026-10-07','15:00','18:00','shift');
insert into mt.shifts(id,staff,day,starts,ends,kind) values
 ('qa-one','00000000-0000-4000-8000-000000000001','2026-10-07','09:00','18:00','shift'),
 ('qa-two','00000000-0000-4000-8000-000000000002','2026-10-08','10:00','11:00','shift');
set local role authenticated;
do $$
declare q jsonb:='{"id":"qa-one","start":"09:00","end":"17:45","pause":30,"version":0,"requestId":"qa-repeat"}'; result jsonb;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 if jsonb_array_length(public.mt_state()->'shifts')<>1 then raise exception 'Lek in daglijst'; end if;
 begin perform 1 from mt.shifts; raise exception 'Directe toegang toegestaan'; exception when insufficient_privilege then null; end;
 begin perform public.mt_act('profile','{"user":"00000000-0000-4000-8000-000000000001","role":"admin"}'); raise exception 'Rolwijziging toegestaan'; exception when insufficient_privilege then null; end;
 begin perform public.mt_act('submit',q||'{"id":"qa-two"}'); raise exception 'Andermans uren wijzigbaar'; exception when insufficient_privilege then null; end;
 perform public.mt_act('submit',q); result:=public.mt_act('submit',q);
 if result#>>'{shifts,0,entry,net}'<>'495' or result#>>'{shifts,0,entry,version}'<>'1' then raise exception 'Netto of retry fout'; end if;
 begin perform public.mt_act('approve','{"id":"qa-one","version":1}'); exception when others then null; end;
 if public.mt_state()#>>'{shifts,0,entry,status}'<>'pending' then raise exception 'Eigen uren goedgekeurd'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
 result:=public.mt_act('approve','{"id":"qa-one","version":1}');
 if result#>>'{shifts,0,entry,status}'<>'approved' then raise exception 'Goedkeuring mislukt'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 begin perform public.mt_act('submit',q-'requestId'||'{"pause":15,"version":2}'); raise exception 'Goedgekeurde uren wijzigbaar'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
 perform public.mt_act('return','{"id":"qa-one","version":2,"reason":"Controleer je tijden"}');
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 result:=public.mt_act('submit',q-'requestId'||'{"pause":15,"version":3}');
 if result#>>'{shifts,0,entry,status}'<>'pending' or result#>>'{shifts,0,entry,net}'<>'510' then raise exception 'Correctie fout'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
 begin perform public.mt_state(); raise exception 'Onuitgenodigde medewerker actief'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.mt_state()','execute') or has_function_privilege('anon','public.mt_act(text,jsonb)','execute') then raise exception 'Anonieme toegang'; end if;
 if (select count(*) from mt.entries where shift_id='qa-one')<>1 then raise exception 'Dubbele boeking'; end if;
end $$;
set local role authenticated;
do $$
declare d date:=(now() at time zone 'Europe/Amsterdam')::date+23; r jsonb; id text;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 r:=public.mt_act('leaveRequest',jsonb_build_object('date',d-3,'mode','from','start','16:00'));
 select value->>'id' into id from jsonb_array_elements(r->'leave') where value->>'status'='pending' and value->>'days'='20';
 if id is null then raise exception 'Late aanvraag ontbreekt';end if;
 r:=public.mt_act('leaveRequest',jsonb_build_object('date',d-2,'mode','until','end','13:00'));
 if not exists(select from jsonb_array_elements(r->'leave') x where x->>'days'='21' and x->>'status'='approved') then raise exception 'Grens 21 dagen';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
 r:=public.mt_act('leaveApprove',jsonb_build_object('id',id,'alternative',true,'mode','range','start','12:00','end','16:00'));
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 r:=public.mt_act('leaveApprove',jsonb_build_object('id',id,'revision',2));
 if not exists(select from jsonb_array_elements(r->'leave') x where x->>'id'=id and x->>'status'='approved' and x->>'days'='20') then raise exception 'Tegenvoorstel mislukt';end if;
end $$;
rollback;
