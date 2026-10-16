-- Video delivery stays with YouTube. Only metadata and the Academy chat live here.
create table public.academy_live_events (
  id uuid primary key default gen_random_uuid(),
  document jsonb not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (document->>'status' in ('draft','scheduled','live','processing','recorded','cancelled')),
  check (document->>'audience' in ('internal','client','both'))
);
create index academy_live_events_status on public.academy_live_events ((document->>'status'), (document->>'audience'));
create table public.academy_live_messages (
  id uuid primary key,
  seq bigint generated always as identity unique,
  event_id uuid not null references public.academy_live_events(id) on delete cascade,
  author_id uuid not null references public.academy_profiles(id),
  author_name text not null,
  author_role text not null,
  content text not null check (length(content) <= 1000),
  created_at timestamptz not null default now(),
  removed boolean not null default false,
  pinned boolean not null default false
);
create index academy_live_messages_history on public.academy_live_messages (event_id, seq desc);
create index academy_live_messages_rate on public.academy_live_messages (author_id, created_at desc);
create unique index academy_live_one_pin on public.academy_live_messages (event_id) where pinned;
create table public.academy_home_highlights (
  id text primary key check (id = 'home'),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 8),
  version integer not null default 1
);
alter table public.academy_live_events enable row level security;
alter table public.academy_live_messages enable row level security;
alter table public.academy_home_highlights enable row level security;
revoke all on public.academy_live_events, public.academy_live_messages, public.academy_home_highlights from anon, authenticated;
grant all on public.academy_live_events, public.academy_live_messages, public.academy_home_highlights to service_role;
grant usage, select on sequence public.academy_live_messages_seq_seq to service_role;
grant select on public.academy_live_events, public.academy_live_messages to authenticated;

-- Narrow helpers live outside the exposed schema; no profile data is returned.
create schema if not exists academy_live_private;
revoke all on schema academy_live_private from public;
grant usage on schema academy_live_private to authenticated;
create function academy_live_private.can_read(document jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.academy_profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
    and (p.audience <> 'client' or exists (
      select 1 from public.academy_cartorios c where c.id = p.cartorio_id and c.status = 'active'
    ))
    and (
      p.role = 'admin' or (
        document->>'status' not in ('draft','cancelled')
        and document->>'audience' in ('both', coalesce(p.audience, 'internal'))
      )
    )
  );
$$;
revoke all on function academy_live_private.can_read(jsonb) from public, anon;
grant execute on function academy_live_private.can_read(jsonb) to authenticated;
create policy academy_live_events_read on public.academy_live_events for select to authenticated
  using (academy_live_private.can_read(document));
create policy academy_live_messages_read on public.academy_live_messages for select to authenticated
  using (exists (
    select 1 from public.academy_live_events e where e.id = event_id
  ));

-- Invoker functions are executable only by the server's service role.
create function public.academy_save_live_event(actor uuid, payload jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  target uuid := coalesce(nullif(payload->>'id','')::uuid, gen_random_uuid());
  previous public.academy_live_events;
  doc jsonb := payload - 'id' - 'version' - 'startedAt' - 'endedAt';
  expected integer := coalesce((payload->>'version')::integer, 0);
  result public.academy_live_events;
  before_status text;
  next_status text := payload->>'status';
begin
  if not exists(select 1 from public.academy_profiles where id=actor and role='admin' and status='active') then
    raise exception 'Apenas administradores podem gerenciar aulas ao vivo';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target::text, 0));
  select * into previous from public.academy_live_events where id=target for update;
  if (previous.id is null and expected <> 0) or (previous.id is not null and previous.version <> expected) then
    raise exception 'Conteúdo alterado em outra sessão' using errcode='40001';
  end if;
  before_status := coalesce(previous.document->>'status','draft');
  if not (
    (before_status='draft' and next_status in ('draft','scheduled','cancelled')) or
    (before_status='scheduled' and next_status in ('scheduled','draft','live','cancelled')) or
    (before_status='live' and next_status in ('live','processing')) or
    (before_status='processing' and next_status in ('processing','live','recorded')) or
    (before_status='recorded' and next_status in ('recorded','processing')) or
    (before_status='cancelled' and next_status in ('cancelled','draft','scheduled'))
  ) then raise exception 'Etapa inválida para esta aula'; end if;
  if before_status='live' and doc->>'youtubeUrl' <> previous.document->>'youtubeUrl' then
    raise exception 'Encerre a transmissão antes de trocar o vídeo';
  end if;
  doc := doc || jsonb_build_object(
    'startedAt', case when next_status='live' and before_status<>'live' then to_jsonb(now()) else coalesce(previous.document->'startedAt','null'::jsonb) end,
    'endedAt', case when next_status='processing' and before_status='live' then to_jsonb(now()) else coalesce(previous.document->'endedAt','null'::jsonb) end
  );
  insert into public.academy_live_events(id,document,version) values(target,doc,1)
  on conflict(id) do update set document=excluded.document, version=academy_live_events.version+1, updated_at=now()
  returning * into result;
  return to_jsonb(result);
end;
$$;

create function public.academy_save_home_highlights(actor uuid, payload jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare current_version integer; result public.academy_home_highlights;
begin
  if not exists(select 1 from public.academy_profiles where id=actor and role='admin' and status='active') then
    raise exception 'Apenas administradores podem gerenciar destaques';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('academy_home_highlights', 0));
  select version into current_version from public.academy_home_highlights where id='home' for update;
  if coalesce(current_version,0) <> coalesce((payload->>'version')::integer,0) then
    raise exception 'Conteúdo alterado em outra sessão' using errcode='40001';
  end if;
  insert into public.academy_home_highlights(id,items,version) values('home',payload->'items',1)
  on conflict(id) do update set items=excluded.items,version=academy_home_highlights.version+1 returning * into result;
  return jsonb_build_object('items',result.items,'version',result.version);
end;
$$;

create function public.academy_live_chat(actor uuid, event uuid, payload jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  who public.academy_profiles;
  lesson public.academy_live_events;
  result public.academy_live_messages;
  action text := payload->>'action';
  message_id uuid := (payload->>'id')::uuid;
  body text := btrim(payload->>'content');
begin
  select * into who from public.academy_profiles where id=actor and status='active';
  if who.id is null then raise exception 'Acesso não autorizado'; end if;
  select * into lesson from public.academy_live_events where id=event for share;
  if lesson.id is null then raise exception 'Aula não encontrada'; end if;
  if who.audience='client' and not exists(select 1 from public.academy_cartorios where id=who.cartorio_id and status='active') then
    raise exception 'Cartório inativo';
  end if;
  if who.role<>'admin' and (lesson.document->>'status' in ('draft','cancelled') or lesson.document->>'audience' not in ('both',coalesce(who.audience,'internal'))) then
    raise exception 'Esta aula não está disponível para seu perfil';
  end if;
  if action='send' then
    -- Lock per sender across instances: concurrent requests cannot bypass slow mode.
    perform pg_advisory_xact_lock(hashtextextended(actor::text, 1));
    select * into result from public.academy_live_messages where id=message_id and author_id=actor and event_id=event;
    if result.id is not null then return to_jsonb(result); end if;
    if lesson.document->>'status'<>'live' or not coalesce((lesson.document->>'chatEnabled')::boolean,false) then
      raise exception 'O chat está fechado';
    end if;
    if body is null or length(body)<1 or length(body)>1000 then raise exception 'Mensagem inválida'; end if;
    if exists(select 1 from public.academy_live_messages where author_id=actor and created_at>now()-interval '3 seconds') then
      raise exception 'Aguarde 3 segundos antes de enviar outra mensagem';
    end if;
    insert into public.academy_live_messages(id,event_id,author_id,author_name,author_role,content)
      values(message_id,event,actor,who.name,who.role,body) returning * into result;
  else
    if who.role<>'admin' then raise exception 'Apenas administradores podem moderar o chat'; end if;
    perform pg_advisory_xact_lock(hashtextextended(event::text, 2));
    if action='pin' then
      if (payload->>'pinned')::boolean then
        update public.academy_live_messages set pinned=false where event_id=event and pinned;
      end if;
      update public.academy_live_messages set pinned=(payload->>'pinned')::boolean
        where id=message_id and event_id=event and not removed returning * into result;
    elsif action='remove' then
      update public.academy_live_messages set removed=true,content='',pinned=false
        where id=message_id and event_id=event returning * into result;
    else raise exception 'Ação inválida'; end if;
    if result.id is null then raise exception 'Mensagem não encontrada'; end if;
  end if;
  return to_jsonb(result);
end;
$$;
revoke all on function public.academy_save_live_event(uuid,jsonb), public.academy_save_home_highlights(uuid,jsonb), public.academy_live_chat(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.academy_save_live_event(uuid,jsonb), public.academy_save_home_highlights(uuid,jsonb), public.academy_live_chat(uuid,uuid,jsonb) to service_role;

-- Only these two read-protected tables need replication. Soft moderation uses UPDATE.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.academy_live_events, public.academy_live_messages;
  end if;
end;
$$;
