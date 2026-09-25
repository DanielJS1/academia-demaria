begin;

alter table public.academy_quizzes add column if not exists is_featured boolean not null default false;
create unique index if not exists academy_quizzes_one_featured_per_audience
 on public.academy_quizzes(target_audience) where is_featured;

create or replace function public.academy_save_periodic_quiz(actor uuid, payload jsonb)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 quiz_id uuid := nullif(payload->>'id','')::uuid;
 question jsonb;
 question_index integer := 0;
 audience text := payload->>'targetAudience';
 featured boolean := (payload->>'isFeatured')::boolean;
begin
 if not exists(select 1 from public.academy_profiles p where p.id=actor and p.status='active'
   and p.role='admin' and coalesce(p.audience,'internal')='internal') then
  raise exception 'Apenas administradores internos podem editar desafios';
 end if;
 if jsonb_typeof(payload) is distinct from 'object'
   or jsonb_typeof(payload->'questions') is distinct from 'array'
   or jsonb_array_length(payload->'questions') not between 2 and 30
   or trim(coalesce(payload->>'title','')) = ''
   or trim(coalesce(payload->>'slug','')) = ''
   or (payload->>'xpReward')::integer not between 0 and 500
   or (payload->>'passingScore')::integer not between 0 and 100
   or payload->>'periodType' not in ('weekly','biweekly','monthly')
   or audience not in ('internal','client')
   or (payload->>'expiresAt') is not null and (payload->>'expiresAt')::timestamptz <= (payload->>'availableFrom')::timestamptz
 then raise exception 'Dados do desafio inválidos'; end if;
 if quiz_id is not null then
  perform 1 from public.academy_quizzes where id=quiz_id for update;
  if not found then raise exception 'Desafio não encontrado'; end if;
  if exists(select 1 from public.academy_quiz_attempts where academy_quiz_attempts.quiz_id=academy_save_periodic_quiz.quiz_id) then
   raise exception 'Desafio já respondido: crie uma nova edição para alterar perguntas';
  end if;
 end if;
 if featured then
  update public.academy_quizzes set is_featured=false, updated_at=now()
  where target_audience=audience and is_featured and (quiz_id is null or id<>quiz_id);
 end if;
 if quiz_id is null then
  insert into public.academy_quizzes(title,slug,description,category,xp_reward,passing_score,period_type,
    is_active,is_featured,available_from,expires_at,target_audience)
  values(trim(payload->>'title'),trim(payload->>'slug'),coalesce(payload->>'description',''),payload->>'category',
    (payload->>'xpReward')::integer,(payload->>'passingScore')::integer,payload->>'periodType',
    (payload->>'isActive')::boolean,featured,(payload->>'availableFrom')::timestamptz,
    nullif(payload->>'expiresAt','')::timestamptz,audience)
  returning id into quiz_id;
 else
  update public.academy_quizzes set title=trim(payload->>'title'),slug=trim(payload->>'slug'),
    description=coalesce(payload->>'description',''),category=payload->>'category',
    xp_reward=(payload->>'xpReward')::integer,passing_score=(payload->>'passingScore')::integer,
    period_type=payload->>'periodType',is_active=(payload->>'isActive')::boolean,
    is_featured=featured,available_from=(payload->>'availableFrom')::timestamptz,
    expires_at=nullif(payload->>'expiresAt','')::timestamptz,target_audience=audience,updated_at=now()
  where id=quiz_id;
  delete from public.academy_quiz_questions where academy_quiz_questions.quiz_id=academy_save_periodic_quiz.quiz_id;
 end if;
 for question in select value from jsonb_array_elements(payload->'questions') loop
  if jsonb_typeof(question->'options') is distinct from 'array'
    or jsonb_array_length(question->'options') not between 2 and 6
    or not exists(select 1 from jsonb_array_elements(question->'options') option
      where option->>'id'=question->>'correctOptionId')
    or (select count(distinct option->>'id') from jsonb_array_elements(question->'options') option)
       <> jsonb_array_length(question->'options')
  then raise exception 'Alternativas ou gabarito inválidos'; end if;
  insert into public.academy_quiz_questions(quiz_id,order_index,prompt,options,correct_option_id,explanation,image_url,image_alt)
  values(quiz_id,question_index,trim(question->>'prompt'),question->'options',
    question->>'correctOptionId',trim(question->>'explanation'),nullif(question->>'imageUrl',''),nullif(question->>'imageAlt',''));
  question_index := question_index + 1;
 end loop;
 return quiz_id;
end;
$$;
revoke all on function public.academy_save_periodic_quiz(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.academy_save_periodic_quiz(uuid,jsonb) to service_role;

create or replace function public.academy_set_periodic_quiz_active(actor uuid, quiz uuid, active boolean)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.academy_profiles p where p.id=actor and p.status='active'
   and p.role='admin' and coalesce(p.audience,'internal')='internal') then
  raise exception 'Apenas administradores internos podem editar desafios';
 end if;
 update public.academy_quizzes set is_active=active, updated_at=now() where id=quiz;
 if not found then raise exception 'Desafio não encontrado'; end if;
end;
$$;
revoke all on function public.academy_set_periodic_quiz_active(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.academy_set_periodic_quiz_active(uuid,uuid,boolean) to service_role;

commit;
