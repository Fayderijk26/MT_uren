alter table mt.mail_delivery drop constraint mail_delivery_kind_check;
alter table mt.mail_delivery add check(kind in ('closing','missing','closing_next','missing_next'));

create function mt.hours_missing(workday date, finish time, kind text, entry_status text, local_now timestamp)
returns boolean language sql immutable as $$
 select entry_status is null and kind in ('shift','extra') and finish is not null and workday+finish<=local_now
$$;
revoke all on function mt.hours_missing(date,time,text,text,timestamp) from public,anon,authenticated;

create function mt.mail_candidates(local_now timestamp, after_time time)
returns table(day date, staff uuid, kind text, details jsonb) language sql stable set search_path='' as $$
with days(day,suffix) as (
 select local_now::date,'' where local_now::time>=after_time
 union all select local_now::date-1,'_next' where local_now::time>=time '09:00'
), work as (
 select d.day,d.suffix,s.staff,p.name,p.role,s.starts,s.ends,
 case when mt.hours_missing(s.day,s.ends,s.kind,e.status,local_now) then 'missing' else e.status end as status,
 to_char(e.actual_start at time zone 'Europe/Amsterdam','HH24:MI') actual_start,
 to_char(e.actual_end at time zone 'Europe/Amsterdam','HH24:MI') actual_end
 from days d join mt.shifts s on s.day=d.day and s.kind in ('shift','extra')
 join mt.people p on p.id=s.staff and p.active left join mt.entries e on e.shift_id=s.id
), reviewers as (
 select distinct w.day,w.staff from work w where role in ('lead','admin')
 union all select d.day,p.id from days d cross join mt.people p where p.active and p.role='admin'
 and not exists(select from work w where w.day=d.day and w.role in ('lead','admin'))
), points as (
 select w.*,jsonb_build_object('name',name,'status',status,'start',to_char(starts,'HH24:MI'),'end',to_char(ends,'HH24:MI'),'actualStart',actual_start,'actualEnd',actual_end) item
 from work w where status in ('pending','returned','missing')
)
select p.day,p.staff,'missing'||p.suffix,jsonb_agg(p.item order by p.starts) from points p where p.status in ('missing','returned') group by p.day,p.staff,p.suffix
union all
select r.day,r.staff,'closing'||p.suffix,jsonb_agg(p.item order by p.name,p.starts) from reviewers r join points p on p.day=r.day group by r.day,r.staff,p.suffix
$$;
revoke all on function mt.mail_candidates(timestamp,time) from public,anon,authenticated;

create or replace function public.mt_mail_claim(after_time time) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item record; acquired uuid;
begin
 for item in
   select c.*,u.email from mt.mail_candidates(clock_timestamp() at time zone 'Europe/Amsterdam',after_time) c
   join auth.users u on u.id=c.staff left join mt.mail_delivery d on d.day=c.day and d.recipient=c.staff and d.kind=c.kind
   where u.email is not null and (d.recipient is null or (d.delivery_state<>'sent' and d.retry_after<=clock_timestamp()))
   order by c.day,c.kind,c.staff
 loop
   insert into mt.mail_delivery as d(day,recipient,kind,lease,retry_after,delivery_state)
   values(item.day,item.staff,item.kind,gen_random_uuid(),clock_timestamp()+interval '5 minutes','sending')
   on conflict(day,recipient,kind) do update set lease=excluded.lease,retry_after=excluded.retry_after,delivery_state='sending',attempts=d.attempts+1
   where d.delivery_state<>'sent' and d.retry_after<=clock_timestamp() returning lease into acquired;
   if acquired is not null then return jsonb_build_object('day',item.day,'recipient',item.staff,'email',item.email,'kind',item.kind,'lease',acquired,'details',item.details); end if;
 end loop;
 return null;
end $$;

create or replace function mt.shift_json(s mt.shifts) returns jsonb language sql stable strict set search_path='' as $$
 select jsonb_build_object('id',s.id,'user',s.staff,'date',s.day,'start',to_char(s.starts,'HH24:MI'),
    'end',to_char(s.ends,'HH24:MI'),'kind',s.kind,'area',s.area,'task',s.task,'raw',s.raw,
    'missing',mt.hours_missing(s.day,s.ends,s.kind,(select status from mt.entries where shift_id=s.id),clock_timestamp() at time zone 'Europe/Amsterdam'),'deadline',to_char(s.deadline,'HH24:MI'),'entry',(select mt.entry_json(e) from mt.entries e where e.shift_id=s.id))
$$;
