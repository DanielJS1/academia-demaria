-- Normaliza cursos publicados e rascunhos sem alterar destaque (required),
-- revisão, progresso ou snapshots históricos de avaliações.
begin;
update public.academy_resources
set published = jsonb_set(published, '{level}', to_jsonb(case lower(btrim(published->>'level'))
  when 'essencial' then 'essencial'
  when 'intermediário' then 'recomendado'
  when 'intermediario' then 'recomendado'
  when 'recomendado' then 'recomendado'
  when 'avançado' then 'facultativo'
  when 'avancado' then 'facultativo'
  when 'facultativo' then 'facultativo'
  else published->>'level'
end))
where kind = 'course' and published is not null and published->>'level' is not null;

update public.academy_resources
set draft = jsonb_set(draft, '{level}', to_jsonb(case lower(btrim(draft->>'level'))
  when 'essencial' then 'essencial'
  when 'intermediário' then 'recomendado'
  when 'intermediario' then 'recomendado'
  when 'recomendado' then 'recomendado'
  when 'avançado' then 'facultativo'
  when 'avancado' then 'facultativo'
  when 'facultativo' then 'facultativo'
  else draft->>'level'
end))
where kind = 'course' and draft is not null and draft->>'level' is not null;

-- Falha atomicamente se houver classificações desconhecidas, sem descartá-las.
alter table public.academy_resources
  add constraint academy_course_published_level check (
    kind <> 'course' or published is null or
    coalesce(published->>'level' in ('essencial', 'recomendado', 'facultativo'), false)
  ),
  add constraint academy_course_draft_level check (
    kind <> 'course' or draft is null or
    coalesce(draft->>'level' in ('essencial', 'recomendado', 'facultativo'), false)
  );
commit;
