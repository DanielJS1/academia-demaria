begin;
create table public.academy_trails (
 id uuid primary key, owner_id uuid not null references public.academy_profiles(id),
 data jsonb not null, revision integer not null default 1 check(revision>0), created_at timestamptz not null default now()
);
create table public.academy_trail_assignments (
 id uuid primary key default gen_random_uuid(), trail_id uuid not null references public.academy_trails(id),
 user_id uuid not null references public.academy_profiles(id) on delete cascade,
 assigned_by uuid not null references public.academy_profiles(id), title text not null, course_ids jsonb not null,
 due_date date not null, learner_days integer not null check(learner_days between 0 and 365),
 manager_days integer not null check(manager_days between 0 and 365), active boolean not null default true,
 revision integer not null default 1, created_at timestamptz not null default now()
);
create unique index academy_trail_active_assignment on public.academy_trail_assignments(trail_id,user_id) where active;
create index academy_trail_assignment_user on public.academy_trail_assignments(user_id);
create table public.academy_trail_policies (
 owner_id uuid primary key references public.academy_profiles(id) on delete cascade,
 data jsonb not null, revision integer not null default 1, updated_at timestamptz not null default now()
);
create table public.academy_learning_notices (
 id uuid primary key default gen_random_uuid(), dedupe_key text not null unique,
 user_id uuid not null references public.academy_profiles(id) on delete cascade,
 subject_id uuid not null references public.academy_profiles(id) on delete cascade,
 assignment_id uuid references public.academy_trail_assignments(id) on delete cascade,
 kind text not null, title text not null, message text not null, link text not null,
 popup boolean not null default true, seen_at timestamptz, resolved_at timestamptz, created_at timestamptz not null default now(),
 email_status text not null default 'disabled' check(email_status in ('disabled','pending','sending','sent','failed','cancelled','uncertain')),
 email_error text, email_sent_at timestamptz, email_lease_at timestamptz, email_attempts integer not null default 0
);
create index academy_learning_notice_recipient on public.academy_learning_notices(user_id,created_at desc);
create index academy_learning_notice_pending on public.academy_learning_notices(created_at) where email_status='pending';
create table public.academy_trail_requests (
 request_id uuid primary key, actor uuid not null references public.academy_profiles(id), command jsonb not null, created_at timestamptz not null default now()
);
alter table public.academy_trails enable row level security;
alter table public.academy_trail_assignments enable row level security;
alter table public.academy_trail_policies enable row level security;
alter table public.academy_learning_notices enable row level security;
alter table public.academy_trail_requests enable row level security;
revoke all on public.academy_trails,public.academy_trail_assignments,public.academy_trail_policies,public.academy_learning_notices,public.academy_trail_requests from public,anon,authenticated;
grant all on public.academy_trails,public.academy_trail_assignments,public.academy_trail_policies,public.academy_learning_notices,public.academy_trail_requests to service_role;

create function public.academy_trail_mutate(actor uuid, command jsonb) returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
declare who public.academy_profiles; t public.academy_trails; a public.academy_trail_assignments;
 target uuid; operation text:=command->>'type'; version integer; request uuid;
begin
 select * into who from public.academy_profiles p where p.id=actor and p.status='active' and p.audience='internal';
 if not found then raise exception 'Acesso não autorizado'; end if;
 if operation='ack' then
  update public.academy_learning_notices n set seen_at=coalesce(seen_at,now()) where n.id=(command->>'id')::uuid and n.user_id=actor;
  if not found then raise exception 'Aviso não autorizado'; end if;
  return;
 end if;
 if who.role not in ('admin','manager') then raise exception 'Somente a gestão pode executar esta ação'; end if;
 -- Serialize each actor's creates and policies; revisions protect shared edits.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,8316));
 if operation in ('assign','announce') then
  request:=(command->>'requestId')::uuid;
  if exists(select 1 from public.academy_trail_requests r where r.request_id=request) then
   if not exists(select 1 from public.academy_trail_requests r where r.request_id=request and r.actor=academy_trail_mutate.actor) then raise exception 'Solicitação inválida'; end if;
   if not exists(select 1 from public.academy_trail_requests r where r.request_id=request and r.command=academy_trail_mutate.command) then raise exception 'Solicitação já utilizada com outro conteúdo'; end if;
   return;
  end if;
  for target in select distinct value::uuid from jsonb_array_elements_text(command->'userIds') loop
   if not exists(select 1 from public.academy_profiles p where p.id=target and p.status='active' and p.audience='internal' and
    (who.role='admin' or p.manager_id=actor or (p.manager_id is null and nullif(trim(who.department),'') is not null and lower(trim(p.department))=lower(trim(who.department))))) then
    raise exception 'Colaborador fora da sua equipe ou inativo';
   end if;
  end loop;
  insert into public.academy_trail_requests values(request,actor,command,now());
 end if;
 if operation='save' then
  select * into t from public.academy_trails where id=(command->'trail'->>'id')::uuid for update;
  if found then
   if t.owner_id<>actor and who.role<>'admin' then raise exception 'Trilha de outro gestor'; end if;
   if t.revision<>(command->>'expectedRevision')::integer then raise exception 'A trilha foi alterada. Atualize a página'; end if;
  elsif (command->>'expectedRevision')::integer<>0 then raise exception 'Trilha inexistente'; end if;
  if jsonb_array_length(command->'trail'->'courseIds')=0 or exists(
   select 1 from jsonb_array_elements_text(command->'trail'->'courseIds') c(id) where not exists(
    select 1 from public.academy_resources r where r.id=c.id and r.kind='course' and r.published->>'status'='published'
    and coalesce(r.published->>'availability','active')='active' and coalesce(r.published->>'audience','internal')<>'client')) then raise exception 'A trilha contém curso indisponível'; end if;
  insert into public.academy_trails(id,owner_id,data) values((command->'trail'->>'id')::uuid,actor,command->'trail')
   on conflict(id) do update set data=excluded.data,revision=academy_trails.revision+1;
 elsif operation='assign' then
  select * into t from public.academy_trails where id=(command->>'trailId')::uuid for share;
  if not found or not (t.data->>'active')::boolean then raise exception 'Trilha indisponível'; end if;
  if exists(select 1 from jsonb_array_elements_text(t.data->'courseIds') c(id) where not exists(select 1 from public.academy_resources r where r.id=c.id and r.kind='course' and r.published->>'status'='published' and coalesce(r.published->>'availability','active')='active' and coalesce(r.published->>'audience','internal')<>'client')) then raise exception 'A trilha contém curso indisponível'; end if;
  for target in select distinct value::uuid from jsonb_array_elements_text(command->'userIds') loop
   insert into public.academy_trail_assignments(trail_id,user_id,assigned_by,title,course_ids,due_date,learner_days,manager_days)
   values(t.id,target,actor,t.data->>'title',t.data->'courseIds',(command->>'dueDate')::date,(command->>'learnerDays')::integer,(command->>'managerDays')::integer);
  end loop;
 elsif operation='assignment' then
  select * into a from public.academy_trail_assignments where id=(command->>'id')::uuid for update;
  if not found then raise exception 'Atribuição inexistente'; end if;
  if not exists(select 1 from public.academy_profiles p where p.id=a.user_id and p.status='active' and p.audience='internal' and
   (who.role='admin' or p.manager_id=actor or (p.manager_id is null and nullif(trim(who.department),'') is not null and lower(trim(p.department))=lower(trim(who.department))))) then raise exception 'Atribuição fora da sua equipe'; end if;
  if a.revision<>(command->>'expectedRevision')::integer then raise exception 'A atribuição foi alterada. Atualize a página'; end if;
  update public.academy_trail_assignments set due_date=(command->>'dueDate')::date,learner_days=(command->>'learnerDays')::integer,manager_days=(command->>'managerDays')::integer,active=(command->>'active')::boolean,revision=revision+1 where id=a.id;
  update public.academy_learning_notices set resolved_at=now(),email_status=case when email_status in ('pending','failed') then 'cancelled' else email_status end where assignment_id=a.id and resolved_at is null;
 elsif operation='policy' then
  select revision into version from public.academy_trail_policies where owner_id=actor for update;
  if coalesce(version,0)<>(command->>'expectedRevision')::integer then raise exception 'Configuração alterada. Atualize a página'; end if;
  insert into public.academy_trail_policies(owner_id,data) values(actor,command->'policy') on conflict(owner_id) do update set data=excluded.data,revision=academy_trail_policies.revision+1,updated_at=now();
 elsif operation='announce' then
  for target in select distinct value::uuid from jsonb_array_elements_text(command->'userIds') loop
   insert into public.academy_learning_notices(dedupe_key,user_id,subject_id,kind,title,message,link,popup)
    values(request::text||':'||target::text,target,target,'manual',command->>'title',command->>'message','/aprender/trilhas',(command->>'popup')::boolean);
  end loop;
 else raise exception 'Comando inválido'; end if;
 insert into public.academy_audit(actor,action,resource) values(actor,'trail-'||operation,coalesce(command->>'id',command->>'trailId',command->'trail'->>'id'));
end;
$$;
revoke all on function public.academy_trail_mutate(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.academy_trail_mutate(uuid,jsonb) to service_role;
commit;
