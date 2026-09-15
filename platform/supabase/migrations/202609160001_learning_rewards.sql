begin;

update public.academy_settings set departments = '["Diretoria","Ouvidoria","Gestão de Pessoas","Financeiro","Comercial","Desenvolvimento WIN","Desenvolvimento WEB","Controle de Qualidade","UX&UI","Implantações","Suporte técnico","Setor de Treinamentos"]';

-- Preserve historical rewards; new events use stable keys to prevent repeat XP.
alter table public.academy_xp add column event_key text not null default 'legacy';
alter table public.academy_xp drop constraint academy_xp_user_id_course_id_key;
alter table public.academy_xp add constraint academy_xp_event_unique unique(user_id,course_id,event_key);
alter table public.academy_attempts add column correct_text_ids jsonb not null default '[]';

alter table public.academy_profiles drop constraint academy_profiles_manager_id_fkey;
alter table public.academy_profiles add foreign key(manager_id) references public.academy_profiles(id) on delete set null;
alter table public.academy_attempts drop constraint academy_attempts_user_id_fkey;
alter table public.academy_attempts add foreign key(user_id) references public.academy_profiles(id) on delete cascade;
alter table public.academy_attempts drop constraint academy_attempts_reviewed_by_fkey;
alter table public.academy_attempts add foreign key(reviewed_by) references public.academy_profiles(id) on delete set null;
alter table public.academy_xp drop constraint academy_xp_user_id_fkey;
alter table public.academy_xp add foreign key(user_id) references public.academy_profiles(id) on delete cascade;
alter table public.academy_audit drop constraint academy_audit_actor_fkey;
alter table public.academy_audit add foreign key(actor) references public.academy_profiles(id) on delete set null;

create function public.academy_reject_user(actor uuid, target uuid) returns void
language plpgsql set search_path=public,pg_temp as $$
begin
 if actor=target or not exists(select 1 from academy_profiles where id=actor and role='admin' and status='active') then raise exception 'Apenas administradores podem reprovar outro cadastro'; end if;
 update academy_profiles set status='inactive' where id=target and status='pending';
 if not found then raise exception 'Este cadastro não está pendente'; end if;
 insert into academy_audit(actor,action,resource) values(actor,'reject-user',target::text);
end;
$$;
revoke all on function public.academy_reject_user(uuid,uuid) from public,anon,authenticated;
grant execute on function public.academy_reject_user(uuid,uuid) to service_role;

create function public.academy_award_xp(learner uuid, course text, event text, points integer, description text) returns void
language plpgsql set search_path=public,pg_temp as $$
begin
 -- Courses paid under the former rule keep their existing XP without a second payout.
 if exists(select 1 from academy_xp where user_id=learner and course_id=course and event_key='legacy') then return; end if;
 insert into academy_xp(user_id,course_id,event_key,amount,season,label)
 values(learner,course,event,points,to_char(now() at time zone 'America/Sao_Paulo','YYYY'),description)
 on conflict(user_id,course_id,event_key) do nothing;
end;
$$;
revoke all on function public.academy_award_xp(uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.academy_award_xp(uuid,text,text,integer,text) to service_role;

-- The command function below is replaced transactionally with the new XP rules.

create or replace function public.academy_mutate(actor uuid, command jsonb) returns void
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
  if op in ('complete','video') and exists(select 1 from academy_progress where user_id=actor and course_id=doc.id and version=doc.revision and lesson_id=lesson->>'id' and done) then
   perform academy_award_xp(actor,doc.id,'lesson:'||(lesson->>'id'),10+5*greatest(1,ceil((lesson->>'minutes')::numeric/5)::integer),'Aula concluída · '||(lesson->>'title'));
   if jsonb_array_length(doc.published->'questions')=0 and not exists(
    select 1 from jsonb_array_elements(doc.published->'lessons') l where l->>'type'<>'quiz' and not exists(
     select 1 from academy_progress p where p.user_id=actor and p.course_id=doc.id and p.version=doc.revision and p.lesson_id=l->>'id' and p.done
    )
   ) then perform academy_award_xp(actor,doc.id,'completion',30,'Curso concluído · '||(doc.published->>'title')); end if;
  end if;
 elsif op='review' then
  select * into attempt from public.academy_attempts where id=(command->>'id')::uuid for update;
  if not found or attempt.status<>'pending' then raise exception 'Esta avaliação já foi corrigida ou não existe'; end if;
  final_score := (command->>'score')::numeric;
  if final_score is null or final_score<0 or final_score>100 or length(trim(command->>'feedback'))=0 then raise exception 'Informe nota válida e feedback'; end if;
  approved := final_score >= (attempt.snapshot->>'passingScore')::numeric;
  update public.academy_attempts set status=case when approved then 'approved' else 'retry' end,score=final_score,feedback=command->>'feedback',reviewed_at=now(),reviewed_by=actor where id=attempt.id;
  update academy_attempts set correct_text_ids=coalesce(command->'correctTextIds','[]') where id=attempt.id;
  for question in select value from jsonb_array_elements(attempt.snapshot->'questions') loop
   if (question->>'type'='choice' and attempt.answers->>(question->>'id')=question->>'correct')
      or (question->>'type'='text' and coalesce(command->'correctTextIds','[]') ? (question->>'id')) then
    perform academy_award_xp(attempt.user_id,attempt.course_id,'question:'||(question->>'id'),case when question->>'type'='choice' then 5 else 8 end,'Acerto · '||(attempt.snapshot->>'title'));
   end if;
  end loop;
  if approved then
   perform academy_award_xp(attempt.user_id,attempt.course_id,'approval',case when exists(select 1 from academy_attempts where user_id=attempt.user_id and course_id=attempt.course_id and status='retry') then 10 else 30 end,'Avaliação aprovada · '||(attempt.snapshot->>'title'));
   perform academy_award_xp(attempt.user_id,attempt.course_id,'completion',30,'Curso concluído · '||(attempt.snapshot->>'title'));
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
