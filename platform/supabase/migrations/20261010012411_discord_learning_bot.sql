create table public.academy_discord_links (
 user_id uuid primary key references public.academy_profiles(id) on delete cascade,
 discord_id text not null unique check(discord_id ~ '^[0-9]{17,20}$'),
 guild_id text not null check(guild_id ~ '^[0-9]{17,20}$'), username text not null,
 enabled boolean not null default true, linked_at timestamptz not null default now(),
 last_attempt_day date, last_test_at timestamptz
);
create table public.academy_discord_codes (
 user_id uuid primary key references public.academy_profiles(id) on delete cascade,
 code_hash text not null unique check(code_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 used_at timestamptz
);
alter table public.academy_learning_notices
 add column discord_status text not null default 'disabled' check(discord_status in ('disabled','unlinked','pending','sending','sent','failed','blocked','cancelled','uncertain')),
 add column discord_error text,
 add column discord_sent_at timestamptz,
 add column discord_confirmed_at timestamptz,
 add column discord_lease_at timestamptz,
 add column discord_attempts integer not null default 0,
 add column discord_message_id text;
create index academy_notice_discord_queue on public.academy_learning_notices(created_at) where discord_status in ('pending','failed','unlinked');
alter table public.academy_discord_links enable row level security;
alter table public.academy_discord_codes enable row level security;
revoke all on public.academy_discord_links,public.academy_discord_codes from public,anon,authenticated;
grant all on public.academy_discord_links,public.academy_discord_codes to service_role;

create function public.academy_discord_mutate(actor uuid, command jsonb) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare who public.academy_profiles; code public.academy_discord_codes; op text:=command->>'type';
begin
 if op='consume' then
  select * into code from public.academy_discord_codes where code_hash=command->>'hash';
  if not found then raise exception 'Código inválido ou expirado'; end if;
  actor:=code.user_id;
 end if;
 select * into who from public.academy_profiles where id=actor and status='active' and audience='internal' for update;
 if not found then raise exception 'Acesso restrito a colaboradores ativos' using errcode='42501'; end if;
 if op='code' then
  if exists(select 1 from public.academy_discord_codes where user_id=actor and created_at>now()-interval '1 minute') then raise exception 'Aguarde um minuto para gerar outro código'; end if;
  insert into public.academy_discord_codes(user_id,code_hash,expires_at) values(actor,command->>'hash',now()+interval '10 minutes')
   on conflict(user_id) do update set code_hash=excluded.code_hash,created_at=now(),expires_at=excluded.expires_at,used_at=null;
 elsif op='consume' then
  select * into code from public.academy_discord_codes where user_id=actor for update;
  if code.code_hash<>command->>'hash' or code.used_at is not null or code.expires_at<=now() then raise exception 'Código inválido ou expirado'; end if;
  if exists(select 1 from public.academy_discord_links where discord_id=command->>'discordId' and user_id<>actor) then raise exception 'Esta conta do Discord já está vinculada'; end if;
  insert into public.academy_discord_links(user_id,discord_id,guild_id,username) values(actor,command->>'discordId',command->>'guildId',left(command->>'username',100))
   on conflict(user_id) do update set discord_id=excluded.discord_id,guild_id=excluded.guild_id,username=excluded.username,enabled=true,linked_at=now();
  update public.academy_discord_codes set used_at=now() where user_id=actor;
 elsif op='test' then
  update public.academy_discord_links set last_test_at=now() where user_id=actor and (last_test_at is null or last_test_at<now()-interval '1 minute');
  if not found then raise exception 'Vincule sua conta ou aguarde um minuto antes de testar novamente'; end if;
 elsif op='unlink' then
  delete from public.academy_discord_links where user_id=actor;
  delete from public.academy_discord_codes where user_id=actor;
 elsif op='preference' then
  update public.academy_discord_links set enabled=(command->>'enabled')::boolean where user_id=actor;
 elsif op='ack' then
  update public.academy_learning_notices set discord_confirmed_at=coalesce(discord_confirmed_at,now())
   where id=(command->>'id')::uuid and user_id=actor and discord_status='sent';
  if not found then raise exception 'Aviso indisponível' using errcode='42501'; end if;
 else raise exception 'Comando inválido'; end if;
 return jsonb_build_object('saved',true);
end $$;
revoke all on function public.academy_discord_mutate(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.academy_discord_mutate(uuid,jsonb) to service_role;
