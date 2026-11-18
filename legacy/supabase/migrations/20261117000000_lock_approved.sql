create or replace function mt.submit(s mt.shifts, payload jsonb) returns void language plpgsql set search_path='' as $$
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
  if old_entry.status='approved' then raise exception 'Deze uren zijn al goedgekeurd. Alleen de bedrijfsleider kan ze heropenen.' using errcode='42501'; end if;
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

create or replace function mt.review(s mt.shifts, op text, payload jsonb) returns void language plpgsql set search_path='' as $$
declare previous mt.entries; saved mt.entries; feedback text:=trim(coalesce(payload->>'reason',''));
begin
  if not mt.can_review(s.day) or s.staff=auth.uid() then raise exception 'Je mag deze dienst niet beoordelen.' using errcode='42501'; end if;
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
  perform mt.log_change(op,s.id,to_jsonb(previous),to_jsonb(saved));
end $$;
