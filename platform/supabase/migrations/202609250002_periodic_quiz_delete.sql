begin;

alter table public.academy_quizzes add column if not exists deleted_at timestamptz;

create or replace function public.academy_quiz_prevent_deleted_update()
returns trigger language plpgsql as $$
begin
 if old.deleted_at is not null then
  raise exception 'Desafio excluído não pode ser alterado';
 end if;
 return new;
end;
$$;

drop trigger if exists academy_quiz_prevent_deleted_update on public.academy_quizzes;
create trigger academy_quiz_prevent_deleted_update
 before update on public.academy_quizzes
 for each row execute function public.academy_quiz_prevent_deleted_update();

create or replace function public.academy_delete_periodic_quiz(actor uuid, quiz uuid)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.academy_profiles p where p.id=actor and p.status='active'
   and p.role='admin' and coalesce(p.audience,'internal')='internal') then
  raise exception 'Apenas administradores internos podem excluir desafios';
 end if;
 update public.academy_quizzes
 set deleted_at=now(), is_active=false, is_featured=false, updated_at=now()
 where id=quiz and deleted_at is null;
 if not found then raise exception 'Desafio não encontrado'; end if;
end;
$$;
revoke all on function public.academy_delete_periodic_quiz(uuid,uuid) from public,anon,authenticated;
grant execute on function public.academy_delete_periodic_quiz(uuid,uuid) to service_role;

commit;
