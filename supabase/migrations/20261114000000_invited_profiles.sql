-- Only Auth-managed invitations start with access. Self-registration stays dormant,
-- even if somebody accidentally enables signups on the hosted Auth dashboard.
create or replace function mt.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into mt.people(id,name,active) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),nullif(split_part(new.email,'@',1),''),'Medewerker'),160),new.invited_at is not null);
 insert into mt.contracts(staff,effective,contract) values(new.id,(now() at time zone 'Europe/Amsterdam')::date,'zero');
 return new;
end $$;
