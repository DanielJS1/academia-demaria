begin;

alter table public.academy_article_suggestions
 add column proposed_body jsonb,
 add column base_revision integer;

create function public.academy_article_proposal_body(article_id text, proposal jsonb, next_revision integer, author_id uuid) returns jsonb
language plpgsql stable set search_path=public,pg_temp as $$
declare body jsonb; content text;
begin
 if jsonb_typeof(proposal)<>'object' or proposal->>'id' is distinct from article_id then raise exception 'Artigo inválido'; end if;
 content:=trim(coalesce(proposal->>'content',''));
 if length(trim(coalesce(proposal->>'title',''))) not between 3 and 120 or length(content) not between 80 and 100000 then raise exception 'Revise o título e o conteúdo da proposta'; end if;
 if length(coalesce(proposal->>'product',''))>100 or length(coalesce(proposal->>'category',''))>100 then raise exception 'Metadados inválidos'; end if;
 if proposal ? 'richContent' then
  if jsonb_typeof(proposal->'richContent')<>'object' or proposal->'richContent'->>'type'<>'doc' or jsonb_typeof(proposal->'richContent'->'content')<>'array' or octet_length((proposal->'richContent')::text)>1500000 or (proposal->'richContent')::text ~* 'data:image/|data:application/|blob:' then raise exception 'Conteúdo rico inválido'; end if;
 end if;
 if proposal ? 'blocks' then
  if jsonb_typeof(proposal->'blocks')<>'array' or jsonb_array_length(proposal->'blocks')>80 or octet_length((proposal->'blocks')::text)>1500000 then raise exception 'Blocos inválidos'; end if;
 end if;
 body:=jsonb_build_object('id',article_id,'title',trim(proposal->>'title'),'product',coalesce(proposal->>'product',''),'category',coalesce(proposal->>'category',''),'content',content,'summary',left(regexp_replace(content,'\s+',' ','g'),240),'revision',next_revision,'updatedAt',now(),'author',coalesce((select name from academy_profiles where id=author_id),'Autor'),'authorId',author_id,'community',true,'status','published')
  || case when proposal ? 'richContent' then jsonb_build_object('richContent',proposal->'richContent') else '{}'::jsonb end
  || case when proposal ? 'blocks' then jsonb_build_object('blocks',proposal->'blocks') else '{}'::jsonb end
  || case when proposal ? 'tags' then jsonb_build_object('tags',proposal->'tags') else '{}'::jsonb end;
 return body;
end;
$$;
revoke all on function public.academy_article_proposal_body(text,jsonb,integer,uuid) from public,anon,authenticated;
grant execute on function public.academy_article_proposal_body(text,jsonb,integer,uuid) to service_role;

create function public.academy_article_suggest_edit(actor uuid, article_id text, expected_revision integer, proposal jsonb, message text) returns uuid
language plpgsql set search_path=public,pg_temp as $$
declare doc academy_resources; meta academy_community_articles; body jsonb; suggestion_id uuid;
begin
 if not exists(select 1 from academy_profiles where id=actor and status='active' and coalesce(audience,'internal')='internal') then raise exception 'A biblioteca é exclusiva dos colaboradores aprovados'; end if;
 if article_id is null or length(article_id) not between 1 and 100 or length(trim(coalesce(message,''))) not between 20 and 500 then raise exception 'Explique a melhoria em 20 a 500 caracteres'; end if;
 perform pg_advisory_xact_lock(742019,1);
 select * into doc from academy_resources where id=article_id and kind='article' for update;
 select * into meta from academy_community_articles where academy_community_articles.article_id=academy_article_suggest_edit.article_id and deleted_at is null;
 if doc.published is null or meta.author_id is null then raise exception 'Artigo indisponível'; end if;
 if actor=meta.author_id or exists(select 1 from academy_article_coauthors where academy_article_coauthors.article_id=academy_article_suggest_edit.article_id and user_id=actor) then raise exception 'Você já é autor deste artigo'; end if;
 if exists(select 1 from academy_article_coauthors where academy_article_coauthors.article_id=academy_article_suggest_edit.article_id) then raise exception 'Este artigo já possui coautor'; end if;
 if doc.revision<>expected_revision then raise exception 'O artigo mudou. Reabra o editor antes de enviar a proposta'; end if;
 body:=academy_article_proposal_body(article_id,proposal,doc.revision+1,meta.author_id);
 insert into academy_article_suggestions(article_id,proposer_id,proposed_text,proposed_body,base_revision) values(article_id,actor,trim(message),body,doc.revision) returning id into suggestion_id;
 insert into academy_audit(actor,action,resource) values(actor,'community-suggest-edit',article_id);
 return suggestion_id;
end;
$$;
revoke all on function public.academy_article_suggest_edit(uuid,text,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.academy_article_suggest_edit(uuid,text,integer,jsonb,text) to service_role;

create function public.academy_article_review_edit(actor uuid, article_id text, suggestion_id uuid, decision text, adjustment jsonb default null) returns void
language plpgsql set search_path=public,pg_temp as $$
declare doc academy_resources; meta academy_community_articles; suggestion academy_article_suggestions; body jsonb; bonus integer; decision_time timestamptz:=now();
begin
 if not exists(select 1 from academy_profiles where id=actor and status='active' and coalesce(audience,'internal')='internal') then raise exception 'A biblioteca é exclusiva dos colaboradores aprovados'; end if;
 if decision not in ('accept','reject') then raise exception 'Decisão inválida'; end if;
 perform pg_advisory_xact_lock(742019,1);
 select * into doc from academy_resources where id=article_id and kind='article' for update;
 select * into meta from academy_community_articles where academy_community_articles.article_id=academy_article_review_edit.article_id and deleted_at is null;
 if doc.published is null or meta.author_id is distinct from actor then raise exception 'Somente o autor pode analisar esta proposta'; end if;
 select * into suggestion from academy_article_suggestions where id=suggestion_id and academy_article_suggestions.article_id=academy_article_review_edit.article_id for update;
 if not found or suggestion.status<>'pending' then raise exception 'Sugestão não está pendente'; end if;
 if decision='reject' then
  update academy_article_suggestions set status='rejected',reviewed_at=decision_time where id=suggestion_id;
 else
  if exists(select 1 from academy_article_coauthors where academy_article_coauthors.article_id=academy_article_review_edit.article_id) then raise exception 'Este artigo já possui coautor'; end if;
  if doc.draft is not null then raise exception 'Publique ou conclua seu rascunho antes de aceitar esta proposta'; end if;
  if suggestion.base_revision is not null and doc.revision<>suggestion.base_revision then raise exception 'O artigo mudou desde a proposta. Peça uma nova revisão'; end if;
  if adjustment is null and suggestion.proposed_body is null then raise exception 'Esta sugestão antiga precisa ser ajustada no editor'; end if;
  body:=case when adjustment is null then suggestion.proposed_body else academy_article_proposal_body(article_id,adjustment,doc.revision+1,meta.author_id) end;
  body:=body||jsonb_build_object('revision',doc.revision+1,'updatedAt',decision_time);
  update academy_resources set published=body,revision=revision+1,updated_at=decision_time where id=article_id;
  update academy_community_articles set update_request=null where academy_community_articles.article_id=academy_article_review_edit.article_id;
  update academy_article_suggestions set status='accepted',accepted_text=body->>'content',reviewed_at=decision_time where id=suggestion_id;
  update academy_article_suggestions set status='rejected',reviewed_at=decision_time where academy_article_suggestions.article_id=academy_article_review_edit.article_id and id<>suggestion_id and status='pending';
  insert into academy_article_coauthors(article_id,user_id,suggestion_id,accepted_at) values(article_id,suggestion.proposer_id,suggestion_id,decision_time);
  select least(5,greatest(0,20-coalesce(sum(amount) filter(where event_key like 'collab:%'),0)),greatest(0,40-coalesce(sum(amount),0))) into bonus
  from academy_xp where user_id=suggestion.proposer_id and (event_key like 'collab:%' or event_key like 'community:%') and created_at>=date_trunc('week',decision_time at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  if bonus>0 then insert into academy_xp(user_id,course_id,event_key,amount,season,label) values(suggestion.proposer_id,article_id,'collab:bonus:'||suggestion_id,bonus,to_char(decision_time at time zone 'America/Sao_Paulo','YYYY'),'Colaboração na biblioteca · '||left(body->>'title',100)); end if;
 end if;
 insert into academy_audit(actor,action,resource) values(actor,'community-review-edit',article_id);
end;
$$;
revoke all on function public.academy_article_review_edit(uuid,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.academy_article_review_edit(uuid,text,uuid,text,jsonb) to service_role;

commit;
