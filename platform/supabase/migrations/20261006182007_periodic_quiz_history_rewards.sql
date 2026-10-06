begin;

-- Snapshot backfill must see a consistent set of legacy attempts/questions.
lock table public.academy_quizzes, public.academy_quiz_questions, public.academy_quiz_attempts in share row exclusive mode;
alter table public.academy_quizzes add column revision integer not null default 1 check (revision > 0);
create index academy_quiz_attempts_quiz on public.academy_quiz_attempts(quiz_id);
alter table public.academy_quiz_attempts
 add column snapshot jsonb,
 add column question_count integer check (question_count between 2 and 30),
 add column correct_count integer check (correct_count between 0 and question_count),
 add column passing_score_snapshot integer check (passing_score_snapshot between 0 and 100),
 add column xp_reward_snapshot integer check (xp_reward_snapshot between 0 and 500),
 add column quiz_revision integer,
 add column scoring_version integer not null default 1,
 add column snapshot_status text not null default 'unavailable' check (snapshot_status in ('complete','unavailable'));

create function public.academy_periodic_quiz_snapshot(quiz uuid)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('id',q.id,'title',q.title,'description',q.description,'category',q.category,
  'xp_reward',q.xp_reward,'passing_score',q.passing_score,'revision',q.revision,'target_audience',q.target_audience,
  'questions',coalesce((select jsonb_agg(jsonb_build_object('id',qq.id,'prompt',qq.prompt,'options',qq.options,
   'correct_option_id',qq.correct_option_id,'explanation',qq.explanation,'image_url',qq.image_url,'image_alt',qq.image_alt)
   order by qq.order_index) from public.academy_quiz_questions qq where qq.quiz_id=q.id),'[]'::jsonb))
 from public.academy_quizzes q where q.id=quiz;
$$;

do $$
declare a record; s jsonb; n integer; c integer; invalid_count integer := 0;
begin
 for a in select qa.*,q.passing_score,q.xp_reward,q.revision from public.academy_quiz_attempts qa
  join public.academy_quizzes q on q.id=qa.quiz_id loop
  s := public.academy_periodic_quiz_snapshot(a.quiz_id);
  n := jsonb_array_length(s->'questions');
  select count(*) filter(where a.answers->>(question->>'id')=question->>'correct_option_id')
   into c from jsonb_array_elements(s->'questions') question;
  if n between 2 and 30 and (select count(*) from jsonb_object_keys(a.answers))=n
   and not exists(select 1 from jsonb_array_elements(s->'questions') question
    where jsonb_array_length(question->'options') not between 2 and 6
     or (select count(distinct option->>'id') from jsonb_array_elements(question->'options') option) <> jsonb_array_length(question->'options')
     or not exists(select 1 from jsonb_array_elements(question->'options') option where option->>'id'=question->>'correct_option_id')
     or exists(select 1 from jsonb_array_elements(question->'options') option
      where coalesce(option->>'id','') !~ '^[a-z0-9_-]{1,12}$' or char_length(trim(coalesce(option->>'text',''))) not between 1 and 500))
   and not exists(select 1 from jsonb_array_elements(s->'questions') question where not exists(
    select 1 from jsonb_array_elements(question->'options') option where option->>'id'=a.answers->>(question->>'id')))
   and a.score_percentage=round(100.0*c/nullif(n,0),2)
   and a.passed=(c*100 >= a.passing_score*n)
   and a.xp_granted=(case when a.passed then a.xp_reward else 0 end) then
   update public.academy_quiz_attempts set snapshot=s,question_count=n,correct_count=c,
    passing_score_snapshot=a.passing_score,xp_reward_snapshot=a.xp_reward,quiz_revision=a.revision,
    snapshot_status='complete' where id=a.id;
  else invalid_count := invalid_count+1;
  end if;
 end loop;
 if invalid_count > 0 then raise warning '% legacy quiz attempts could not be reconstructed; original score/pass/XP preserved',invalid_count; end if;
end;
$$;

create function public.academy_periodic_quiz_public_snapshot(snapshot jsonb)
returns jsonb language sql immutable security invoker set search_path=public,pg_temp as $$
 select (snapshot - 'questions' - 'target_audience') || jsonb_build_object('questions',coalesce(
  (select jsonb_agg(q - 'correct_option_id' - 'explanation' order by position)
   from jsonb_array_elements(snapshot->'questions') with ordinality as items(q,position)),'[]'::jsonb));
$$;

create function public.academy_periodic_quiz_result(attempt public.academy_quiz_attempts, replayed boolean)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('attemptId',attempt.id,'scorePercentage',attempt.score_percentage,'passed',attempt.passed,
  'xpGranted',attempt.xp_granted,'newlyGrantedXp',case when replayed then 0 else attempt.xp_granted end,
  'correctCount',attempt.correct_count,'questionCount',attempt.question_count,'passingScore',attempt.passing_score_snapshot,
  'xpReward',attempt.xp_reward_snapshot,'revision',attempt.quiz_revision,'scoringVersion',attempt.scoring_version,
  'completedAt',attempt.completed_at,'replayed',replayed,'reviewAvailable',attempt.snapshot_status='complete',
  'results',coalesce((select jsonb_agg(jsonb_build_object('questionId',q->>'id',
   'selectedOptionId',attempt.answers->>(q->>'id'),'correctOptionId',q->>'correct_option_id',
   'correct',attempt.answers->>(q->>'id')=q->>'correct_option_id','explanation',q->>'explanation') order by position)
   from jsonb_array_elements(attempt.snapshot->'questions') with ordinality as items(q,position)),'[]'::jsonb));
$$;

create or replace function public.academy_save_periodic_quiz(actor uuid, payload jsonb)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 v_quiz_id uuid := nullif(payload->>'id','')::uuid;
 current_quiz public.academy_quizzes;
 question jsonb; question_index integer := 0;
 v_questions jsonb := '[]'::jsonb; stored_questions jsonb;
 audience text := payload->>'targetAudience';
 featured boolean := (payload->>'isFeatured')::boolean;
 has_attempts boolean;
begin
 if not exists(select 1 from public.academy_profiles p where p.id=actor and p.status='active'
  and p.role='admin' and coalesce(p.audience,'internal')='internal') then
  raise exception 'Perfil não autorizado' using detail='QUIZ_FORBIDDEN'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or jsonb_typeof(payload->'questions') is distinct from 'array'
  or jsonb_array_length(payload->'questions') not between 2 and 30
  or trim(coalesce(payload->>'title',''))='' or trim(coalesce(payload->>'slug',''))=''
  or coalesce((payload->>'xpReward')::integer,-1) not between 0 and 500
  or coalesce((payload->>'passingScore')::integer,-1) not between 0 and 100
  or coalesce(payload->>'periodType','') not in ('weekly','biweekly','monthly')
  or coalesce(audience,'') not in ('internal','client')
  or (payload->>'expiresAt') is not null and (payload->>'expiresAt')::timestamptz <= (payload->>'availableFrom')::timestamptz
 then raise exception 'Dados inválidos' using detail='QUIZ_INVALID_DATA'; end if;
 -- Serialize admin saves before acquiring quiz locks (featured changes touch another quiz).
 perform pg_advisory_xact_lock(hashtext('academy-periodic-quiz-admin'));
 if v_quiz_id is not null then
  select * into current_quiz from public.academy_quizzes q where q.id=v_quiz_id and q.deleted_at is null for update;
  if not found then raise exception 'Desafio não encontrado' using detail='QUIZ_NOT_FOUND'; end if;
  if (payload->>'expectedRevision')::integer is distinct from current_quiz.revision then
   raise exception 'Configuração alterada' using detail='QUIZ_REVISION_CONFLICT'; end if;
  select exists(select 1 from public.academy_quiz_attempts a where a.quiz_id=v_quiz_id) into has_attempts;
 end if;
 for question in select value from jsonb_array_elements(payload->'questions') loop
  if jsonb_typeof(question->'options') is distinct from 'array' or jsonb_array_length(question->'options') not between 2 and 6
   or not exists(select 1 from jsonb_array_elements(question->'options') o where o->>'id'=question->>'correctOptionId')
   or (select count(distinct o->>'id') from jsonb_array_elements(question->'options') o) <> jsonb_array_length(question->'options')
  then raise exception 'Alternativas inválidas' using detail='QUIZ_INVALID_QUESTIONS'; end if;
  v_questions := v_questions || jsonb_build_array(jsonb_build_object('id',coalesce(nullif(question->>'id','')::uuid,gen_random_uuid()),
   'prompt',trim(question->>'prompt'),'options',question->'options','correct_option_id',question->>'correctOptionId',
   'explanation',trim(question->>'explanation'),'image_url',nullif(question->>'imageUrl',''),'image_alt',nullif(question->>'imageAlt','')));
 end loop;
 if (select count(distinct q->>'id') from jsonb_array_elements(v_questions) q) <> jsonb_array_length(v_questions)
  or exists(select 1 from jsonb_array_elements(v_questions) q join public.academy_quiz_questions old on old.id=(q->>'id')::uuid
   where old.quiz_id is distinct from v_quiz_id) then
  raise exception 'Perguntas inválidas' using detail='QUIZ_INVALID_QUESTIONS'; end if;
 if v_quiz_id is not null then
  stored_questions := public.academy_periodic_quiz_snapshot(v_quiz_id)->'questions';
  if has_attempts and (audience<>current_quiz.target_audience or v_questions is distinct from stored_questions) then
   raise exception 'Perguntas, gabarito e público bloqueados' using detail='QUIZ_CONTENT_LOCKED'; end if;
 end if;
 if featured then
  update public.academy_quizzes q set is_featured=false,updated_at=now(),revision=q.revision+1
   where q.target_audience=audience and q.is_featured and q.id is distinct from v_quiz_id;
 end if;
 if v_quiz_id is null then
  insert into public.academy_quizzes(title,slug,description,category,xp_reward,passing_score,period_type,is_active,is_featured,available_from,expires_at,target_audience)
   values(trim(payload->>'title'),trim(payload->>'slug'),coalesce(payload->>'description',''),payload->>'category',
    (payload->>'xpReward')::integer,(payload->>'passingScore')::integer,payload->>'periodType',(payload->>'isActive')::boolean,featured,
    (payload->>'availableFrom')::timestamptz,nullif(payload->>'expiresAt','')::timestamptz,audience) returning id into v_quiz_id;
 else
  update public.academy_quizzes q set title=trim(payload->>'title'),slug=trim(payload->>'slug'),description=coalesce(payload->>'description',''),
   category=payload->>'category',xp_reward=(payload->>'xpReward')::integer,passing_score=(payload->>'passingScore')::integer,
   period_type=payload->>'periodType',is_active=(payload->>'isActive')::boolean,is_featured=featured,
   available_from=(payload->>'availableFrom')::timestamptz,expires_at=nullif(payload->>'expiresAt','')::timestamptz,
   target_audience=audience,updated_at=now(),revision=q.revision+1 where q.id=v_quiz_id;
 end if;
 if stored_questions is distinct from v_questions then
  -- Reserve a disjoint ordering range before reordering; keep UUIDs for retained questions.
  update public.academy_quiz_questions q set order_index=q.order_index+100 where q.quiz_id=v_quiz_id;
  delete from public.academy_quiz_questions q where q.quiz_id=v_quiz_id
   and not exists(select 1 from jsonb_array_elements(v_questions) item where (item->>'id')::uuid=q.id);
  for question in select value from jsonb_array_elements(v_questions) loop
   insert into public.academy_quiz_questions(id,quiz_id,order_index,prompt,options,correct_option_id,explanation,image_url,image_alt)
    values((question->>'id')::uuid,v_quiz_id,question_index,question->>'prompt',question->'options',question->>'correct_option_id',
     question->>'explanation',question->>'image_url',question->>'image_alt')
    on conflict(id) do update set order_index=excluded.order_index,prompt=excluded.prompt,options=excluded.options,
     correct_option_id=excluded.correct_option_id,explanation=excluded.explanation,image_url=excluded.image_url,image_alt=excluded.image_alt;
   question_index := question_index+1;
  end loop;
 end if;
 return v_quiz_id;
end;
$$;

drop function public.academy_submit_periodic_quiz(uuid,uuid,jsonb);
create function public.academy_submit_periodic_quiz(actor uuid, quiz uuid, submitted_answers jsonb, expected_revision integer default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare q public.academy_quizzes; a public.academy_quiz_attempts; n integer; c integer; score numeric(5,2); did_pass boolean; reward integer;
begin
 if not exists(select 1 from public.academy_profiles p where p.id=actor and p.status='active') then
  raise exception 'Perfil não autorizado' using detail='QUIZ_FORBIDDEN'; end if;
 select * into q from public.academy_quizzes where id=quiz for update;
 if not found or not exists(select 1 from public.academy_profiles p where p.id=actor and coalesce(p.audience,'internal')=q.target_audience) then
  raise exception 'Desafio indisponível' using detail='QUIZ_NOT_FOUND'; end if;
 select * into a from public.academy_quiz_attempts qa where qa.quiz_id=quiz and qa.user_id=actor;
 if found then return public.academy_periodic_quiz_result(a,true); end if;
 if q.deleted_at is not null or not q.is_active or q.available_from>now() or (q.expires_at is not null and q.expires_at<=now()) then
  raise exception 'Desafio indisponível' using detail='QUIZ_NOT_FOUND'; end if;
 if expected_revision is distinct from q.revision then
  raise exception 'Configuração alterada' using detail='QUIZ_REVISION_CONFLICT'; end if;
 if jsonb_typeof(submitted_answers) is distinct from 'object' then raise exception 'Respostas inválidas' using detail='QUIZ_INVALID_ANSWERS'; end if;
 select count(*) into n from public.academy_quiz_questions qq where qq.quiz_id=quiz;
 if n not between 2 and 30 or (select count(*) from jsonb_object_keys(submitted_answers))<>n
  or exists(select 1 from public.academy_quiz_questions qq where qq.quiz_id=quiz and not exists(
   select 1 from jsonb_array_elements(qq.options) option where option->>'id'=submitted_answers->>qq.id::text)) then
  raise exception 'Respostas incompletas ou inválidas' using detail='QUIZ_INVALID_ANSWERS'; end if;
 select count(*) filter(where submitted_answers->>qq.id::text=qq.correct_option_id) into c from public.academy_quiz_questions qq where qq.quiz_id=quiz;
 score := round(100.0*c/n,2); did_pass := c*100>=q.passing_score*n;
 reward := case when did_pass then q.xp_reward else least(2*c,q.xp_reward) end;
 insert into public.academy_quiz_attempts(user_id,quiz_id,score_percentage,answers,passed,xp_granted,snapshot,question_count,correct_count,
  passing_score_snapshot,xp_reward_snapshot,quiz_revision,scoring_version,snapshot_status)
 values(actor,quiz,score,submitted_answers,did_pass,reward,public.academy_periodic_quiz_snapshot(quiz),n,c,q.passing_score,q.xp_reward,q.revision,2,'complete') returning * into a;
 if reward>0 then
  insert into public.academy_xp(user_id,course_id,event_key,amount,season,label)
   values(actor,null,'quiz:'||quiz::text,reward,to_char(now() at time zone 'America/Sao_Paulo','YYYY'),'Desafio · '||q.title);
 end if;
 return public.academy_periodic_quiz_result(a,false);
end;
$$;

drop function public.academy_set_periodic_quiz_active(uuid,uuid,boolean);
create function public.academy_set_periodic_quiz_active(actor uuid, quiz uuid, active boolean, expected_revision integer default null)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare q public.academy_quizzes;
begin
 if not exists(select 1 from public.academy_profiles p where p.id=actor and p.status='active' and p.role='admin' and coalesce(p.audience,'internal')='internal') then
  raise exception 'Perfil não autorizado' using detail='QUIZ_FORBIDDEN'; end if;
 select * into q from public.academy_quizzes where id=quiz and deleted_at is null for update;
 if not found then raise exception 'Desafio não encontrado' using detail='QUIZ_NOT_FOUND'; end if;
 if expected_revision is distinct from q.revision then raise exception 'Configuração alterada' using detail='QUIZ_REVISION_CONFLICT'; end if;
 update public.academy_quizzes set is_active=active,updated_at=now(),revision=revision+1 where id=quiz;
end;
$$;

drop function public.academy_delete_periodic_quiz(uuid,uuid);
create function public.academy_delete_periodic_quiz(actor uuid, quiz uuid, expected_revision integer default null)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare q public.academy_quizzes;
begin
 if not exists(select 1 from public.academy_profiles p where p.id=actor and p.status='active' and p.role='admin' and coalesce(p.audience,'internal')='internal') then
  raise exception 'Perfil não autorizado' using detail='QUIZ_FORBIDDEN'; end if;
 select * into q from public.academy_quizzes where id=quiz and deleted_at is null for update;
 if not found then raise exception 'Desafio não encontrado' using detail='QUIZ_NOT_FOUND'; end if;
 if expected_revision is distinct from q.revision then raise exception 'Configuração alterada' using detail='QUIZ_REVISION_CONFLICT'; end if;
 update public.academy_quizzes set deleted_at=now(),is_active=false,is_featured=false,updated_at=now(),revision=revision+1 where id=quiz;
end;
$$;

create function public.academy_read_periodic_quiz(actor uuid, quiz uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare q public.academy_quizzes; a public.academy_quiz_attempts;
begin
 if not exists(select 1 from public.academy_profiles p where p.id=actor and p.status='active') then
  raise exception 'Perfil não autorizado' using detail='QUIZ_FORBIDDEN'; end if;
 select * into q from public.academy_quizzes where id=quiz for share;
 if not found or not exists(select 1 from public.academy_profiles p where p.id=actor and coalesce(p.audience,'internal')=q.target_audience) then
  raise exception 'Desafio indisponível' using detail='QUIZ_NOT_FOUND'; end if;
 select * into a from public.academy_quiz_attempts qa where qa.quiz_id=quiz and qa.user_id=actor;
 if found then return jsonb_build_object('quiz',case when a.snapshot_status='complete' then public.academy_periodic_quiz_public_snapshot(a.snapshot) else null end,
  'result',public.academy_periodic_quiz_result(a,true)); end if;
 if q.deleted_at is not null or not q.is_active or q.available_from>now() or (q.expires_at is not null and q.expires_at<=now()) then
  raise exception 'Desafio indisponível' using detail='QUIZ_NOT_FOUND'; end if;
 return jsonb_build_object('quiz',public.academy_periodic_quiz_public_snapshot(public.academy_periodic_quiz_snapshot(quiz)),'result',null);
end;
$$;

create function public.academy_list_periodic_quizzes(actor uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare audience text; available jsonb; completed jsonb;
begin
 select coalesce(p.audience,'internal') into audience from public.academy_profiles p where p.id=actor and p.status='active';
 if not found then raise exception 'Perfil não autorizado' using detail='QUIZ_FORBIDDEN'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'title',q.title,'description',q.description,'category',q.category,
  'xp_reward',q.xp_reward,'passing_score',q.passing_score,'revision',q.revision,'period_type',q.period_type,'is_featured',q.is_featured,
  'available_from',q.available_from,'expires_at',q.expires_at,'questionCount',counts.n,
  'requiredCorrect',ceil(counts.n*q.passing_score/100.0)) order by q.is_featured desc,q.available_from desc),'[]'::jsonb)
 into available from public.academy_quizzes q cross join lateral(select count(*) as n from public.academy_quiz_questions qq where qq.quiz_id=q.id) counts
 where q.target_audience=audience and q.is_active and q.deleted_at is null and q.available_from<=now()
  and (q.expires_at is null or q.expires_at>now()) and counts.n between 2 and 30
  and not exists(select 1 from public.academy_quiz_attempts qa where qa.user_id=actor and qa.quiz_id=q.id);
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'title',coalesce(a.snapshot->>'title',q.title),
  'result',public.academy_periodic_quiz_result(a,true)-'results') order by a.completed_at desc),'[]'::jsonb)
 into completed from public.academy_quiz_attempts a join public.academy_quizzes q on q.id=a.quiz_id where a.user_id=actor and q.target_audience=audience;
 return jsonb_build_object('available',available,'completed',completed);
end;
$$;

revoke all on function public.academy_periodic_quiz_snapshot(uuid), public.academy_periodic_quiz_public_snapshot(jsonb),
 public.academy_periodic_quiz_result(public.academy_quiz_attempts,boolean), public.academy_save_periodic_quiz(uuid,jsonb),
 public.academy_submit_periodic_quiz(uuid,uuid,jsonb,integer),public.academy_set_periodic_quiz_active(uuid,uuid,boolean,integer),
 public.academy_delete_periodic_quiz(uuid,uuid,integer),public.academy_read_periodic_quiz(uuid,uuid),public.academy_list_periodic_quizzes(uuid)
 from public,anon,authenticated;
grant execute on function public.academy_periodic_quiz_snapshot(uuid), public.academy_periodic_quiz_public_snapshot(jsonb),
 public.academy_periodic_quiz_result(public.academy_quiz_attempts,boolean), public.academy_save_periodic_quiz(uuid,jsonb),
 public.academy_submit_periodic_quiz(uuid,uuid,jsonb,integer),public.academy_set_periodic_quiz_active(uuid,uuid,boolean,integer),
 public.academy_delete_periodic_quiz(uuid,uuid,integer),public.academy_read_periodic_quiz(uuid,uuid),public.academy_list_periodic_quizzes(uuid)
 to service_role;

notify pgrst, 'reload schema';
commit;
