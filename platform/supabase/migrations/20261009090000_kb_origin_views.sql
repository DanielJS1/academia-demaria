-- Historical WordPress attribution is separate from local audit timestamps.
alter table public.kb_articles add column if not exists origin_wp_id bigint;
alter table public.kb_articles add column if not exists origin_author_name text;
alter table public.kb_articles add column if not exists origin_created_at timestamptz;
alter table public.kb_articles add column if not exists origin_modified_at timestamptz;
alter table public.kb_articles add column if not exists origin_views bigint check(origin_views>=0);
create table if not exists public.kb_article_stats(article_id uuid primary key references public.kb_articles(id) on delete cascade,views bigint not null default 0 check(views>=0));
create table if not exists public.kb_article_view_events(article_id uuid references public.kb_articles(id) on delete cascade, visitor_hash text not null check(length(visitor_hash)=64), bucket timestamptz not null, primary key(article_id,visitor_hash,bucket));
alter table public.kb_article_stats enable row level security;
alter table public.kb_article_view_events enable row level security;
revoke all on public.kb_article_stats,public.kb_article_view_events from anon,authenticated;
create or replace function public.kb_record_view(slug text,visitor_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare aid uuid; inserted integer; legacy bigint; imported bigint; fresh bigint;
begin
 select p.article_id into aid from public.kb_publications p where p.slug=kb_record_view.slug;
 if aid is null then raise exception 'Article unavailable'; end if;
 insert into public.kb_article_view_events values(aid,visitor_hash,date_trunc('hour',now())) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 then
  insert into public.kb_article_stats values(aid,1) on conflict(article_id) do update set views=public.kb_article_stats.views+1;
 end if;
 select a.origin_views,a.origin_wp_id,coalesce(s.views,0) into legacy,imported,fresh from public.kb_articles a left join public.kb_article_stats s on s.article_id=a.id where a.id=aid;
 -- Remove expired deduplication keys for this article on its next read.
 delete from public.kb_article_view_events where article_id=aid and bucket<now()-interval '24 hours';
 return jsonb_build_object('legacy',legacy,'new',fresh,'total',case when imported is not null and legacy is null then null else coalesce(legacy,0)+fresh end);
end $$;
revoke all on function public.kb_record_view(text,text) from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.kb_record_view(text,text) to service_role; end if; end $$;
create or replace function public.kb_editorial_index(filter text default 'all', page integer default 1, query text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; term text:=left(coalesce(query,''),200);
begin
 if not kb_private.internal_user() then raise exception 'Forbidden' using errcode='42501'; end if;
 if filter not in ('all','mine','draft','review','changes','published','archived','deleted') or page not between 1 and 10000 then raise exception 'Invalid filter'; end if;
 with source as (
  select a.id,a.slug,a.owner_id,a.status,a.version,coalesce(a.origin_created_at,a.created_at) as created_at,coalesce(a.origin_modified_at,a.updated_at) as updated_at,a.origin_wp_id,a.origin_views,coalesce(v.views,0) as new_views,case when a.origin_wp_id is not null and a.origin_views is null then null else coalesce(a.origin_views,0)+coalesce(v.views,0) end as views_total,
   coalesce(a.origin_author_name,p.name,'Autor indisponível') as author_name,d.document->'metadata'->>'title' as title,
   d.document->'metadata'->>'category' as category,d.document->'metadata'->'tags' as tags,
   kb_private.editor(a.id) as can_edit
  from public.kb_articles a join public.kb_drafts d on d.article_id=a.id left join public.academy_profiles p on p.id=a.owner_id
  left join public.kb_article_stats v on v.article_id=a.id
  where term='' or d.document->'metadata'->>'title' ilike '%'||term||'%' or coalesce(a.origin_author_name,p.name) ilike '%'||term||'%'
 ), filtered as (
  select * from source where case when filter='all' then status not in ('archived','deleted') when filter='mine' then owner_id=auth.uid() and status not in ('archived','deleted') else status=filter end
 ), items as (select * from filtered order by created_at desc,origin_wp_id desc nulls last,id desc limit 20 offset (page-1)*20)
 select jsonb_build_object('articles',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc,i.origin_wp_id desc nulls last,i.id desc) from items i),'[]'::jsonb),'total',(select count(*) from filtered),
  'counts',jsonb_build_object('all',count(*) filter(where status not in ('archived','deleted')),'mine',count(*) filter(where owner_id=auth.uid() and status not in ('archived','deleted')),
   'draft',count(*) filter(where status='draft'),'review',count(*) filter(where status='review'),'changes',count(*) filter(where status='changes'),
   'published',count(*) filter(where status='published'),'archived',count(*) filter(where status='archived'),'deleted',count(*) filter(where status='deleted'))) into result from source;
 return result;
end $$;
revoke all on function public.kb_editorial_index(text,integer,text) from public,anon;
grant execute on function public.kb_editorial_index(text,integer,text) to authenticated;

