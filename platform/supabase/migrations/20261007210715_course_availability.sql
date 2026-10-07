begin;

alter table public.academy_resources add constraint academy_course_availability_valid check (
 kind <> 'course' or (
  (published is null or not (published ? 'availability') or coalesce(published->>'availability' in ('active','inactive','development'),false))
  and (draft is null or not (draft ? 'availability') or coalesce(draft->>'availability' in ('active','inactive','development'),false))
 )
);

create function public.academy_set_course_availability(actor uuid, command jsonb) returns void
language plpgsql set search_path=public,pg_temp as $$
declare
 doc public.academy_resources;
 next_availability text := command->>'availability';
 current_availability text;
begin
 if not exists (select 1 from public.academy_profiles where id=actor and role='admin' and status='active') then
  raise exception 'Apenas administradores podem alterar a disponibilidade';
 end if;
 if next_availability is null or next_availability not in ('active','inactive','development') then
  raise exception 'Disponibilidade inválida';
 end if;
 select * into doc from public.academy_resources where id=command->>'courseId' and kind='course' for update;
 if not found then raise exception 'Curso não encontrado'; end if;
 current_availability := coalesce(coalesce(doc.published,doc.draft)->>'availability',case when doc.published is null then 'development' else 'active' end);
 if doc.revision is distinct from (command->>'expectedVersion')::integer
  or current_availability is distinct from command->>'expectedAvailability' then
  raise exception 'Conteúdo atualizado por outra sessão. Reabra o editor.';
 end if;
 if next_availability='active' then
  if doc.published is null then raise exception 'Publique o curso pelo editor antes de ativá-lo'; end if;
  if not exists (select 1 from jsonb_array_elements(doc.published->'lessons') l where l->>'type' in ('video','reading')) then
   raise exception 'Adicione ao menos uma aula de vídeo ou leitura.';
  end if;
 end if;
 -- Availability does not create a new content edition or reset learner progress.
 update public.academy_resources set
  published=case when published is null then null else jsonb_set(published,'{availability}',to_jsonb(next_availability)) end,
  draft=case when draft is null then null else jsonb_set(draft,'{availability}',to_jsonb(next_availability)) end,
  updated_at=now() where id=doc.id;
 insert into public.academy_audit(actor,action,resource) values(actor,'course-availability:'||next_availability,doc.id);
end;
$$;
revoke all on function public.academy_set_course_availability(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.academy_set_course_availability(uuid,jsonb) to service_role;

-- Keep the existing audience/module gate and also reject unavailable courses.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.academy_course_allowed(uuid,jsonb)'::regprocedure) into definition;
 definition := replace(definition,
  'when p.id is null or p.status <> ''active''',
  'when coalesce(course->>''availability'',''active'') <> ''active'' or p.id is null or p.status <> ''active''');
 if definition not like '%course->>''availability''%' then raise exception 'Course availability gate was not installed'; end if;
 execute definition;
 -- A later legacy mutation replacement removed this gate for complete/submit.
 select pg_get_functiondef('public.academy_mutate(uuid,jsonb)'::regprocedure) into definition;
 if definition not like '%academy_course_allowed(actor,doc.published)%' then
  definition := replace(definition,
   'if not found then raise exception ''Curso não publicado''; end if;',
   'if not found then raise exception ''Curso não publicado''; end if; if not public.academy_course_allowed(actor,doc.published) then raise exception ''Curso não autorizado''; end if;');
  if definition not like '%academy_course_allowed(actor,doc.published)%' then raise exception 'Course mutation gate was not installed'; end if;
  execute definition;
 end if;
end $$;
commit;
