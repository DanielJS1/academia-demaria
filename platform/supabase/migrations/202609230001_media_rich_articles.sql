begin;
alter table public.academy_profiles add column if not exists avatar text;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
 ('academy-avatars','academy-avatars',true,5242880,array['image/png','image/jpeg','image/webp']),
 ('academy-articles','academy-articles',true,10485760,array['image/png','image/jpeg','image/webp','application/pdf','application/sql','text/plain','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
comment on column public.academy_profiles.avatar is 'URL pública do avatar no storage';
do $$ begin
 if not exists (select 1 from pg_constraint where conrelid = 'public.academy_profiles'::regclass and conname = 'academy_avatar_url_only') then
  alter table public.academy_profiles add constraint academy_avatar_url_only check (avatar is null or avatar ~ '^https://') not valid;
 end if;
end $$;
create or replace function public.academy_community_mutate(actor uuid, command jsonb) returns void
language plpgsql set search_path=public,pg_temp as $$
declare
 who academy_profiles; doc academy_resources; meta academy_community_articles;
 op text := command->>'type'; body jsonb := command->'data';
 article text := coalesce(command->>'articleId',command->'data'->>'id');
 event text; reward_action text; points integer := 0; reward_id uuid;
 used integer; interaction_used integer; request jsonb; image jsonb;
 week_start date := date_trunc('week',now() at time zone 'America/Sao_Paulo')::date;
begin
 select * into who from academy_profiles where id=actor and status='active' and coalesce(audience,'internal')='internal';
 if not found then raise exception 'A biblioteca é exclusiva dos colaboradores aprovados'; end if;
 if op not in ('community-save','community-react','community-comment','community-delete','community-request-update') then raise exception 'Comando desconhecido'; end if;
 if article is null or length(article) not between 1 and 100 then raise exception 'Artigo inválido'; end if;
 -- The small internal community shares one transaction lock. It serializes
 -- publications/reactions across articles, including weekly author/actor caps.
 perform pg_advisory_xact_lock(742019,1);
 if op='community-save' then
  if jsonb_typeof(body)<>'object' or length(trim(coalesce(body->>'title',''))) not between 3 and 120 or length(coalesce(body->>'content',''))>100000 then raise exception 'Artigo inválido'; end if;
  if coalesce((command->>'publish')::boolean,false) and length(trim(coalesce(body->>'content','')))<80 then raise exception 'Explique o procedimento com pelo menos 80 caracteres'; end if;
  if body ? 'richContent' then
   if octet_length((body->'richContent')::text)>1500000 or (body->'richContent')::text ~* 'data:image/|data:application/|blob:' then raise exception 'Conteúdo rico inválido'; end if;
  end if;
  if body ? 'blocks' then
   if jsonb_typeof(body->'blocks')<>'array' or jsonb_array_length(body->'blocks')>80 or octet_length((body->'blocks')::text)>1500000 then raise exception 'O artigo ultrapassa os limites de conteúdo'; end if;
   if (select count(*) from jsonb_array_elements(body->'blocks') b where b->>'type'='image')>8 then raise exception 'Use no máximo 8 imagens'; end if;
   for image in select value from jsonb_array_elements(body->'blocks') where value->>'type'='image' loop
    if length(coalesce(image->>'src',''))>2048 or coalesce(image->>'src','')!~'^https://' or length(trim(coalesce(image->>'alt','')))=0 then raise exception 'Imagem inválida'; end if;
   end loop;
  end if;
  if not exists(select 1 from academy_resources where id=article) then
   if coalesce((command->>'expectedVersion')::integer,-1)<>0 then raise exception 'Conteúdo atualizado por outra sessão. Reabra o editor.'; end if;
   insert into academy_resources(id,kind) values(article,'article');
   insert into academy_community_articles(article_id,author_id) values(article,actor);
  end if;
 end if;
 select * into doc from academy_resources where id=article and kind='article' for update;
 if not found then raise exception 'Artigo não encontrado'; end if;
 select * into meta from academy_community_articles where article_id=article for update;
 if not found or meta.deleted_at is not null then raise exception 'Artigo não encontrado'; end if;

 if op='community-save' then
  if meta.author_id is distinct from actor and who.role<>'admin' then raise exception 'Somente o autor pode editar este artigo'; end if;
  if doc.revision<>coalesce((command->>'expectedVersion')::integer,-1) then raise exception 'Conteúdo atualizado por outra sessão. Reabra o editor.'; end if;
  body := jsonb_build_object('id',article,'title',trim(body->>'title'),'product',left(coalesce(body->>'product',''),100),'category',left(coalesce(body->>'category',''),100),'content',body->>'content','summary',left(regexp_replace(body->>'content','\s+',' ','g'),240),'revision',doc.revision+1,'updatedAt',now(),'author',coalesce((select name from academy_profiles where id=meta.author_id),doc.published->>'author',doc.draft->>'author',who.name),'community',meta.author_id is not null)
    || case when body ? 'richContent' then jsonb_build_object('richContent',body->'richContent') else '{}'::jsonb end
    || case when body ? 'tags' then jsonb_build_object('tags',body->'tags') else '{}'::jsonb end
    || case when body ? 'blocks' then jsonb_build_object('blocks',body->'blocks') else '{}'::jsonb end;
  if meta.author_id is not null then body:=body||jsonb_build_object('authorId',meta.author_id); end if;
  if (command->>'publish')::boolean then
   update academy_resources set published=body||jsonb_build_object('status','published'),draft=null,revision=revision+1,updated_at=now() where id=article;
   update academy_community_articles set update_request=null where article_id=article;
   if meta.author_id is not null then event:='publish';reward_action:='publish';points:=10; end if;
  else
   update academy_resources set draft=body||jsonb_build_object('status','draft'),revision=revision+1,updated_at=now() where id=article;
  end if;
 elsif op='community-delete' then
  if who.role not in ('admin','manager') then raise exception 'Somente administradores e gestores podem excluir artigos'; end if;
  update academy_community_articles set deleted_at=now(),update_request=null where article_id=article;
  update academy_resources set published=null,draft=null,updated_at=now() where id=article;
  update academy_xp set amount=0 where id in(select id from academy_community_rewards where article_id=article);
  update academy_community_rewards set revoked_at=coalesce(revoked_at,now()) where article_id=article;
  delete from academy_community_comments where article_id=article;
  update academy_community_reactions set active=false where article_id=article;
 elsif op='community-request-update' then
  if who.role not in ('admin','manager') then raise exception 'Somente administradores e gestores podem solicitar atualização'; end if;
  if doc.published is null or meta.author_id is null then raise exception 'Este artigo não possui autor ativo para solicitar atualização'; end if;
  if length(trim(coalesce(command->>'message',''))) not between 5 and 1500 then raise exception 'Descreva a atualização necessária'; end if;
  update academy_community_articles set update_request=jsonb_build_object('message',trim(command->>'message'),'requestedAt',now(),'requestedBy',who.name) where article_id=article;
 else
  if doc.published is null then raise exception 'Publique o artigo antes de interagir'; end if;
  if op='community-react' then
   reward_action:=command->>'reaction';
   if reward_action not in ('like','hype') or jsonb_typeof(command->'active')<>'boolean' then raise exception 'Reação inválida'; end if;
   if (command->>'active')::boolean and reward_action='hype' and not exists(select 1 from academy_community_reactions where article_id=article and user_id=actor and reaction='hype') then
    if (select count(*) from academy_community_reactions where user_id=actor and reaction='hype' and (created_at at time zone 'America/Sao_Paulo')::date>=week_start)>=3 then raise exception 'Você já utilizou seus 3 hypes desta semana'; end if;
   end if;
   if (command->>'active')::boolean then
    insert into academy_community_reactions(article_id,user_id,reaction) values(article,actor,reward_action) on conflict(article_id,user_id,reaction) do update set active=true;
    event:=reward_action||':'||actor;points:=case when reward_action='hype' then 2 else 1 end;
   else
    update academy_community_reactions set active=false where article_id=article and user_id=actor and reaction=reward_action;
   end if;
  elsif op='community-comment' then
   if length(trim(coalesce(command->>'content',''))) not between 2 and 2000 then raise exception 'Escreva um comentário entre 2 e 2000 caracteres'; end if;
   if exists(select 1 from academy_community_comments where id=(command->>'commentId')::uuid) then
    if not exists(select 1 from academy_community_comments where id=(command->>'commentId')::uuid and user_id=actor and article_id=article and content=trim(command->>'content')) then raise exception 'Identificador de comentário já utilizado'; end if;
   else
    if (select count(*) from academy_community_comments where user_id=actor and article_id=article and created_at>now()-interval '1 hour')>=10 then raise exception 'Limite de 10 comentários por artigo por hora'; end if;
    insert into academy_community_comments(id,article_id,user_id,author,content) values((command->>'commentId')::uuid,article,actor,who.name,trim(command->>'content'));
   end if;
   reward_action:='comment';event:='comment:'||actor;points:=1;
  end if;
 end if;

 if event is not null and meta.author_id is not null and (reward_action='publish' or meta.author_id<>actor) then
  if not exists(select 1 from academy_community_rewards where article_id=article and event_key=event) then
   select coalesce(sum(amount),0) into used from academy_community_rewards where author_id=meta.author_id and week=week_start;
   if reward_action='publish' then
    if (select count(*) from academy_community_rewards where author_id=meta.author_id and action='publish' and amount>0 and week=week_start)>=2 then points:=0; end if;
   else
    select coalesce(sum(amount),0) into interaction_used from academy_community_rewards where article_id=article and action<>'publish';
    points:=least(points,greatest(0,20-interaction_used));
   end if;
   points:=least(points,greatest(0,40-used));
   insert into academy_community_rewards(article_id,author_id,actor_id,event_key,action,amount,week) values(article,meta.author_id,actor,event,reward_action,points,week_start) returning id into reward_id;
   if points>0 then
    insert into academy_xp(id,user_id,course_id,event_key,amount,season,label) values(reward_id,meta.author_id,article,'community:'||reward_id,points,to_char(now() at time zone 'America/Sao_Paulo','YYYY'),'Biblioteca · '||coalesce(body->>'title',doc.published->>'title'));
   end if;
  end if;
 end if;
 insert into academy_audit(actor,action,resource) values(actor,op,article);
end;
$$;
create or replace function public.academy_community_read(actor uuid, article_id text default null, edit boolean default false) returns jsonb
language plpgsql stable set search_path=public,pg_temp as $$
#variable_conflict use_variable
declare
 who academy_profiles; item record; body jsonb; result jsonb; articles jsonb:='[]'; drafts jsonb:='[]'; comments jsonb:='[]';
begin
 select * into who from academy_profiles where id=actor and status='active' and coalesce(audience,'internal')='internal';
 if not found then raise exception 'A biblioteca é exclusiva dos colaboradores aprovados'; end if;
 for item in
  select r.*,m.author_id,m.update_request,m.deleted_at
  from academy_resources r join academy_community_articles m on m.article_id=r.id
  where r.kind='article' and m.deleted_at is null and (article_id is null or r.id=article_id)
  order by r.updated_at desc,r.id
 loop
  if article_id is not null then
   if edit and item.author_id is distinct from actor and who.role<>'admin' then raise exception 'Somente o autor pode editar este artigo'; end if;
   body:=case when edit then coalesce(item.draft,item.published) else item.published end;
   if body is null then raise exception 'Artigo não encontrado'; end if;
  else body:=item.published;
  end if;
  result:=jsonb_build_object('revision',item.revision,'likeCount',(select count(*) from academy_community_reactions where academy_community_reactions.article_id=item.id and reaction='like' and active),'hypeCount',(select count(*) from academy_community_reactions where academy_community_reactions.article_id=item.id and reaction='hype' and active),'commentCount',(select count(*) from academy_community_comments where academy_community_comments.article_id=item.id),'liked',exists(select 1 from academy_community_reactions where academy_community_reactions.article_id=item.id and user_id=actor and reaction='like' and active),'hyped',exists(select 1 from academy_community_reactions where academy_community_reactions.article_id=item.id and user_id=actor and reaction='hype' and active),'updateRequest',item.update_request,'bodyLoaded',article_id is not null);
  if body is not null then
   if article_id is null then body:=(body-'blocks'-'richContent'-'content')||jsonb_build_object('content','','summary',coalesce(body->>'summary',left(body->>'content',240))); end if;
   body:=body||result;
   if article_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'articleId',c.article_id,'userId',coalesce(c.user_id::text,''),'author',c.author,'content',c.content,'createdAt',c.created_at) order by c.created_at,c.id),'[]') into comments from academy_community_comments c where c.article_id=item.id;
    return jsonb_build_object('article',body,'comments',comments);
   end if;
   articles:=articles||jsonb_build_array(body);
  end if;
  if article_id is null and item.draft is not null and (item.author_id=actor or who.role='admin') then
   drafts:=drafts||jsonb_build_array((item.draft-'blocks'-'richContent'-'content')||jsonb_build_object('content','','summary',coalesce(item.draft->>'summary',left(item.draft->>'content',240)))||result);
  end if;
 end loop;
 if article_id is not null then raise exception 'Artigo não encontrado'; end if;
 return jsonb_build_object('articles',articles,'articleDrafts',drafts);
end;
$$;
commit;
