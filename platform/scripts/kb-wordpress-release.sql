-- Temporary, server-only release helper. Removed after verified migration.
create unique index if not exists kb_articles_wordpress_origin on public.kb_articles(origin_wp_id) where origin_wp_id is not null;
alter table public.kb_articles add column if not exists origin_source_hash text;
create or replace function public.kb_release_wordpress(item jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare aid uuid:=(item->>'id')::uuid; actor uuid:=(item->>'actor')::uuid; a public.kb_articles; m jsonb; sid uuid; rid uuid; v integer; oldclaims text:=current_setting('request.jwt.claims',true); oldsub text:=current_setting('request.jwt.claim.sub',true); vis text:=item->>'sourceVisibility';
begin
 if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(oldclaims,'')::jsonb->>'role','')<>'service_role' then raise exception 'Server required' using errcode='42501'; end if;
 if not exists(select 1 from public.academy_profiles where id=actor and role='admin' and status='active' and coalesce(audience,'internal')='internal') then raise exception 'Admin required'; end if;
 if (item->>'wpId')::bigint<=0 or item->>'sourceHash' !~ '^[a-f0-9]{64}$' or vis not in ('public','private') then raise exception 'Invalid origin'; end if;
 select * into a from public.kb_articles where id=aid for update;
 if found and a.origin_source_hash is not null then
  if a.origin_source_hash is distinct from item->>'sourceHash' or a.origin_wp_id is distinct from (item->>'wpId')::bigint then raise exception 'Origin conflict'; end if;
  return jsonb_build_object('id',aid,'status',a.status,'resumed',true);
 end if;
 if found and a.slug is distinct from item->>'slug' then raise exception 'Slug conflict'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',(coalesce(nullif(oldclaims,'')::jsonb,'{}'::jsonb)||jsonb_build_object('sub',actor::text))::text,true);
 if a.id is null then
  insert into public.kb_articles(id,owner_id,slug) values(aid,actor,item->>'slug');
  insert into public.kb_drafts(article_id,document,proposed_visibility) values(aid,item->'document','private');
 else
  if a.status in ('review','deleted','archived') then raise exception 'Existing workflow conflict'; end if;
  -- A broken migrated version must immediately leave client visibility.
  if not (item->>'publish')::boolean and a.status='published' then
   perform public.kb_mutate(jsonb_build_object('action','unpublish','articleId',aid,'expectedVersion',a.version));
  end if;
 end if;
 for m in select value from jsonb_array_elements(item->'media') loop
  if (m->>'article_id')::uuid<>aid or (m->>'owner_id')::uuid<>actor or m->>'provider'<>'supabase' or m->>'storage_key'<>(aid::text||'/'||(m->>'id')) then raise exception 'Invalid media mapping'; end if;
  insert into public.kb_media(id,article_id,owner_id,provider,storage_key,name,mime,bytes,width,height,checksum,ready)
   values((m->>'id')::uuid,aid,actor,'supabase',m->>'storage_key',m->>'name',m->>'mime',(m->>'bytes')::integer,(m->>'width')::integer,(m->>'height')::integer,m->>'checksum',true);
 end loop;
 select version into v from public.kb_articles where id=aid;
 perform public.kb_mutate(jsonb_build_object('action','save','articleId',aid,'expectedVersion',v,'document',item->'document','visibility',vis));
 update public.kb_articles set origin_wp_id=(item->>'wpId')::bigint,origin_author_name=item->'origin'->>'author',origin_created_at=case when item->>'publishedGmt'='0000-00-00 00:00:00' then (item->'origin'->>'created')::timestamp at time zone 'America/Sao_Paulo' else (item->>'publishedGmt')::timestamp at time zone 'UTC' end,origin_modified_at=(item->>'modified')::timestamp at time zone 'America/Sao_Paulo',origin_views=(item->'origin'->>'views')::bigint,origin_source_hash=item->>'sourceHash' where id=aid;
 if (item->>'publish')::boolean then
  perform public.kb_mutate(jsonb_build_object('action','submit','articleId',aid,'expectedVersion',v+1));
  select id,revision_id into sid,rid from public.kb_submissions where article_id=aid and status='pending';
  perform public.kb_mutate(jsonb_build_object('action','publish','articleId',aid,'expectedVersion',v+2,'submissionId',sid,'revisionId',rid,'visibility',vis,'comment','Migração WordPress e publicação autorizadas pelo administrador no Codex. Imagens e conteúdo importado conferidos.'));
  update public.kb_publications set published_at=(select origin_created_at from public.kb_articles where id=aid) where article_id=aid;
 else
  insert into public.kb_review_events(article_id,actor_id,action,comment) values(aid,actor,'migration_pending',left((item->'pending')::text,4000));
 end if;
 perform set_config('request.jwt.claim.sub',coalesce(oldsub,''),true);perform set_config('request.jwt.claims',coalesce(oldclaims,''),true);
 return jsonb_build_object('id',aid,'status',case when (item->>'publish')::boolean then 'published' else 'draft' end,'visibility',vis);
end $$;
revoke all on function public.kb_release_wordpress(jsonb) from public,anon,authenticated;
grant execute on function public.kb_release_wordpress(jsonb) to service_role;
