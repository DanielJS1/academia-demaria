-- BC isolated from the Academy snapshot. No changes to existing Forum buckets.
create schema if not exists kb_private;
revoke all on schema kb_private from public;
grant usage on schema kb_private to anon, authenticated;

create table public.kb_articles (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.academy_profiles(id),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), version integer not null default 1,
 status text not null default 'draft' check(status in ('draft','review','changes','published','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.kb_drafts (article_id uuid primary key references public.kb_articles(id), document jsonb not null, proposed_visibility text not null default 'private' check(proposed_visibility in ('public','private')));
create table public.kb_revisions (id uuid primary key default gen_random_uuid(), article_id uuid not null references public.kb_articles(id), document jsonb not null, proposed_visibility text not null check(proposed_visibility in ('public','private')), created_by uuid not null references public.academy_profiles(id), created_at timestamptz not null default now());
create table public.kb_submissions (id uuid primary key default gen_random_uuid(), article_id uuid not null references public.kb_articles(id), revision_id uuid not null references public.kb_revisions(id), status text not null default 'pending' check(status in ('pending','withdrawn','returned','published')), created_at timestamptz not null default now());
create unique index kb_one_pending on public.kb_submissions(article_id) where status='pending';
create table public.kb_publications (article_id uuid primary key references public.kb_articles(id), revision_id uuid not null references public.kb_revisions(id), slug text not null unique, visibility text not null check(visibility in ('public','private')), title text not null, summary text not null, product text not null, category text not null, tags text[] not null, search_text text not null, document jsonb not null, published_at timestamptz not null default now());
create table public.kb_review_events (id uuid primary key default gen_random_uuid(), article_id uuid not null references public.kb_articles(id), actor_id uuid not null references public.academy_profiles(id), action text not null, comment text, revision_id uuid references public.kb_revisions(id), created_at timestamptz not null default now());
create table public.kb_media (id uuid primary key default gen_random_uuid(), article_id uuid not null references public.kb_articles(id), owner_id uuid not null references public.academy_profiles(id), provider text not null check(provider in ('supabase','local')), storage_key text not null unique, name text not null, mime text not null check(mime in ('image/png','image/jpeg','image/webp')), bytes integer not null check(bytes between 1 and 5242880), width integer not null, height integer not null, checksum text not null, ready boolean not null default false, created_at timestamptz not null default now());
create table public.kb_revision_media (revision_id uuid not null references public.kb_revisions(id), media_id uuid not null references public.kb_media(id), primary key(revision_id,media_id));
create table public.kb_imports (source_hash text primary key, article_id uuid not null references public.kb_articles(id), original_html text not null, report jsonb not null, created_at timestamptz not null default now());
create index kb_articles_owner on public.kb_articles(owner_id);
create index kb_review_article on public.kb_review_events(article_id,created_at);
create index kb_revision_article on public.kb_revisions(article_id,created_at);
create index kb_submission_article on public.kb_submissions(article_id);
create index kb_media_article on public.kb_media(article_id);
create index kb_media_reverse on public.kb_revision_media(media_id);
create index kb_publication_search on public.kb_publications using gin(to_tsvector('portuguese',search_text));

create function kb_private.internal_user() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.academy_profiles where id=auth.uid() and status='active' and coalesce(audience,'internal')='internal') $$;
create function kb_private.admin_user() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.academy_profiles where id=auth.uid() and status='active' and coalesce(audience,'internal')='internal' and role='admin') $$;
create function kb_private.editor(aid uuid) returns boolean language sql stable security definer set search_path='' as $$ select kb_private.internal_user() and exists(select 1 from public.kb_articles where id=aid and (owner_id=auth.uid() or kb_private.admin_user())) $$;
revoke all on function kb_private.internal_user(), kb_private.admin_user(), kb_private.editor(uuid) from public;
grant execute on function kb_private.internal_user(), kb_private.admin_user(), kb_private.editor(uuid) to anon,authenticated;

do $$ declare t text; begin
 foreach t in array array['kb_articles','kb_drafts','kb_revisions','kb_submissions','kb_publications','kb_review_events','kb_media','kb_revision_media','kb_imports'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
grant select on public.kb_articles,public.kb_drafts,public.kb_revisions,public.kb_submissions,public.kb_review_events,public.kb_media,public.kb_revision_media,public.kb_imports to authenticated;
grant select on public.kb_publications to anon,authenticated;
create policy kb_articles_editor on public.kb_articles for select to authenticated using(kb_private.editor(id));
create policy kb_drafts_editor on public.kb_drafts for select to authenticated using(kb_private.editor(article_id));
create policy kb_revisions_editor on public.kb_revisions for select to authenticated using(kb_private.editor(article_id));
create policy kb_submissions_editor on public.kb_submissions for select to authenticated using(kb_private.editor(article_id));
create policy kb_events_editor on public.kb_review_events for select to authenticated using(kb_private.editor(article_id));
create policy kb_imports_editor on public.kb_imports for select to authenticated using(kb_private.editor(article_id));
create policy kb_publication_read on public.kb_publications for select to anon,authenticated using(visibility='public' or kb_private.internal_user());
create policy kb_media_editor on public.kb_media for select to authenticated using(kb_private.editor(article_id));
create policy kb_reference_editor on public.kb_revision_media for select to authenticated using(exists(select 1 from public.kb_revisions r where r.id=revision_id and kb_private.editor(r.article_id)));

-- Recursive structural validation also runs on direct RPC calls. No raw HTML accepted.
create function kb_private.validate_node(n jsonb, level integer default 0) returns void language plpgsql immutable set search_path='' as $$
declare c jsonb; m jsonb; k text; typ text := n->>'type'; allowed text[]; child_types text[];
begin
 if level>32 or jsonb_typeof(n) is distinct from 'object' or typ is null or typ not in ('doc','text','paragraph','heading','bulletList','orderedList','listItem','blockquote','codeBlock','hardBreak','horizontalRule','image','table','tableRow','tableCell','tableHeader') then raise exception 'Invalid rich node'; end if;
 if n ? 'content' and (jsonb_typeof(n->'content') is distinct from 'array' or jsonb_array_length(n->'content')>2000) then raise exception 'Invalid content'; end if;
 if n ? 'marks' and (jsonb_typeof(n->'marks') is distinct from 'array' or jsonb_array_length(n->'marks')>8) then raise exception 'Invalid marks'; end if;
 if exists(select 1 from jsonb_object_keys(n) key where key not in ('type','text','content','attrs','marks')) then raise exception 'Invalid node fields'; end if;
 allowed := case typ when 'image' then array['mediaId','alt','width','height'] when 'paragraph' then array['textAlign'] when 'heading' then array['level','textAlign'] when 'orderedList' then array['start','type'] when 'codeBlock' then array['language'] when 'tableCell' then array['colspan','rowspan','colwidth'] when 'tableHeader' then array['colspan','rowspan','colwidth'] else array[]::text[] end;
 if n ? 'attrs' then
  if jsonb_typeof(n->'attrs')<>'object' then raise exception 'Invalid attrs'; end if;
  for k in select jsonb_object_keys(n->'attrs') loop
   if (not k=any(allowed) and not(k='blockId' and typ not in ('doc','text','hardBreak'))) or jsonb_typeof(n->'attrs'->k) not in ('string','number','null') then raise exception 'Invalid attrs'; end if;
   if jsonb_typeof(n->'attrs'->k)='string' and length(n->'attrs'->>k)>2000 then raise exception 'Invalid attrs'; end if;
   if k='textAlign' and n->'attrs'->>k is not null and n->'attrs'->>k not in ('left','center','right','justify') then raise exception 'Invalid text alignment'; end if;
   if k='blockId' and n->'attrs'->>k is not null and n->'attrs'->>k !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid block id'; end if;
   if k in ('width','height','colspan','rowspan') and ((n->'attrs'->>k)::numeric not between 1 and 10000 or trunc((n->'attrs'->>k)::numeric)<>(n->'attrs'->>k)::numeric) then raise exception 'Invalid dimension'; end if;
  end loop;
 end if;
 if typ='heading' and coalesce(n->'attrs'->>'level','') not in ('2','3','4') then raise exception 'Invalid heading'; end if;
 if typ='image' and (coalesce(n->'attrs'->>'mediaId','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(n->'attrs'->'alt') is distinct from 'string') then raise exception 'Invalid image'; end if;
 if typ='text' and (jsonb_typeof(n->'text') is distinct from 'string' or length(n->>'text')=0 or length(n->>'text')>100000 or n ? 'content') then raise exception 'Invalid text'; end if;
 if typ<>'text' and n ? 'text' then raise exception 'Invalid text'; end if;
 for m in select value from jsonb_array_elements(coalesce(n->'marks','[]')) loop
  if jsonb_typeof(m) is distinct from 'object' or coalesce(m->>'type','') not in ('bold','italic','strike','underline','code','link','subscript','superscript','textStyle','highlight') or exists(select 1 from jsonb_object_keys(m) key where key not in ('type','attrs')) then raise exception 'Invalid mark'; end if;
  if m->>'type' not in ('link','textStyle','highlight') and m ? 'attrs' then raise exception 'Invalid mark attrs'; end if;
  if m->>'type' in ('textStyle','highlight') then
   if jsonb_typeof(m->'attrs') is distinct from 'object' or exists(select 1 from jsonb_object_keys(m->'attrs') key where key<> 'color' and not(key='fontSize' and m->>'type'='textStyle')) then raise exception 'Invalid format attrs'; end if;
   if m->'attrs'->>'color' is not null and m->'attrs'->>'color' !~* '^#[0-9a-f]{6}$' then raise exception 'Invalid text color'; end if;
   if m->'attrs'->>'fontSize' is not null and m->'attrs'->>'fontSize' not in ('14px','16px','18px','20px','24px') then raise exception 'Invalid font size'; end if;
  end if;
  if m->>'type'='link' and (jsonb_typeof(m->'attrs') is distinct from 'object' or jsonb_typeof(m->'attrs'->'href') is distinct from 'string' or length(m->'attrs'->>'href')>2000 or (m->'attrs' ? 'target' and coalesce(m->'attrs'->>'target','_blank')<>'_blank') or (m->'attrs' ? 'rel' and jsonb_typeof(m->'attrs'->'rel') is distinct from 'string') or (m->'attrs' ? 'class' and jsonb_typeof(m->'attrs'->'class') is distinct from 'null')) then raise exception 'Invalid link attrs'; end if;
  if m->>'type'='link' and (coalesce(m->'attrs'->>'href','') !~* '^(https://[^[:space:]]+|mailto:[^[:space:]]+)$' or exists(select 1 from jsonb_object_keys(m->'attrs') key where key not in ('href','target','rel','class'))) then raise exception 'Invalid link'; end if;
 end loop;
 child_types := case typ when 'doc' then array['paragraph','heading','bulletList','orderedList','blockquote','codeBlock','image','table','horizontalRule'] when 'paragraph' then array['text','hardBreak'] when 'heading' then array['text','hardBreak'] when 'codeBlock' then array['text'] when 'bulletList' then array['listItem'] when 'orderedList' then array['listItem'] when 'listItem' then array['paragraph','heading','bulletList','orderedList','blockquote','codeBlock','image','table'] when 'blockquote' then array['paragraph','heading','bulletList','orderedList','image'] when 'table' then array['tableRow'] when 'tableRow' then array['tableCell','tableHeader'] when 'tableCell' then array['paragraph','bulletList','orderedList','image'] when 'tableHeader' then array['paragraph','bulletList','orderedList','image'] else array[]::text[] end;
 for c in select value from jsonb_array_elements(coalesce(n->'content','[]')) loop
  if not (c->>'type')=any(child_types) then raise exception 'Invalid nesting'; end if;
  perform kb_private.validate_node(c,level+1);
 end loop;
end $$;
create function kb_private.node_text(n jsonb) returns text language plpgsql immutable set search_path='' as $$ declare c jsonb; t text:=coalesce(n->>'text',''); begin for c in select value from jsonb_array_elements(coalesce(n->'content','[]')) loop t:=t||' '||kb_private.node_text(c); end loop; return t; end $$;
create function kb_private.media_ids(d jsonb) returns setof uuid language sql immutable set search_path='' as $$ select distinct (v->'attrs'->>'mediaId')::uuid from jsonb_path_query(d,'$.sections[*].content.** ? (@.type == "image")') v $$;
create function kb_private.validate_document(d jsonb, complete boolean) returns void language plpgsql immutable set search_path='' as $$
declare keys text[]; req text[]; s jsonb; i integer:=1; k text; meta jsonb:=d->'metadata'; blocks integer; distinct_blocks integer; valid_blocks boolean;
begin
 if jsonb_typeof(d) is distinct from 'object' or jsonb_typeof(d->'schemaVersion') is distinct from 'number' or jsonb_typeof(d->'templateVersion') is distinct from 'number' or length(d::text)>1000000 or d->>'schemaVersion' is distinct from '1' or d->>'templateVersion' is distinct from '1' or coalesce(d->>'templateId','') not in ('procedimento','novidade','atualizacao') or exists(select 1 from jsonb_object_keys(d) key where key not in ('schemaVersion','templateId','templateVersion','metadata','sections')) then raise exception 'Invalid template'; end if;
 if jsonb_typeof(meta) is distinct from 'object' or exists(select 1 from jsonb_object_keys(meta) key where key not in ('title','summary','product','release','category','tags','legacyPublished','legacyRevision')) then raise exception 'Invalid metadata'; end if;
 foreach k in array array['title','summary','product','release','category'] loop if jsonb_typeof(meta->k) is distinct from 'string' or length(meta->>k)>(case k when 'title' then 240 when 'summary' then 2000 else 120 end) then raise exception 'Invalid metadata fields'; end if; end loop;
 foreach k in array array['legacyPublished','legacyRevision'] loop if jsonb_typeof(meta->k) is null or jsonb_typeof(meta->k) not in ('null','string') or length(meta->>k)>(case k when 'legacyPublished' then 120 else 240 end) then raise exception 'Invalid historical metadata'; end if; end loop;
 if jsonb_typeof(meta->'tags') is distinct from 'array' or jsonb_array_length(meta->'tags')>20 or exists(select 1 from jsonb_array_elements(meta->'tags') v where jsonb_typeof(v)<>'string' or length(v#>>'{}')>60) then raise exception 'Invalid tags'; end if;
 keys:=case d->>'templateId' when 'procedimento' then array['objetivo','requisitos','passos','resultado'] else array['objetivo','mudancas','impacto','orientacao'] end;
 req:=case d->>'templateId' when 'procedimento' then array['objetivo','passos','resultado'] else keys end;
 if jsonb_typeof(d->'sections') is distinct from 'array' or jsonb_array_length(d->'sections')<>4 then raise exception 'Invalid sections'; end if;
 if (select count(distinct v->>'id') from jsonb_array_elements(d->'sections') v)<>4 then raise exception 'Invalid section ids'; end if;
 for s in select value from jsonb_array_elements(d->'sections') loop
  if s->>'key' is distinct from keys[i] or coalesce(s->>'id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or s->'content'->>'type' is distinct from 'doc' or exists(select 1 from jsonb_object_keys(s) key where key not in ('id','key','content')) then raise exception 'Invalid sections'; end if;
  perform kb_private.validate_node(s->'content');
  if complete and s->>'key'=any(req) and (length(trim(kb_private.node_text(s->'content')))<8 or trim(kb_private.node_text(s->'content')) ~* '^(escrito[[:space:]]*[0-9]|placeholder)') then raise exception 'Incomplete section'; end if;
  i:=i+1;
 end loop;
 if complete and (length(trim(meta->>'title'))=0 or length(trim(meta->>'summary'))=0 or length(trim(meta->>'product'))=0 or (d->>'templateId'<>'procedimento' and length(trim(meta->>'release'))=0)) then raise exception 'Incomplete metadata'; end if;
 if complete and exists(select 1 from jsonb_path_query(d,'$.sections[*].content.** ? (@.type == "image")') v where length(trim(coalesce(v->'attrs'->>'alt','')))=0) then raise exception 'Image description required'; end if;
 if complete then
  with recursive nodes(n) as (select v->'content' from jsonb_array_elements(d->'sections') v union all select c from nodes cross join lateral jsonb_array_elements(coalesce(n->'content','[]')) c)
  select count(*),count(distinct n->'attrs'->>'blockId'),bool_and(coalesce(n->'attrs'->>'blockId','') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') into blocks,distinct_blocks,valid_blocks from nodes where n->>'type' not in ('doc','text','hardBreak');
  if not valid_blocks or blocks<>distinct_blocks then raise exception 'Stable unique block ids required'; end if;
 end if;
end $$;

-- Private privileged implementation; public invoker entry point exposes only checked commands.
create function kb_private.mutate(cmd jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare aid uuid; a public.kb_articles; rid uuid; sid uuid; r public.kb_revisions; s public.kb_submissions; d jsonb; act text:=cmd->>'action'; vis text; mid uuid;
begin
 if not kb_private.internal_user() then raise exception 'Forbidden' using errcode='42501'; end if;
 if act='create' then
  aid:=gen_random_uuid(); d:=cmd->'document'; perform kb_private.validate_document(d,false);
  insert into public.kb_articles(id,owner_id,slug) values(aid,auth.uid(),coalesce(nullif(cmd->>'slug',''),'artigo-'||aid::text));
  insert into public.kb_drafts values(aid,d,'private');
 else
  aid:=(cmd->>'articleId')::uuid;
  select * into a from public.kb_articles where id=aid for update;
  if not found or not kb_private.editor(aid) then raise exception 'Forbidden' using errcode='42501'; end if;
  if a.version is distinct from (cmd->>'expectedVersion')::integer then raise exception 'Conflict' using errcode='40001'; end if;
  if act in ('publish','return','unpublish','visibility') and not kb_private.admin_user() then raise exception 'Admin required' using errcode='42501'; end if;
  if act='save' then
   if a.status='review' then raise exception 'Withdraw first' using errcode='40001'; end if;
   d:=cmd->'document'; perform kb_private.validate_document(d,false); vis:=cmd->>'visibility';
   if vis not in ('public','private') then raise exception 'Invalid visibility'; end if;
   update public.kb_drafts set document=d,proposed_visibility=vis where article_id=aid;
   update public.kb_articles set status='draft' where id=aid;
  elsif act='submit' then
   if a.status='review' then raise exception 'Already submitted' using errcode='40001'; end if;
   select document,proposed_visibility into d,vis from public.kb_drafts where article_id=aid;
   perform kb_private.validate_document(d,true);
   if exists(select 1 from kb_private.media_ids(d) x where not exists(select 1 from public.kb_media m where m.id=x and m.article_id=aid and m.ready)) then raise exception 'Unready or unauthorized media'; end if;
   insert into public.kb_revisions(article_id,document,proposed_visibility,created_by) values(aid,d,vis,auth.uid()) returning id into rid;
   insert into public.kb_revision_media select rid,x from kb_private.media_ids(d) x;
   insert into public.kb_submissions(article_id,revision_id) values(aid,rid);
   update public.kb_articles set status='review' where id=aid;
  elsif act in ('withdraw','publish','return') then
   select * into s from public.kb_submissions where article_id=aid and status='pending' for update;
   if not found or s.id is distinct from (cmd->>'submissionId')::uuid or s.revision_id is distinct from (cmd->>'revisionId')::uuid then raise exception 'Obsolete submission' using errcode='40001'; end if;
   rid:=s.revision_id; select * into r from public.kb_revisions where id=rid;
   if act='withdraw' then update public.kb_submissions set status='withdrawn' where id=s.id; update public.kb_articles set status='draft' where id=aid;
   elsif act='return' then
    if length(trim(coalesce(cmd->>'comment','')))=0 then raise exception 'Comment required'; end if;
    update public.kb_submissions set status='returned' where id=s.id; update public.kb_articles set status='changes' where id=aid;
   else
    d:=r.document; perform kb_private.validate_document(d,true); vis:=cmd->>'visibility';
    if vis not in ('public','private') then raise exception 'Invalid visibility'; end if;
    if exists(select 1 from public.kb_revision_media rm join public.kb_media m on m.id=rm.media_id where rm.revision_id=rid and not m.ready) then raise exception 'Unready media'; end if;
    insert into public.kb_publications(article_id,revision_id,slug,visibility,title,summary,product,category,tags,search_text,document) values(aid,rid,a.slug,vis,d->'metadata'->>'title',d->'metadata'->>'summary',d->'metadata'->>'product',d->'metadata'->>'category',array(select jsonb_array_elements_text(d->'metadata'->'tags')),d->'metadata'->>'title'||' '||(d->'metadata')::text||' '||kb_private.node_text(jsonb_build_object('content',(select jsonb_agg(v->'content') from jsonb_array_elements(d->'sections') v))),d)
    on conflict(article_id) do update set revision_id=excluded.revision_id,visibility=excluded.visibility,title=excluded.title,summary=excluded.summary,product=excluded.product,category=excluded.category,tags=excluded.tags,search_text=excluded.search_text,document=excluded.document,published_at=now();
    update public.kb_submissions set status='published' where id=s.id; update public.kb_articles set status='published' where id=aid;
   end if;
  elsif act='unpublish' then delete from public.kb_publications where article_id=aid; update public.kb_articles set status='archived' where id=aid;
  elsif act='visibility' then
   if cmd->>'visibility' not in ('public','private') then raise exception 'Invalid visibility'; end if;
   update public.kb_publications set visibility=cmd->>'visibility' where article_id=aid;
  elsif act='restore' then
   if a.status='review' then raise exception 'Withdraw first' using errcode='40001'; end if;
   select document into d from public.kb_revisions where id=(cmd->>'revisionId')::uuid and article_id=aid;
   if not found then raise exception 'Revision not found'; end if;
   update public.kb_drafts set document=d where article_id=aid; update public.kb_articles set status='draft' where id=aid;
  else raise exception 'Unknown action'; end if;
  update public.kb_articles set version=version+1,updated_at=now() where id=aid;
 end if;
 insert into public.kb_review_events(article_id,actor_id,action,comment,revision_id) values(aid,auth.uid(),act,left(cmd->>'comment',4000),rid);
 return aid;
end $$;
revoke all on all functions in schema kb_private from public;
grant execute on function kb_private.internal_user(),kb_private.admin_user(),kb_private.editor(uuid) to anon,authenticated;
grant execute on function kb_private.mutate(jsonb) to authenticated;
create function public.kb_mutate(cmd jsonb) returns uuid language sql security invoker set search_path='' as $$ select kb_private.mutate(cmd) $$;
revoke all on function public.kb_mutate(jsonb) from public,anon;
grant execute on function public.kb_mutate(jsonb) to authenticated;

create function kb_private.media_access(mid uuid) returns table(storage_key text,provider text,mime text) language sql stable security definer set search_path='' as $$
 select m.storage_key,m.provider,m.mime from public.kb_media m where m.id=mid and m.ready and (kb_private.editor(m.article_id) or exists(select 1 from public.kb_revision_media rm join public.kb_publications p on p.revision_id=rm.revision_id where rm.media_id=m.id and (p.visibility='public' or kb_private.internal_user())))
$$;
revoke all on function kb_private.media_access(uuid) from public;
grant execute on function kb_private.media_access(uuid) to anon,authenticated;
create function public.kb_media_access(mid uuid) returns table(storage_key text,provider text,mime text) language sql stable security invoker set search_path='' as $$ select * from kb_private.media_access(mid) $$;
revoke all on function public.kb_media_access(uuid) from public;
grant execute on function public.kb_media_access(uuid) to anon,authenticated;

-- No browser policies grant access to original objects. Delivery checks current publication.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('academy-kb','academy-kb',false,5242880,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;

create function public.kb_search(query text default '',product_filter text default '',category_filter text default '',tag_filter text default '',page_number integer default 1)
 returns table(slug text,title text,summary text,product text,category text,tags text[],published_at timestamptz,total bigint)
 language sql stable security invoker set search_path='' as $$
 select p.slug,p.title,p.summary,p.product,p.category,p.tags,p.published_at,count(*) over() from public.kb_publications p
 where (product_filter='' or p.product=product_filter) and (category_filter='' or p.category=category_filter) and (tag_filter='' or tag_filter=any(p.tags))
 and (query='' or to_tsvector('portuguese',p.search_text) @@ websearch_to_tsquery('portuguese',query) or translate(lower(p.search_text),'áàâãéêíóôõúç','aaaaeeiooouc') like '%'||replace(replace(translate(lower(query),'áàâãéêíóôõúç','aaaaeeiooouc'),'%','\%'),'_','\_')||'%')
 order by case when lower(p.title) like '%'||lower(query)||'%' then 0 else 1 end,p.published_at desc
 limit 20 offset (greatest(1,least(page_number,10000))-1)*20
 $$;
revoke all on function public.kb_search(text,text,text,text,integer) from public;
grant execute on function public.kb_search(text,text,text,text,integer) to anon,authenticated;

create function kb_private.delete_media(mid uuid) returns text language plpgsql security definer set search_path='' as $$
declare m public.kb_media; key text;
begin
 select * into m from public.kb_media where id=mid;
 if not found or not kb_private.editor(m.article_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.kb_articles where id=m.article_id for update;
 if exists(select 1 from public.kb_revision_media where media_id=mid) or exists(select 1 from public.kb_drafts d cross join lateral kb_private.media_ids(d.document) x where x=mid) then raise exception 'Media in use'; end if;
 key:=m.storage_key; delete from public.kb_media where id=mid;
 insert into public.kb_review_events(article_id,actor_id,action,comment) values(m.article_id,auth.uid(),'delete-media',mid::text);
 return key;
end $$;
revoke all on function kb_private.delete_media(uuid) from public;
grant execute on function kb_private.delete_media(uuid) to authenticated;
create function public.kb_delete_media(mid uuid) returns text language sql security invoker set search_path='' as $$ select kb_private.delete_media(mid) $$;
revoke all on function public.kb_delete_media(uuid) from public,anon;
grant execute on function public.kb_delete_media(uuid) to authenticated;

create table public.kb_notifications(id uuid primary key default gen_random_uuid(),profile_id uuid not null references public.academy_profiles(id),article_id uuid not null references public.kb_articles(id),message text not null,created_at timestamptz not null default now(),read_at timestamptz);
alter table public.kb_notifications enable row level security;
revoke all on public.kb_notifications from anon,authenticated;
grant select,update(read_at) on public.kb_notifications to authenticated;
create policy kb_notice_read on public.kb_notifications for select to authenticated using(profile_id=auth.uid() and kb_private.internal_user());
create policy kb_notice_ack on public.kb_notifications for update to authenticated using(profile_id=auth.uid() and kb_private.internal_user()) with check(profile_id=auth.uid() and kb_private.internal_user());
create index kb_notices_profile on public.kb_notifications(profile_id,created_at desc);
create function kb_private.notify() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.action='submit' then
  insert into public.kb_notifications(profile_id,article_id,message) select id,new.article_id,'Novo artigo enviado para revisão.' from public.academy_profiles where status='active' and audience='internal' and role='admin';
 elsif new.action in ('return','publish','withdraw') then
  insert into public.kb_notifications(profile_id,article_id,message) select owner_id,new.article_id,case new.action when 'return' then 'Ajustes solicitados: '||new.comment when 'publish' then 'Sua revisão foi aprovada e publicada.' else 'Submissão retirada. Edite e envie novamente.' end from public.kb_articles where id=new.article_id;
 end if;
 return new;
end $$;
revoke all on function kb_private.notify() from public;
create trigger kb_editorial_notices after insert on public.kb_review_events for each row execute function kb_private.notify();
