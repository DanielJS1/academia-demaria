-- Reconhecimentos de liderança também contam na temporada, sem curso associado.
alter table public.academy_xp alter column course_id drop not null;

create table public.academy_recognitions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.academy_profiles(id) on delete cascade,
 manager_id uuid not null references public.academy_profiles(id),
 title text not null check (char_length(trim(title)) between 3 and 120),
 message text not null check (char_length(trim(message)) between 5 and 2000),
 xp_id uuid not null unique references public.academy_xp(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index academy_recognitions_user on public.academy_recognitions(user_id, created_at desc);

create table public.academy_pdi_notes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.academy_profiles(id) on delete cascade,
 manager_id uuid not null references public.academy_profiles(id),
 content text not null check (char_length(trim(content)) between 3 and 2000),
 created_at timestamptz not null default now()
);
create index academy_pdi_notes_user on public.academy_pdi_notes(user_id, created_at desc);
alter table public.academy_recognitions enable row level security;
alter table public.academy_pdi_notes enable row level security;
revoke all on public.academy_recognitions, public.academy_pdi_notes from anon, authenticated;
grant all on public.academy_recognitions, public.academy_pdi_notes to service_role;

create function public.academy_grant_recognition(actor uuid, target uuid, recognition_title text, recognition_message text)
returns void language plpgsql security invoker as $$
declare reward_id uuid;
begin
 if not exists (
  select 1 from public.academy_profiles manager
  join public.academy_profiles member on member.id = target
  where manager.id = actor and manager.status = 'active' and manager.role in ('admin','manager')
    and member.status = 'active' and member.audience = 'internal' and member.id <> actor
    and (manager.role = 'admin' or member.manager_id = actor
      or (member.manager_id is null and lower(trim(member.department)) = lower(trim(manager.department))))
 ) then raise exception 'Colaborador fora da sua equipe ou inativo'; end if;
 if char_length(trim(recognition_title)) not between 3 and 120 or char_length(trim(recognition_message)) not between 5 and 2000
 then raise exception 'Preencha o título e a justificativa'; end if;
 insert into public.academy_xp(user_id, course_id, amount, season, label)
 values (target, null, 100, to_char(now() at time zone 'America/Sao_Paulo', 'YYYY'), trim(recognition_title))
 returning id into reward_id;
 insert into public.academy_recognitions(user_id, manager_id, title, message, xp_id)
 values (target, actor, trim(recognition_title), trim(recognition_message), reward_id);
 insert into public.academy_audit(actor, action, resource) values(actor, 'grant-recognition', target::text);
end $$;
revoke all on function public.academy_grant_recognition(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.academy_grant_recognition(uuid,uuid,text,text) to service_role;
