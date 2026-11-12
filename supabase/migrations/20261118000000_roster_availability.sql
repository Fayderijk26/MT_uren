create function mt.check_availability() returns trigger
language plpgsql set search_path='' as $$
declare other mt.shifts; work mt.shifts; leave_row mt.shifts;
begin
  if tg_op='UPDATE' and old.kind='off' and new.kind not in ('off','cancelled') then
    raise exception 'Deze medewerker heeft vrij gevraagd. Open de vrijmelding en stel werktijden voor.';
  end if;
  if new.kind not in ('shift','extra','office','off') then return new; end if;
  for other in select * from mt.shifts where staff=new.staff and day=new.day and id<>new.id and kind in ('shift','extra','office','off') loop
    if new.kind='off' and other.kind='off' then continue; end if;
    if new.kind='off' or other.kind='off' then
      if new.kind='off' then work:=other; leave_row:=new; else work:=new; leave_row:=other; end if;
      if not exists(select from mt.audit a where a.action='acceptedSlot' and a.shift_id=work.id and a.actor=work.staff and a.after_value->>'off'=leave_row.id and (a.after_value->>'start')::time=work.starts and (a.after_value->>'end')::time=work.ends) then
        raise exception 'Deze medewerker heeft vrij gevraagd. Open de vrijmelding en stel werktijden voor.';
      end if;
    elsif new.starts<other.ends and new.ends>other.starts then
      raise exception 'Deze dienst overlapt een bestaande dienst. Pas de bestaande dienst aan.';
    end if;
  end loop;
  return new;
end $$;
create trigger check_availability after insert or update on mt.shifts for each row execute function mt.check_availability();
revoke all on function mt.check_availability() from public,anon,authenticated;

create function mt.handle_offer(op text,p jsonb) returns void language plpgsql set search_path='' as $$
declare s mt.shifts; body jsonb; offer jsonb; note text; a time; b time;
begin
  select * into s from mt.shifts where id=p->>'id';
  if not found or s.kind<>'off' then raise exception 'Deze vrijmelding is gewijzigd.'; end if;
  perform mt.require_open(s.day);
  if op='offer' then
    if not mt.can_review(s.day) or s.staff=auth.uid() then raise exception 'Geen toegang.'; end if;
    a:=mt.wall_time(p->>'start'); b:=mt.wall_time(p->>'end');
    if a is null or b is null or a>=b then raise exception 'Controleer de voorgestelde werktijden.'; end if;
    offer:=jsonb_build_object('token',gen_random_uuid(),'start',p->>'start','end',p->>'end');
    note:='Kun je van '||(p->>'start')||' tot '||(p->>'end')||' werken? '||coalesce(p->>'message','');
    body:=jsonb_build_object('offer',offer,'message',note);
  else
    select after_value->'offer' into offer from mt.audit where shift_id=s.id and (after_value ? 'offer' or after_value ? 'decision') order by seq desc limit 1;
    if s.staff<>auth.uid() or offer is null or offer->>'token' is distinct from p->>'token' then raise exception 'Dit voorstel is niet meer beschikbaar.'; end if;
    if op='acceptOffer' then
      perform mt.log_change('acceptedSlot',offer->>'token',null,offer||jsonb_build_object('off',s.id));
      insert into mt.shifts(id,staff,day,kind,starts,ends) values(offer->>'token',s.staff,s.day,'shift',(offer->>'start')::time,(offer->>'end')::time);
    end if;
    note:=(case when op='acceptOffer' then 'Ik kan werken' else 'Ik blijf vrij' end)||' · '||(offer->>'start')||' – '||(offer->>'end');
    body:=jsonb_build_object('decision',op,'message',note);
  end if;
  perform mt.log_change('message',s.id,null,body);
end $$;
revoke all on function mt.handle_offer(text,jsonb) from public,anon,authenticated;

do $outer$
declare body text;
begin
 select pg_get_functiondef('public.mt_act(text,jsonb)'::regprocedure) into body;
 if strpos(body,'if action=''seen'' then')=0 then raise exception 'mt_act definition changed'; end if;
 execute replace(body,'if action=''seen'' then',$new$
 if action in ('offer','acceptOffer','declineOffer') then
   perform mt.handle_offer(action,payload);
   if nonce is not null then insert into mt.requests values(caller.id,nonce,action,payload); end if;
   return public.mt_state();
 end if;
 if action='seen' then$new$);
end $outer$;
