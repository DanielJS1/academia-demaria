begin;
create table public.academy_lesson_notes (
 user_id uuid not null references public.academy_profiles(id) on delete cascade,
 course_id text not null references public.academy_resources(id) on delete cascade,
 lesson_id text not null,
 content text not null check (char_length(content) <= 10000),
 updated_at timestamptz not null default now(),
 primary key(user_id,course_id,lesson_id)
);
create index academy_lesson_notes_course on public.academy_lesson_notes(user_id,course_id);
alter table public.academy_lesson_notes enable row level security;
revoke all on public.academy_lesson_notes from anon,authenticated;
grant all on public.academy_lesson_notes to service_role;
commit;
