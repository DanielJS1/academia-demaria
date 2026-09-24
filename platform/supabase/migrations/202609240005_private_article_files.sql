begin;
-- Close the legacy mixed bucket, including documents uploaded before this migration.
update storage.buckets set public = false where id = 'academy-articles';
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
 ('academy-article-images','academy-article-images',true,5242880,array['image/png','image/jpeg','image/webp']),
 ('academy-article-files','academy-article-files',false,10485760,array['application/pdf','application/sql','text/plain','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- The service role bypasses RLS, so mutation authorization must also live in the RPC.
create or replace function public.academy_course_allowed(actor uuid, course jsonb) returns boolean
language sql stable set search_path=public,pg_temp as $$
 select coalesce((select case
  when p.id is null or p.status <> 'active' or coalesce(course->>'status','') <> 'published' then false
  when coalesce(p.audience,'internal') = 'internal' then coalesce(course->>'audience','internal') <> 'client'
  else coalesce(course->>'audience','internal') <> 'internal'
   and c.id is not null and c.status = 'active'
   and (jsonb_array_length(coalesce(course->'requiredModules','[]'::jsonb)) = 0
    or exists (select 1 from jsonb_array_elements_text(coalesce(course->'requiredModules','[]'::jsonb)) m
      where c.modules ? m.value))
 end
 from public.academy_profiles p
 left join public.academy_cartorios c on c.id=p.cartorio_id
 where p.id=actor),false);
$$;
revoke all on function public.academy_course_allowed(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.academy_course_allowed(uuid,jsonb) to service_role;

-- Preserve the current mutation implementation while adding a database-side gate.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.academy_mutate(uuid,jsonb)'::regprocedure) into definition;
 definition := replace(definition,
  'if not found then raise exception ''Curso não publicado''; end if;',
  'if not found then raise exception ''Curso não publicado''; end if; if not public.academy_course_allowed(actor,doc.published) then raise exception ''Curso não autorizado''; end if;');
 if definition not like '%academy_course_allowed(actor,doc.published)%' then raise exception 'academy_mutate layout changed; authorization gate was not installed'; end if;
 execute definition;
end $$;
commit;
