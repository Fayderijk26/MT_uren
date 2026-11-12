begin;
alter table mt.entries drop constraint entries_status_check;
alter table mt.entries add constraint entries_status_check check(status in ('pending','approved','returned','rejected'));
create table mt.seen(staff uuid references mt.people, key text, primary key(staff,key));
alter table mt.seen enable row level security;
revoke all on mt.seen from public,anon,authenticated;
alter function public.mt_state() rename to mt_state_base;
create function public.mt_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; notes jsonb;
begin
 result:=public.mt_state_base();
 select coalesce(jsonb_agg(n order by seq desc),'[]') into notes from (
 select a.seq,jsonb_build_object('key',a.seq::text,'id',s.id,'actor',a.actor,'action',a.action,
 'text',coalesce(a.after_value->>'message',a.after_value->>'reason',a.after_value#>>'{entry,reason}',''),
 'seen',exists(select from mt.seen r where r.staff=auth.uid() and r.key=a.seq::text)) n
 from mt.audit a join mt.shifts s on s.id=a.shift_id
 where a.actor<>auth.uid() and (s.staff=auth.uid() or mt.can_review(s.day))
 and a.action in ('return','reject','cancel','plan','restore','message','submit')
 order by a.seq desc limit 100) q;
 return result||jsonb_build_object('notifications',notes);
end $$;
alter function public.mt_act(text,jsonb) rename to mt_act_base;
create function public.mt_act(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s mt.shifts; old jsonb; caller mt.people; result jsonb; note text:=trim(coalesce(payload->>'reason',payload->>'message','')); nonce text:=payload->>'requestId'; prior mt.requests;
begin
 perform pg_advisory_xact_lock(166312,41);
 select * into caller from mt.people where id=auth.uid() and active;
 if not found then raise exception 'Geen actief account.' using errcode='42501'; end if;
 if nonce is not null then
 select * into prior from mt.requests where staff=caller.id and request_id=nonce;
 if found then
 if prior.action<>action or prior.payload<>payload then raise exception 'Aanvraagnummer al gebruikt.'; end if;
 return public.mt_state();
 end if;
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
 -- Retry with the same request is safe; base verifies exact payload.
 if nonce is not null and exists(select from mt.requests where staff=caller.id and request_id=nonce and action='extra') then
 return public.mt_act_base(action,payload);
 end if;
 raise exception 'Je hebt al een overlappende dienst. Pas die registratie aan.';
 end if;
 end if;
 if action in ('message','restore','reject','cancel') then
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
 else
 result:=public.mt_act_base(action,payload);
 end if;
 if action<>'cancel' and nonce is not null then insert into mt.requests values(caller.id,nonce,action,payload); end if;
 perform mt.log_change(action,s.id,old,jsonb_build_object('reason',note));
 return public.mt_state();
 end if;
 if action='extra' and payload ? 'pause' then
 result:=public.mt_act_base(action,payload-'pause'-'requestId');
 perform public.mt_act_base('submit',jsonb_build_object('id',payload->>'id','start',payload->>'start','end',payload->>'end','pause',payload->'pause','version',0));
 if nonce is not null then insert into mt.requests values(caller.id,nonce,action,payload); end if;
 return public.mt_state();
 end if;
 return public.mt_act_base(action,payload);
end $$;
revoke all on function public.mt_act_base(text,jsonb),public.mt_state_base(),public.mt_act(text,jsonb),public.mt_state() from public,anon,authenticated;
grant execute on function public.mt_act(text,jsonb),public.mt_state() to authenticated;
commit;
