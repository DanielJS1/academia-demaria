begin;
alter table academy_attempts add column quiz_id text not null default '';
update academy_attempts set quiz_id=coalesce((select l->>'id' from jsonb_array_elements(snapshot->'lessons') l where l->>'type'='quiz' limit 1),'legacy');
update academy_attempts set snapshot=snapshot||jsonb_build_object('quizId',quiz_id);
drop index academy_one_active_attempt;
create unique index academy_one_active_attempt on academy_attempts(user_id,course_id,version,quiz_id) where status in ('pending','approved');

-- Preserve the existing course assessment in the first assessment activity.
create function public.academy_activity_format(body jsonb) returns jsonb
language sql immutable set search_path=public,pg_temp as $$
 select case when body is null then null else body || jsonb_build_object('questions','[]'::jsonb,'lessons',coalesce((
  select jsonb_agg(case when l->>'type'='quiz' then l||jsonb_build_object('questions',coalesce(l->'questions',case when l->>'id'=(select x->>'id' from jsonb_array_elements(body->'lessons') x where x->>'type'='quiz' limit 1) then body->'questions' else '[]'::jsonb end,'[]'::jsonb)) else l end order by n)
  from jsonb_array_elements(body->'lessons') with ordinality as a(l,n)
 ),'[]'::jsonb)) end;
$$;
update academy_resources set published=academy_activity_format(published),draft=academy_activity_format(draft) where kind='course';
revoke all on function academy_activity_format(jsonb) from public,anon,authenticated;
grant execute on function academy_activity_format(jsonb) to service_role;

update academy_xp x set event_key='approval:'||coalesce((select l->>'id' from academy_resources r cross join lateral jsonb_array_elements(r.published->'lessons') l where r.id=x.course_id and l->>'type'='quiz' limit 1),'legacy') where event_key='approval';

create function public.academy_course_completed(learner uuid, course text, revision integer) returns boolean
language sql stable set search_path=public,pg_temp as $$
 select exists(select 1 from academy_resources r where r.id=$2 and r.revision=$3 and r.published is not null
  and jsonb_array_length(r.published->'lessons')>0
  and not exists(select 1 from jsonb_array_elements(r.published->'lessons') l where
   (l->>'type'='quiz' and not exists(select 1 from academy_attempts a where a.user_id=$1 and a.course_id=$2 and a.version=$3 and a.quiz_id=l->>'id' and a.status='approved'))
   or (l->>'type'<>'quiz' and not exists(select 1 from academy_progress p where p.user_id=$1 and p.course_id=$2 and p.version=$3 and p.lesson_id=l->>'id' and p.done))
  ));
$$;
revoke all on function academy_course_completed(uuid,text,integer) from public,anon,authenticated;
grant execute on function academy_course_completed(uuid,text,integer) to service_role;

create or replace function public.academy_mutate(actor uuid, command jsonb) returns void
language plpgsql set search_path=public,pg_temp as $$
declare
 who public.academy_profiles; doc public.academy_resources; attempt public.academy_attempts;
 op text := command->>'type'; body jsonb; lesson jsonb; question jsonb; last_attempt public.academy_attempts;
 expected integer; approved boolean; final_score numeric; target uuid; old_name text; new_name text; quiz text; quiz_position bigint; previous_quiz bigint; assessment jsonb;
begin
 select * into who from public.academy_profiles where id=actor and status='active';
 if not found then raise exception 'Acesso não autorizado'; end if;
 if op in ('save-resource','review','unlock','profile','settings') and who.role <> 'admin' then raise exception 'Apenas administradores'; end if;

 if op='save-resource' then
  body := case when command->>'kind'='course' then academy_activity_format(command->'data') else command->'data' end;
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
   quiz:=coalesce(command->>'quizId',(select l->>'id' from jsonb_array_elements(doc.published->'lessons') l where l->>'type'='quiz' limit 1));
   select l,n into lesson,quiz_position from jsonb_array_elements(doc.published->'lessons') with ordinality a(l,n) where l->>'id'=quiz and l->>'type'='quiz';
   if lesson is null then raise exception 'Avaliação não encontrada'; end if;
   assessment:=doc.published||jsonb_build_object('questions',coalesce(lesson->'questions','[]'::jsonb),'quizId',quiz,'title',(doc.published->>'title')||' · '||(lesson->>'title'));
   if jsonb_array_length(assessment->'questions')=0 then raise exception 'Avaliação sem questões'; end if;
   for lesson in select l from jsonb_array_elements(doc.published->'lessons') with ordinality a(l,n) where n<quiz_position loop
    if lesson->>'type'<>'quiz' and not exists(select 1 from academy_progress where user_id=actor and course_id=doc.id and version=doc.revision and lesson_id=lesson->>'id' and done) then raise exception 'Conclua as aulas anteriores antes da avaliação'; end if;
    if lesson->>'type'='quiz' and not exists(select 1 from academy_attempts where user_id=actor and course_id=doc.id and version=doc.revision and quiz_id=lesson->>'id' and status='approved') then raise exception 'Aguarde aprovação da avaliação anterior'; end if;
   end loop;
   for question in select value from jsonb_array_elements(assessment->'questions') loop
    if length(trim(coalesce(command->'answers'->>(question->>'id'),'')))=0 then raise exception 'Responda todas as questões'; end if;
    if question->>'type'='choice' and not (question->'options' ? (command->'answers'->>(question->>'id'))) then raise exception 'Alternativa inválida'; end if;
   end loop;
   select * into last_attempt from academy_attempts where user_id=actor and course_id=doc.id and version=doc.revision and quiz_id=quiz order by submitted_at desc limit 1;
   if found then
    if last_attempt.status in ('pending','approved') then raise exception 'Já existe uma avaliação enviada ou aprovada'; end if;
    if last_attempt.snapshot->>'retryPolicy'='admin' and not last_attempt.retry_allowed then raise exception 'Aguarde liberação do administrador'; end if;
   end if;
   insert into public.academy_attempts(user_id,course_id,version,quiz_id,snapshot,answers) values(actor,doc.id,doc.revision,quiz,assessment,command->'answers');
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
   if academy_course_completed(actor,doc.id,doc.revision) then perform academy_award_xp(actor,doc.id,'completion',30,'Curso concluído · '||(doc.published->>'title')); end if;
  end if;
 elsif op='review' then
  perform 1 from academy_resources where id=(select course_id from academy_attempts where id=(command->>'id')::uuid) for update;
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
   perform academy_award_xp(attempt.user_id,attempt.course_id,'approval:'||attempt.quiz_id,case when exists(select 1 from academy_attempts where user_id=attempt.user_id and course_id=attempt.course_id and quiz_id=attempt.quiz_id and status='retry') then 10 else 30 end,'Avaliação aprovada · '||(attempt.snapshot->>'title'));
   if academy_course_completed(attempt.user_id,attempt.course_id,attempt.version) then perform academy_award_xp(attempt.user_id,attempt.course_id,'completion',30,'Curso concluído · '||(attempt.snapshot->>'title')); end if;
  elsif attempt.snapshot->>'retryPolicy'='review' then
   select n into quiz_position from jsonb_array_elements(attempt.snapshot->'lessons') with ordinality a(l,n) where l->>'id'=attempt.quiz_id;
   select coalesce(max(n),0) into previous_quiz from jsonb_array_elements(attempt.snapshot->'lessons') with ordinality a(l,n) where l->>'type'='quiz' and n<quiz_position;
   delete from academy_progress where user_id=attempt.user_id and course_id=attempt.course_id and version=attempt.version and lesson_id in (select l->>'id' from jsonb_array_elements(attempt.snapshot->'lessons') with ordinality a(l,n) where n>previous_quiz and n<quiz_position);
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
