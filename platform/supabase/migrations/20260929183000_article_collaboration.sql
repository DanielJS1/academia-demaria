begin;

create table public.academy_article_suggestions (
 id uuid primary key default gen_random_uuid(),
 article_id text not null references public.academy_resources(id),
 proposer_id uuid not null references public.academy_profiles(id) on delete cascade,
 proposed_text text not null check (length(trim(proposed_text)) between 20 and 5000),
 accepted_text text,
 status text not null default 'pending' check (status in ('pending','accepted','rejected')),
 created_at timestamptz not null default now(), reviewed_at timestamptz
);
create unique index academy_article_one_pending_suggestion on public.academy_article_suggestions(article_id,proposer_id) where status='pending';
create index academy_article_suggestions_article on public.academy_article_suggestions(article_id,created_at desc);
create table public.academy_article_coauthors (
 article_id text primary key references public.academy_resources(id),
 user_id uuid not null references public.academy_profiles(id) on delete cascade,
 suggestion_id uuid not null unique references public.academy_article_suggestions(id),
 accepted_at timestamptz not null default now()
);
alter table public.academy_article_suggestions enable row level security;
alter table public.academy_article_coauthors enable row level security;
revoke all on public.academy_article_suggestions,public.academy_article_coauthors from public,anon,authenticated;
grant all on public.academy_article_suggestions,public.academy_article_coauthors to service_role;

create function public.academy_article_collaborate(actor uuid, command jsonb) returns void
language plpgsql set search_path=public,pg_temp as $$
declare
 op text := command->>'type'; article text := command->>'articleId';
 proposal text := trim(coalesce(command->>'content',''));
 decision text := command->>'decision'; suggestion public.academy_article_suggestions;
 doc public.academy_resources; meta public.academy_community_articles;
 body jsonb; changed_at timestamptz := now(); bonus integer;
begin
 if not exists(select 1 from academy_profiles where id=actor and status='active' and coalesce(audience,'internal')='internal') then raise exception 'A biblioteca é exclusiva dos colaboradores aprovados'; end if;
 if article is null or length(article) not between 1 and 100 then raise exception 'Artigo inválido'; end if;
 perform pg_advisory_xact_lock(742019,1);
 select * into doc from academy_resources where id=article and kind='article' for update;
 select * into meta from academy_community_articles where article_id=article and deleted_at is null;
 if doc.published is null or meta.author_id is null then raise exception 'Artigo indisponível'; end if;
 if op='community-suggest' then
  if actor=meta.author_id or exists(select 1 from academy_article_coauthors where article_id=article and user_id=actor) then raise exception 'Você já é autor deste artigo'; end if;
  if exists(select 1 from academy_article_coauthors where article_id=article) then raise exception 'Este artigo já possui coautor'; end if;
  if length(proposal) not between 20 and 5000 then raise exception 'Descreva a melhoria em 20 a 5000 caracteres'; end if;
  insert into academy_article_suggestions(article_id,proposer_id,proposed_text) values(article,actor,proposal);
 elsif op='community-review-suggestion' then
  if actor<>meta.author_id then raise exception 'Somente o autor pode analisar esta sugestão'; end if;
  select * into suggestion from academy_article_suggestions where id=(command->>'suggestionId')::uuid and article_id=article for update;
  if not found or suggestion.status<>'pending' then raise exception 'Sugestão não está pendente'; end if;
  if decision not in ('accept','reject') then raise exception 'Decisão inválida'; end if;
  if decision='reject' then
   update academy_article_suggestions set status='rejected',reviewed_at=changed_at where id=suggestion.id;
  else
   if exists(select 1 from academy_article_coauthors where article_id=article) then raise exception 'Este artigo já possui coautor'; end if;
   if not (command ? 'content') then proposal:=suggestion.proposed_text; end if;
   if length(proposal) not between 20 and 5000 then raise exception 'O texto ajustado deve ter 20 a 5000 caracteres'; end if;
   body:=doc.published;
   body:=jsonb_set(body,'{content}',to_jsonb(coalesce(body->>'content','')||E'\n\n'||proposal));
   if body ? 'richContent' then
    body:=jsonb_set(body,'{richContent,content}',coalesce(body#>'{richContent,content}','[]'::jsonb)||jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',proposal)))));
   elsif body ? 'blocks' then
    body:=jsonb_set(body,'{blocks}',coalesce(body->'blocks','[]'::jsonb)||jsonb_build_array(jsonb_build_object('id',suggestion.id::text,'type','paragraph','text',proposal)));
   end if;
   body:=body||jsonb_build_object('revision',doc.revision+1,'updatedAt',changed_at,'summary',left(regexp_replace(body->>'content','\s+',' ','g'),240));
   -- Keep an unpublished author draft in sync so a later publication cannot erase the accepted contribution.
   if doc.draft is not null then
    doc.draft:=jsonb_set(doc.draft,'{content}',to_jsonb(coalesce(doc.draft->>'content','')||E'\n\n'||proposal));
    if doc.draft ? 'richContent' then
     doc.draft:=jsonb_set(doc.draft,'{richContent,content}',coalesce(doc.draft#>'{richContent,content}','[]'::jsonb)||jsonb_build_array(jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text',proposal)))));
    elsif doc.draft ? 'blocks' then
     doc.draft:=jsonb_set(doc.draft,'{blocks}',coalesce(doc.draft->'blocks','[]'::jsonb)||jsonb_build_array(jsonb_build_object('id',suggestion.id::text,'type','paragraph','text',proposal)));
    end if;
    doc.draft:=doc.draft||jsonb_build_object('revision',doc.revision+1,'updatedAt',changed_at);
   end if;
   update academy_resources set published=body,draft=doc.draft,revision=revision+1,updated_at=changed_at where id=article;
   update academy_article_suggestions set status='accepted',accepted_text=proposal,reviewed_at=changed_at where id=suggestion.id;
   insert into academy_article_coauthors(article_id,user_id,suggestion_id,accepted_at) values(article,suggestion.proposer_id,suggestion.id,changed_at);
   select least(5,
    greatest(0,20-coalesce(sum(amount) filter(where event_key like 'collab:%'),0)),
    greatest(0,40-coalesce(sum(amount),0))) into bonus
   from academy_xp where user_id=suggestion.proposer_id and (event_key like 'collab:%' or event_key like 'community:%') and created_at>=date_trunc('week',changed_at at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
   if bonus>0 then
    insert into academy_xp(user_id,course_id,event_key,amount,season,label) values(suggestion.proposer_id,article,'collab:bonus:'||suggestion.id,bonus,to_char(changed_at at time zone 'America/Sao_Paulo','YYYY'),'Colaboração na biblioteca · '||left(body->>'title',100));
   end if;
  end if;
 else raise exception 'Comando desconhecido'; end if;
 insert into academy_audit(actor,action,resource) values(actor,op,article);
end;
$$;
revoke all on function public.academy_article_collaborate(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.academy_article_collaborate(uuid,jsonb) to service_role;

create function public.academy_collaboration_reward() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare collaborator public.academy_article_coauthors; earned integer; target_points integer; weekly integer; library_weekly integer; lifetime integer; granted integer;
begin
 if tg_op='UPDATE' then
  if new.revoked_at is not null and old.revoked_at is null then
   update academy_xp set amount=0 where course_id=new.article_id and event_key like 'collab:%';
  end if;
  return new;
 end if;
 if new.action='publish' or new.amount=0 or new.revoked_at is not null then return new; end if;
 select * into collaborator from academy_article_coauthors where article_id=new.article_id and accepted_at<=new.created_at;
 if not found or collaborator.user_id=new.actor_id then return new; end if;
 select coalesce(sum(amount),0) into earned from academy_community_rewards where article_id=new.article_id and action<>'publish' and revoked_at is null and created_at>=collaborator.accepted_at;
 target_points:=floor(earned/2);
 select coalesce(sum(amount),0) into lifetime from academy_xp where user_id=collaborator.user_id and course_id=new.article_id and event_key like 'collab:interaction:%';
 select coalesce(sum(amount),0) into weekly from academy_xp where user_id=collaborator.user_id and event_key like 'collab:%' and created_at>=date_trunc('week',new.created_at at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
 select coalesce(sum(amount),0) into library_weekly from academy_xp where user_id=collaborator.user_id and (event_key like 'collab:%' or event_key like 'community:%') and created_at>=date_trunc('week',new.created_at at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
 granted:=least(greatest(0,target_points-lifetime),greatest(0,10-lifetime),greatest(0,20-weekly),greatest(0,40-library_weekly));
 if granted>0 then
  insert into academy_xp(user_id,course_id,event_key,amount,season,label) values(collaborator.user_id,new.article_id,'collab:interaction:'||new.id,granted,to_char(new.created_at at time zone 'America/Sao_Paulo','YYYY'),'Coautoria na biblioteca');
 end if;
 return new;
end;
$$;
create trigger academy_collaboration_reward_insert after insert on public.academy_community_rewards for each row execute function public.academy_collaboration_reward();
create trigger academy_collaboration_reward_revoke after update of revoked_at on public.academy_community_rewards for each row execute function public.academy_collaboration_reward();
revoke all on function public.academy_collaboration_reward() from public,anon,authenticated;

create function public.academy_collaboration_guard() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_table_name='academy_community_comments' then
  if exists(select 1 from academy_article_coauthors where article_id=new.article_id and user_id=new.user_id) then raise exception 'Coautores não podem interagir com o próprio artigo'; end if;
 elsif new.active and exists(select 1 from academy_article_coauthors where article_id=new.article_id and user_id=new.user_id) then
  raise exception 'Coautores não podem interagir com o próprio artigo';
 end if;
 return new;
end;
$$;
create trigger academy_coauthor_reaction_guard before insert or update of active on public.academy_community_reactions for each row execute function public.academy_collaboration_guard();
create trigger academy_coauthor_comment_guard before insert on public.academy_community_comments for each row execute function public.academy_collaboration_guard();
revoke all on function public.academy_collaboration_guard() from public,anon,authenticated;

commit;
