-- Aggregate foreground presence only: no URLs, keystrokes, IPs, or XP.
begin;

create table public.academy_engagement_config (
  id boolean primary key default true check (id),
  collected_since timestamptz not null default clock_timestamp()
);
insert into public.academy_engagement_config(id) values(true);

create table public.academy_presence (
  user_id uuid primary key references public.academy_profiles(id) on delete cascade,
  session_id uuid not null,
  last_heartbeat timestamptz not null,
  last_access_at timestamptz not null,
  active boolean not null default false
);
create table public.academy_engagement_daily (
  user_id uuid not null references public.academy_profiles(id) on delete cascade,
  day date not null,
  active_seconds integer not null default 0 check (active_seconds between 0 and 86400),
  primary key(user_id, day)
);

alter table public.academy_engagement_config enable row level security;
alter table public.academy_presence enable row level security;
alter table public.academy_engagement_daily enable row level security;
revoke all on public.academy_engagement_config, public.academy_presence, public.academy_engagement_daily from anon, authenticated;
grant all on public.academy_engagement_config, public.academy_presence, public.academy_engagement_daily to service_role;

create function public.academy_record_presence(actor uuid, session_id uuid, is_active boolean) returns void
language plpgsql set search_path=public,pg_temp as $$
declare
  prior public.academy_presence;
  stamp timestamptz;
  seconds integer := 0;
  span_start timestamptz;
  midnight timestamptz;
  prior_seconds integer;
  today date;
begin
  if not exists(select 1 from public.academy_profiles p where p.id=actor and p.status='active' and p.audience='internal') then
    raise exception 'Acesso não autorizado';
  end if;
  if session_id is null or is_active is null then raise exception 'Presença inválida'; end if;
  -- Lock covers first insert and competing tabs/devices for the same employee.
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 5721));
  stamp := clock_timestamp();
  today := (stamp at time zone 'America/Sao_Paulo')::date;
  select * into prior from public.academy_presence p where p.user_id=actor for update;
  if not found then
    if not is_active then return; end if;
    insert into public.academy_presence values(actor, session_id, stamp, stamp, true);
  else
    -- A second tab cannot close the current lease or add concurrent time.
    if prior.session_id <> session_id then
      if not is_active or (prior.active and stamp-prior.last_heartbeat <= interval '75 seconds') then return; end if;
    elsif prior.active and stamp-prior.last_heartbeat between interval '0 seconds' and interval '75 seconds' then
      seconds := least(60, floor(extract(epoch from stamp-prior.last_heartbeat))::integer);
    end if;
    update public.academy_presence p set session_id=academy_record_presence.session_id,
      last_heartbeat=stamp, last_access_at=stamp, active=is_active where p.user_id=actor;
  end if;
  if is_active or seconds > 0 then
    insert into public.academy_engagement_daily(user_id,day) values(actor,today) on conflict do nothing;
  end if;
  if seconds > 0 then
    span_start := stamp-make_interval(secs=>seconds);
    midnight := today::timestamp at time zone 'America/Sao_Paulo';
    if span_start < midnight then
      prior_seconds := least(seconds, greatest(0, ceil(extract(epoch from midnight-span_start))::integer));
      insert into public.academy_engagement_daily(user_id,day,active_seconds) values(actor,today-1,prior_seconds)
        on conflict(user_id,day) do update set active_seconds=least(86400,academy_engagement_daily.active_seconds+excluded.active_seconds);
      seconds := seconds-prior_seconds;
    end if;
    update public.academy_engagement_daily d set active_seconds=least(86400,d.active_seconds+seconds) where d.user_id=actor and d.day=today;
  end if;
end;
$$;

create function public.academy_read_engagement(actor uuid, window_days integer default 7) returns jsonb
language plpgsql set search_path=public,pg_temp as $$
declare who public.academy_profiles; result jsonb; today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
begin
  select * into who from public.academy_profiles p where p.id=actor and p.status='active' and p.audience='internal';
  if not found or who.role not in ('admin','manager') then raise exception 'Acesso não autorizado'; end if;
  if window_days not in (7,30) or window_days is null then raise exception 'Período inválido'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId',p.id,'lastAccessAt',presence.last_access_at,
    'activeDays',(select count(*) from public.academy_engagement_daily d where d.user_id=p.id and d.day between today-window_days+1 and today),
    'activeSeconds',coalesce((select sum(d.active_seconds) from public.academy_engagement_daily d where d.user_id=p.id and d.day between today-window_days+1 and today),0),
    'daily',coalesce((select jsonb_agg(jsonb_build_object('date',d.day,'activeSeconds',d.active_seconds) order by d.day) from public.academy_engagement_daily d where d.user_id=p.id and d.day between today-window_days+1 and today),'[]'::jsonb)
  ) order by p.id),'[]'::jsonb) into result
  from public.academy_profiles p left join public.academy_presence presence on presence.user_id=p.id
  where p.id<>actor and p.status='active' and p.audience='internal' and
    (who.role='admin' or p.manager_id=actor or (p.manager_id is null and nullif(trim(who.department),'') is not null and lower(trim(p.department))=lower(trim(who.department))));
  return jsonb_build_object('windowDays',window_days,'collectedSince',(select collected_since from public.academy_engagement_config where id),
    'generatedAt',clock_timestamp(),'members',result);
end;
$$;

revoke execute on function public.academy_record_presence(uuid,uuid,boolean), public.academy_read_engagement(uuid,integer) from public, anon, authenticated;
grant execute on function public.academy_record_presence(uuid,uuid,boolean), public.academy_read_engagement(uuid,integer) to service_role;
commit;
