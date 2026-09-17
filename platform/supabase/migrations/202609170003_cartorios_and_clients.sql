begin;

create table if not exists public.academy_cartorios (
  id text primary key,
  name text not null,
  city text not null default '',
  uf text not null default 'SP',
  cns text,
  modules jsonb not null default '[]',
  key_user_id uuid references public.academy_profiles(id) on delete set null,
  key_user_name text,
  key_user_email text,
  status text not null default 'active' check(status in ('active','inactive')),
  created_at timestamptz not null default now()
);

alter table public.academy_profiles add column if not exists audience text not null default 'internal' check(audience in ('internal','client'));
alter table public.academy_profiles add column if not exists cartorio_id text references public.academy_cartorios(id) on delete set null;

alter table public.academy_cartorios enable row level security;
revoke all on public.academy_cartorios from anon, authenticated;
grant all on public.academy_cartorios to service_role;

commit;
