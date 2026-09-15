-- Executar uma vez no SQL Editor do projeto Supabase.
-- As tabelas não concedem acesso direto ao navegador. A API autentica o usuário
-- com Auth e aplica comandos restritos. Funções acessíveis apenas a service_role.
begin;
create table public.academy_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null, email text not null unique, department text not null default 'Geral',
 manager_id uuid references public.academy_profiles(id),
 role text not null default 'student' check(role in ('student','manager','admin')),
 status text not null default 'active' check(status in ('active','pending','inactive')),
 created_at timestamptz not null default now()
);
create table public.academy_resources (
 id text primary key, kind text not null check(kind in ('course','article')),
 published jsonb, draft jsonb, revision integer not null default 0,
 updated_at timestamptz not null default now()
);
create table public.academy_settings (
 id boolean primary key default true check(id),
 departments jsonb not null default '["Geral", "Comercial", "Financeiro"]',
 products jsonb not null default '["DOC-Windows", "DOC-MultiScan", "Conhecimentos gerais"]'
);
insert into public.academy_settings(id) values(true);
create table public.academy_progress (
 user_id uuid references public.academy_profiles(id) on delete cascade,
 course_id text references public.academy_resources(id), version integer not null,
 lesson_id text not null, done boolean not null default false,
 ranges jsonb not null default '[]', duration numeric not null default 0,
 updated_at timestamptz not null default now(),
 primary key(user_id,course_id,version,lesson_id)
);
create table public.academy_attempts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.academy_profiles(id),
 course_id text not null references public.academy_resources(id), version integer not null,
 snapshot jsonb not null, answers jsonb not null,
 status text not null default 'pending' check(status in ('pending','approved','retry')),
 score numeric check(score between 0 and 100), feedback text not null default '',
 retry_allowed boolean not null default false,
 submitted_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references public.academy_profiles(id)
);
create unique index academy_one_active_attempt on public.academy_attempts(user_id,course_id,version) where status in ('pending','approved');
create table public.academy_xp (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.academy_profiles(id),
 course_id text not null references public.academy_resources(id), amount integer not null check(amount>=0),
 season text not null, label text not null, created_at timestamptz not null default now(),
 unique(user_id,course_id)
);
create table public.academy_preferences (
 user_id uuid primary key references public.academy_profiles(id) on delete cascade,
 bookmarks jsonb not null default '[]', read_notices jsonb not null default '[]'
);
create table public.academy_audit (
 id bigint generated always as identity primary key, actor uuid references public.academy_profiles(id),
 action text not null, resource text, created_at timestamptz not null default now()
);
create index academy_progress_user on public.academy_progress(user_id);
create index academy_attempts_user on public.academy_attempts(user_id);
create index academy_profiles_manager on public.academy_profiles(manager_id);

alter table public.academy_profiles enable row level security;
alter table public.academy_resources enable row level security;
alter table public.academy_settings enable row level security;
alter table public.academy_progress enable row level security;
alter table public.academy_attempts enable row level security;
alter table public.academy_xp enable row level security;
alter table public.academy_preferences enable row level security;
alter table public.academy_audit enable row level security;
revoke all on public.academy_profiles, public.academy_resources, public.academy_settings,
 public.academy_progress, public.academy_attempts, public.academy_xp,
 public.academy_preferences, public.academy_audit from anon, authenticated;
grant all on public.academy_profiles, public.academy_resources, public.academy_settings,
 public.academy_progress, public.academy_attempts, public.academy_xp,
 public.academy_preferences, public.academy_audit to service_role;
grant usage, select on sequence public.academy_audit_id_seq to service_role;

create function public.academy_mutate(actor uuid, command jsonb) returns void
language plpgsql set search_path=public,pg_temp as $$
declare
 who public.academy_profiles; doc public.academy_resources; attempt public.academy_attempts;
 op text := command->>'type'; body jsonb; lesson jsonb; question jsonb; last_attempt public.academy_attempts;
 expected integer; approved boolean; final_score numeric; target uuid; old_name text; new_name text;
begin
 select * into who from public.academy_profiles where id=actor and status='active';
 if not found then raise exception 'Acesso não autorizado'; end if;
 if op in ('save-resource','review','unlock','profile','settings') and who.role <> 'admin' then raise exception 'Apenas administradores'; end if;

 if op='save-resource' then
  body := command->'data';
  insert into public.academy_resources(id,kind) values(body->>'id',command->>'kind') on conflict do nothing;
  select * into doc from public.academy_resources where id=body->>'id' for update;
  if doc.kind <> command->>'kind' then raise exception 'Tipo de conteúdo incompatível'; end if;
  if doc.revision <> (command->>'expectedVersion')::integer then raise exception 'Conteúdo atualizado por outra sessão. Reabra o editor.'; end if;
  if (command->>'publish')::boolean then
   body := body || jsonb_build_object('status','published',case when doc.kind='course' then 'version' else 'revision' end,doc.revision+1);
   update public.academy_resources set published=body,draft=null,revision=revision+1,updated_at=now() where id=doc.id;
  else
   update public.academy_resources set draft=body || jsonb_build_object('status','draft'),updated_at=now() where id=doc.id;
  end if;
 elsif op in ('complete','video','submit') then
  select * into doc from public.academy_resources where id=command->>'courseId' and kind='course' and published is not null for update;
  if not found then raise exception 'Curso não publicado'; end if;
  if doc.revision <> (command->>'version')::integer then raise exception 'O curso mudou. Atualize a página.'; end if;
  if op='submit' then
   for lesson in select value from jsonb_array_elements(doc.published->'lessons') loop
    if lesson->>'type'<>'quiz' and not exists(select 1 from public.academy_progress where user_id=actor and course_id=doc.id and version=doc.revision and lesson_id=lesson->>'id' and done) then raise exception 'Conclua todas as aulas antes da avaliação'; end if;
   end loop;
   if jsonb_array_length(doc.published->'questions')=0 then raise exception 'Avaliação sem questões'; end if;
   for question in select value from jsonb_array_elements(doc.published->'questions') loop
    if length(trim(coalesce(command->'answers'->>(question->>'id'),'')))=0 then raise exception 'Responda todas as questões'; end if;
    if question->>'type'='choice' and not (question->'options' ? (command->'answers'->>(question->>'id'))) then raise exception 'Alternativa inválida'; end if;
   end loop;
   select * into last_attempt from public.academy_attempts where user_id=actor and course_id=doc.id and version=doc.revision order by submitted_at desc limit 1;
   if found then
    if last_attempt.status in ('pending','approved') then raise exception 'Já existe uma avaliação enviada ou aprovada'; end if;
    if last_attempt.snapshot->>'retryPolicy'='admin' and not last_attempt.retry_allowed then raise exception 'Aguarde liberação do administrador'; end if;
   end if;
   insert into public.academy_attempts(user_id,course_id,version,snapshot,answers) values(actor,doc.id,doc.revision,doc.published,command->'answers');
  else
   select value into lesson from jsonb_array_elements(doc.published->'lessons') where value->>'id'=command->>'lessonId';
   if lesson is null or lesson->>'type'='quiz' then raise exception 'Atividade inválida'; end if;
   if op='complete' and lesson->>'type'<>'reading' then raise exception 'Assista ao vídeo para concluir'; end if;
   if op='video' and lesson->>'type'<>'video' then raise exception 'Vídeo inválido'; end if;
   insert into public.academy_progress(user_id,course_id,version,lesson_id,done,ranges,duration)
    values(actor,doc.id,doc.revision,lesson->>'id',case when op='complete' then true else (command->>'done')::boolean end,coalesce(command->'ranges','[]'),coalesce((command->>'duration')::numeric,0))
    on conflict(user_id,course_id,version,lesson_id) do update set done=academy_progress.done or excluded.done,ranges=excluded.ranges,duration=excluded.duration,updated_at=now();
  end if;
 elsif op='review' then
  select * into attempt from public.academy_attempts where id=(command->>'id')::uuid for update;
  if not found or attempt.status<>'pending' then raise exception 'Esta avaliação já foi corrigida ou não existe'; end if;
  final_score := (command->>'score')::numeric;
  if final_score is null or final_score<0 or final_score>100 or length(trim(command->>'feedback'))=0 then raise exception 'Informe nota válida e feedback'; end if;
  approved := final_score >= (attempt.snapshot->>'passingScore')::numeric;
  update public.academy_attempts set status=case when approved then 'approved' else 'retry' end,score=final_score,feedback=command->>'feedback',reviewed_at=now(),reviewed_by=actor where id=attempt.id;
  if approved then
   insert into public.academy_xp(user_id,course_id,amount,season,label) values(attempt.user_id,attempt.course_id,(attempt.snapshot->>'xp')::integer,to_char(now() at time zone 'America/Sao_Paulo','YYYY'),attempt.snapshot->>'title') on conflict(user_id,course_id) do nothing;
  elsif attempt.snapshot->>'retryPolicy'='review' then
   delete from public.academy_progress where user_id=attempt.user_id and course_id=attempt.course_id and version=attempt.version;
  end if;
 elsif op='unlock' then
  update public.academy_attempts set retry_allowed=true where id=(command->>'id')::uuid and status='retry';
 elsif op='preferences' then
  insert into public.academy_preferences(user_id,bookmarks,read_notices) values(actor,command->'bookmarks',command->'readNotices') on conflict(user_id) do update set bookmarks=excluded.bookmarks,read_notices=excluded.read_notices;
 elsif op='profile' then
  body:=command->'data'; target:=(body->>'id')::uuid;
  -- Não permite remover o próprio acesso administrativo por engano.
  if target=actor and (body->>'role'<>'admin' or body->>'status'<>'active') then raise exception 'Seu próprio acesso administrativo deve permanecer ativo'; end if;
  if nullif(body->>'managerId','') is not null and not exists(select 1 from public.academy_profiles where id=(body->>'managerId')::uuid and role in ('admin','manager') and status='active') then raise exception 'Gestor inválido'; end if;
  update public.academy_profiles set name=body->>'name',department=body->>'department',manager_id=nullif(body->>'managerId','')::uuid,role=body->>'role',status=body->>'status' where id=target;
  if not found then raise exception 'Usuário não encontrado'; end if;
 elsif op='settings' then
  old_name:=command->>'oldName'; new_name:=command->>'name';
  if command->>'kind'='departments' then
   update public.academy_settings set departments=case when old_name is null then departments || jsonb_build_array(new_name) else (select jsonb_agg(case when value=old_name then new_name else value end) from jsonb_array_elements_text(departments)) end;
   if old_name is not null then update public.academy_profiles set department=new_name where department=old_name; end if;
  else
   update public.academy_settings set products=case when old_name is null then products || jsonb_build_array(new_name) else (select jsonb_agg(case when value=old_name then new_name else value end) from jsonb_array_elements_text(products)) end;
   if old_name is not null then update public.academy_resources set published=case when published->>'product'=old_name then jsonb_set(published,'{product}',to_jsonb(new_name)) else published end,draft=case when draft->>'product'=old_name then jsonb_set(draft,'{product}',to_jsonb(new_name)) else draft end; end if;
  end if;
 else raise exception 'Comando desconhecido';
 end if;
 insert into public.academy_audit(actor,action,resource) values(actor,op,coalesce(command->>'courseId',command->>'id',command->'data'->>'id'));
end;
$$;
revoke all on function public.academy_mutate(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.academy_mutate(uuid,jsonb) to service_role;
commit;
