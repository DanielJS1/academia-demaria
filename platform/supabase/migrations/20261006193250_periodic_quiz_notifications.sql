begin;

alter table public.academy_preferences
 add column quiz_notifications_enabled boolean not null default false,
 add column quiz_notifications_since timestamptz;
alter table public.academy_quizzes add column announcement_at timestamptz;
-- Legacy activation history is unavailable. Grandfather past editions, including paused ones,
-- at their existing dates; an old draft needing a fresh announcement must become a new edition.
update public.academy_quizzes set announcement_at = case
 when available_from <= now() then least(now(),greatest(created_at,available_from))
 when is_active then available_from else null end
where deleted_at is null;
create index academy_quizzes_announcements on public.academy_quizzes(target_audience,announcement_at)
 where is_active and deleted_at is null;

-- Shared by save/activation/deletion RPCs without replacing their revision/snapshot logic.
create function public.academy_periodic_quiz_announcement()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and old.announcement_at <= now() then
  if new.target_audience is distinct from old.target_audience then
   raise exception 'Público publicado bloqueado' using detail='QUIZ_AUDIENCE_LOCKED'; end if;
  new.announcement_at := old.announcement_at;
 elsif new.is_active and new.deleted_at is null then
  new.announcement_at := greatest(now(),new.available_from);
 else new.announcement_at := null;
 end if;
 return new;
end;
$$;
create trigger academy_periodic_quiz_announcement before insert or update on public.academy_quizzes
 for each row execute function public.academy_periodic_quiz_announcement();

create function public.academy_set_quiz_notifications(actor uuid, enabled boolean)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 perform 1 from public.academy_profiles p where p.id=actor and p.status='active' for share;
 if not found then raise exception 'Perfil não autorizado' using detail='QUIZ_FORBIDDEN'; end if;
 if enabled is null then raise exception 'Preferência inválida' using detail='QUIZ_INVALID_DATA'; end if;
 insert into public.academy_preferences(user_id,quiz_notifications_enabled,quiz_notifications_since)
 values(actor,enabled,case when enabled then clock_timestamp() else null end)
 on conflict(user_id) do update set quiz_notifications_enabled=excluded.quiz_notifications_enabled,
  quiz_notifications_since=case when excluded.quiz_notifications_enabled then
   case when academy_preferences.quiz_notifications_enabled then academy_preferences.quiz_notifications_since
    else clock_timestamp() end else null end;
end;
$$;

create function public.academy_read_quiz_notifications(actor uuid)
returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare audience text; pref public.academy_preferences; notices jsonb;
begin
 select coalesce(p.audience,'internal') into audience from public.academy_profiles p where p.id=actor and p.status='active';
 if not found then raise exception 'Perfil não autorizado' using detail='QUIZ_FORBIDDEN'; end if;
 select * into pref from public.academy_preferences p where p.user_id=actor;
 select coalesce(jsonb_agg(jsonb_build_object('id','quiz-published:'||q.id::text,'userId',actor,
  'title','Novo desafio: '||q.title,'message','Um novo desafio está disponível na central.',
  'link','/desafios/'||q.id::text,'read',coalesce(pref.read_notices ? ('quiz-published:'||q.id::text),false),
  'createdAt',q.announcement_at) order by q.announcement_at desc,q.id),'[]'::jsonb) into notices
 from public.academy_quizzes q where pref.quiz_notifications_enabled and q.target_audience=audience
  and q.announcement_at>pref.quiz_notifications_since and q.announcement_at<=now()
  and q.available_from<=now() and q.is_active and q.deleted_at is null
  and (q.expires_at is null or q.expires_at>now())
  and not exists(select 1 from public.academy_quiz_attempts a where a.quiz_id=q.id and a.user_id=actor);
 return jsonb_build_object('userId',actor,'quizNotifications',jsonb_build_object(
  'enabled',coalesce(pref.quiz_notifications_enabled,false),'since',pref.quiz_notifications_since),
  'readNotices',coalesce(pref.read_notices,'[]'::jsonb),'notifications',notices);
end;
$$;

alter table public.academy_preferences enable row level security;
revoke all on public.academy_preferences from public,anon,authenticated;
grant select,insert,update,delete on public.academy_preferences to service_role;
revoke all on function public.academy_periodic_quiz_announcement() from public,anon,authenticated;
revoke all on function public.academy_set_quiz_notifications(uuid,boolean) from public,anon,authenticated;
revoke all on function public.academy_read_quiz_notifications(uuid) from public,anon,authenticated;
grant execute on function public.academy_periodic_quiz_announcement() to service_role;
grant execute on function public.academy_set_quiz_notifications(uuid,boolean) to service_role;
grant execute on function public.academy_read_quiz_notifications(uuid) to service_role;
notify pgrst,'reload schema';
commit;
