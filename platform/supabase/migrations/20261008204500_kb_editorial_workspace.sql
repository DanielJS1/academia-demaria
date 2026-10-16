-- Shared editorial index exposes metadata only; draft/media edit permissions stay intact.
alter table public.kb_articles drop constraint kb_articles_status_check;
alter table public.kb_articles add constraint kb_articles_status_check check(status in ('draft','review','changes','published','archived','deleted'));
alter table public.kb_articles add column trash_previous_status text check(trash_previous_status in ('draft','review','changes','published','archived'));

create function public.kb_editorial_index(filter text default 'all', page integer default 1, query text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; term text:=left(coalesce(query,''),200);
begin
 if not kb_private.internal_user() then raise exception 'Forbidden' using errcode='42501'; end if;
 if filter not in ('all','mine','draft','review','changes','published','archived','deleted') or page not between 1 and 10000 then raise exception 'Invalid filter'; end if;
 with source as (
  select a.id,a.slug,a.owner_id,a.status,a.version,a.created_at,a.updated_at,
   coalesce(p.name,'Autor indisponível') as author_name,d.document->'metadata'->>'title' as title,
   d.document->'metadata'->>'category' as category,d.document->'metadata'->'tags' as tags,
   kb_private.editor(a.id) as can_edit
  from public.kb_articles a join public.kb_drafts d on d.article_id=a.id left join public.academy_profiles p on p.id=a.owner_id
  where term='' or d.document->'metadata'->>'title' ilike '%'||term||'%' or p.name ilike '%'||term||'%'
 ), filtered as (
  select * from source where case when filter='all' then status not in ('archived','deleted') when filter='mine' then owner_id=auth.uid() and status not in ('archived','deleted') else status=filter end
 ), items as (select * from filtered order by created_at desc,id desc limit 20 offset (page-1)*20)
 select jsonb_build_object('articles',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc,i.id desc) from items i),'[]'::jsonb),'total',(select count(*) from filtered),
  'counts',jsonb_build_object('all',count(*) filter(where status not in ('archived','deleted')),'mine',count(*) filter(where owner_id=auth.uid() and status not in ('archived','deleted')),
   'draft',count(*) filter(where status='draft'),'review',count(*) filter(where status='review'),'changes',count(*) filter(where status='changes'),
   'published',count(*) filter(where status='published'),'archived',count(*) filter(where status='archived'),'deleted',count(*) filter(where status='deleted'))) into result from source;
 return result;
end $$;
revoke all on function public.kb_editorial_index(text,integer,text) from public,anon;
grant execute on function public.kb_editorial_index(text,integer,text) to authenticated;

create function public.kb_trash_article(aid uuid, expected_version integer, restore boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.kb_articles; next_status text;
begin
 select * into a from public.kb_articles where id=aid for update;
 if not found or not kb_private.editor(aid) then raise exception 'Forbidden' using errcode='42501'; end if;
 if a.version is distinct from expected_version then raise exception 'Conflict' using errcode='40001'; end if;
 if restore then
  if a.status<>'deleted' then raise exception 'Conflict: article is not in trash' using errcode='40001'; end if;
  next_status:=case when a.trash_previous_status in ('published','archived') then 'archived' when a.trash_previous_status='changes' then 'changes' else 'draft' end;
  update public.kb_articles set status=next_status,trash_previous_status=null,version=version+1,updated_at=now() where id=aid;
 else
  if a.status='deleted' then raise exception 'Conflict: article is already in trash' using errcode='40001'; end if;
  next_status:='deleted';
  delete from public.kb_publications where article_id=aid;
  update public.kb_submissions set status='withdrawn' where article_id=aid and status='pending';
  update public.kb_articles set trash_previous_status=a.status,status='deleted',version=version+1,updated_at=now() where id=aid;
 end if;
 insert into public.kb_review_events(article_id,actor_id,action) values(aid,auth.uid(),case when restore then 'restore_from_trash' else 'trash' end);
 return jsonb_build_object('id',aid,'status',next_status);
end $$;
revoke all on function public.kb_trash_article(uuid,integer,boolean) from public,anon;
grant execute on function public.kb_trash_article(uuid,integer,boolean) to authenticated;
