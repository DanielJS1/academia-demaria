-- Keep the existing KB reviewer predicate and its RLS/RPC callers in sync.
create or replace function kb_private.admin_user() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.academy_profiles where id=auth.uid() and status='active' and coalesce(audience,'internal')='internal' and role in ('admin','manager'))
$$;
revoke all on function kb_private.admin_user() from public;
grant execute on function kb_private.admin_user() to anon,authenticated;

create or replace function kb_private.notify() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.action='submit' then
  insert into public.kb_notifications(profile_id,article_id,message) select id,new.article_id,'Novo artigo enviado para revisão.' from public.academy_profiles where status='active' and audience='internal' and role in ('admin','manager');
 elsif new.action in ('return','publish','withdraw') then
  insert into public.kb_notifications(profile_id,article_id,message) select owner_id,new.article_id,case new.action when 'return' then 'Ajustes solicitados: '||new.comment when 'publish' then 'Sua revisão foi aprovada e publicada.' else 'Submissão retirada. Edite e envie novamente.' end from public.kb_articles where id=new.article_id;
 end if;
 return new;
end $$;
revoke all on function kb_private.notify() from public;
