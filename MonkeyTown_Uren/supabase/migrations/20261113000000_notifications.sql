-- Local dates and clock times follow the roster in Amsterdam.
create table mt.mail_delivery (
  day date not null,
  recipient uuid not null references mt.people(id),
  kind text not null check (kind in ('closing','missing')),
  lease uuid not null,
  retry_after timestamptz not null,
  delivery_state text not null check (delivery_state in ('sending','sent','retry')),
  attempts integer not null default 1,
  provider_id text,
  primary key (day,recipient,kind)
);
alter table mt.mail_delivery enable row level security;
revoke all on mt.mail_delivery from public,anon,authenticated;

create function public.mt_mail_claim(after_time time) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  clock_local timestamp := clock_timestamp() at time zone 'Europe/Amsterdam';
  item record;
  acquired uuid;
begin
  if after_time is null or clock_local::time < after_time then return null; end if;
  -- A fresh query for each delivery picks up swaps, cancellations, late filings and inactive accounts.
  for item in
    with work as (
      select s.staff,s.ends,e.status
      from mt.shifts s
      join mt.people p on p.id=s.staff and p.active
      left join mt.entries e on e.shift_id=s.id
      where s.day=clock_local::date and s.kind in ('shift','office','extra')
    ), live_lead as (
      select l.staff from mt.leads l join mt.people p on p.id=l.staff
      where l.day=clock_local::date and p.active and p.role in ('lead','admin')
    ), reviewer as (
      select staff from live_lead
      union all
      (select id from mt.people where active and role='admin' and not exists(select from live_lead) order by id limit 1)
    ), candidates as (
      select distinct staff,'missing'::text kind from work
      where status is null and ends is not null and ends<=clock_local::time
      union all
      select staff,'closing' from reviewer where exists(
        select from work where status in ('pending','returned') or
          (status is null and (ends is null or ends<=clock_local::time))
      )
    )
    select c.staff,c.kind,u.email from candidates c join auth.users u on u.id=c.staff
    left join mt.mail_delivery d on d.day=clock_local::date and d.recipient=c.staff and d.kind=c.kind
    where u.email is not null and (d.recipient is null or (d.delivery_state<>'sent' and d.retry_after<=clock_timestamp()))
    order by c.kind,c.staff
  loop
    insert into mt.mail_delivery as d(day,recipient,kind,lease,retry_after,delivery_state)
    values(clock_local::date,item.staff,item.kind,gen_random_uuid(),clock_timestamp()+interval '5 minutes','sending')
    on conflict(day,recipient,kind) do update set
      lease=excluded.lease,retry_after=excluded.retry_after,delivery_state='sending',attempts=d.attempts+1
    where d.delivery_state<>'sent' and d.retry_after<=clock_timestamp()
    returning lease into acquired;
    if acquired is not null then
      return jsonb_build_object('day',clock_local::date,'recipient',item.staff,'email',item.email,'kind',item.kind,'lease',acquired);
    end if;
  end loop;
  return null;
end;
$$;

create function public.mt_mail_finish(claim_id uuid, delivery_id text) returns void
language sql security definer set search_path='' as $$
  update mt.mail_delivery set
    delivery_state=case when delivery_id is null then 'retry' else 'sent' end,
    provider_id=delivery_id,retry_after=clock_timestamp()+interval '5 minutes'
  where lease=claim_id and delivery_state='sending';
$$;
revoke all on function public.mt_mail_claim(time), public.mt_mail_finish(uuid,text) from public,anon,authenticated;
grant execute on function public.mt_mail_claim(time), public.mt_mail_finish(uuid,text) to service_role;
