begin;
alter table public.academy_recognitions add column if not exists request_id uuid;
create unique index if not exists academy_recognitions_request_unique on public.academy_recognitions(request_id) where request_id is not null;
create unique index if not exists academy_xp_recognition_request_unique on public.academy_xp(user_id,event_key) where course_id is null and event_key like 'recognition:%';
drop function if exists public.academy_grant_recognition(uuid,uuid,text,text);
create function public.academy_grant_recognition(actor uuid, target uuid, recognition_title text, recognition_message text, request_id uuid)
returns void language plpgsql set search_path=public,pg_temp as $$
declare reward_id uuid; prior public.academy_recognitions;
begin
 if request_id is null then raise exception 'Identificador da solicitação obrigatório'; end if;
 select * into prior from public.academy_recognitions where academy_recognitions.request_id=$5;
 if found then
  if prior.manager_id=actor and prior.user_id=target then return; end if;
  raise exception 'Identificador já usado em outro reconhecimento';
 end if;
 if not exists (
  select 1 from public.academy_profiles manager
  join public.academy_profiles member on member.id=target
  where manager.id=actor and manager.status='active' and manager.role in ('admin','manager')
   and coalesce(manager.audience,'internal')='internal'
   and member.status='active' and coalesce(member.audience,'internal')='internal' and member.id<>actor
   and (manager.role='admin' or member.manager_id=actor
    or (member.manager_id is null and lower(trim(member.department))=lower(trim(manager.department))))
 ) then raise exception 'Colaborador fora da sua equipe ou inativo'; end if;
 if char_length(trim(recognition_title)) not between 3 and 120 or char_length(trim(recognition_message)) not between 5 and 2000
 then raise exception 'Preencha o título e a justificativa'; end if;
 insert into public.academy_xp(user_id,course_id,event_key,amount,season,label)
 values(target,null,'recognition:'||request_id::text,100,to_char(now() at time zone 'America/Sao_Paulo','YYYY'),trim(recognition_title))
 on conflict do nothing returning id into reward_id;
 if reward_id is null then return; end if;
 insert into public.academy_recognitions(user_id,manager_id,title,message,xp_id,request_id)
 values(target,actor,trim(recognition_title),trim(recognition_message),reward_id,request_id);
 insert into public.academy_audit(actor,action,resource) values(actor,'grant-recognition',target::text);
end $$;
revoke all on function public.academy_grant_recognition(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.academy_grant_recognition(uuid,uuid,text,text,uuid) to service_role;
commit;
