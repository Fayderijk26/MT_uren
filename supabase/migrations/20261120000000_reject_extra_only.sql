create function mt.validate_rejection() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select from mt.shifts where id=new.shift_id and kind='extra') then
    raise exception 'Vraag bij geplande uren een aanpassing.';
  end if;
  return new;
end $$;
revoke all on function mt.validate_rejection() from public,anon,authenticated;
create trigger validate_rejection before update of status on mt.entries for each row when (new.status='rejected') execute function mt.validate_rejection();
