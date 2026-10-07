begin;

create table public.academy_technical_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null check (char_length(btrim(description)) between 10 and 600),
  topic text not null check (char_length(btrim(topic)) between 2 and 80),
  kind text not null check (kind in ('manual', 'video')),
  pdf_path text unique,
  video_url text,
  created_by uuid references public.academy_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint technical_material_source check (
    (kind = 'manual' and pdf_path ~ '^technical/pdf/[a-f0-9-]+\.pdf$' and video_url is null)
    or (kind = 'video' and video_url ~ '^https://(www\.)?(player\.)?vimeo\.com/' and pdf_path is null)
  )
);

create index academy_technical_materials_topic on public.academy_technical_materials(topic, created_at desc);
alter table public.academy_technical_materials enable row level security;
revoke all on public.academy_technical_materials from public, anon, authenticated;
grant all on public.academy_technical_materials to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('academy-technical-pdfs', 'academy-technical-pdfs', false, 31457280, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

commit;
