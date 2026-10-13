begin;
-- Only a consistent baseline; no current completion receives a migration date.
lock table public.academy_resources, public.academy_progress, public.academy_attempts,
 public.academy_community_articles, public.academy_community_reactions, public.academy_community_rewards in share row exclusive mode;

create table public.academy_report_collection (
 id boolean primary key default true check(id), collected_since timestamptz not null default clock_timestamp()
);
insert into public.academy_report_collection(id) values(true);
create table public.academy_report_publications (
 article_id text primary key references public.academy_resources(id) on delete cascade,
 author_id uuid references public.academy_profiles(id) on delete set null,
 first_published_at timestamptz,
 origin text not null check(origin in ('legacy_reward','baseline_unknown','prospective')),
 check((origin='baseline_unknown')=(first_published_at is null))
);
-- A zero-point/revoked publication reward still proves its original publication date.
insert into public.academy_report_publications
 select distinct on (article_id) article_id,author_id,created_at,'legacy_reward'
 from public.academy_community_rewards where action='publish' order by article_id,created_at,id;
insert into public.academy_report_publications
 select m.article_id,m.author_id,null,'baseline_unknown'
 from public.academy_community_articles m join public.academy_resources r on r.id=m.article_id
 where r.published is not null or m.deleted_at is not null
 on conflict(article_id) do nothing;
create table public.academy_report_reactions (
 id uuid primary key default gen_random_uuid(), article_id text not null references public.academy_resources(id) on delete cascade,
 user_id uuid references public.academy_profiles(id) on delete set null,
 author_id uuid references public.academy_profiles(id) on delete set null,
 reaction text not null check(reaction in ('like','hype')), active boolean not null,
 occurred_at timestamptz not null default clock_timestamp()
);
create table public.academy_report_completion_state (
 user_id uuid not null references public.academy_profiles(id) on delete cascade,
 course_id text not null references public.academy_resources(id) on delete cascade,
 version integer not null check(version>0), complete boolean not null, baseline_complete boolean not null default false, primary key(user_id,course_id,version)
);
create table public.academy_report_completions (
 user_id uuid not null references public.academy_profiles(id) on delete cascade,
 course_id text not null references public.academy_resources(id) on delete cascade,
 version integer not null check(version>0), completed_at timestamptz not null default clock_timestamp(),
 primary key(user_id,course_id,version)
);
create index academy_report_publications_author_date on public.academy_report_publications(author_id,first_published_at);
create index academy_report_reactions_user_date on public.academy_report_reactions(user_id,occurred_at) where active;
create index academy_report_reactions_author_date on public.academy_report_reactions(author_id,occurred_at) where active;
create index academy_report_completions_user_date on public.academy_report_completions(user_id,completed_at);

create function public.academy_report_is_complete(learner uuid, course text, version_number integer) returns boolean
language sql stable security invoker set search_path=public,pg_temp as $$
 select exists(select 1 from academy_resources r join academy_profiles p on p.id=$1
 where r.id=$2 and r.kind='course' and r.published is not null and p.audience='internal'
 and coalesce((r.published->>'version')::integer,r.revision)=$3
 and exists(select 1 from jsonb_array_elements(r.published->'lessons') l where l->>'type'<>'quiz')
 and not exists(select 1 from jsonb_array_elements(r.published->'lessons') l where l->>'type'<>'quiz'
  and not exists(select 1 from academy_progress g where g.user_id=$1 and g.course_id=$2 and g.version=$3 and g.lesson_id=l->>'id' and g.done))
 and (exists(select 1 from academy_attempts a where a.user_id=$1 and a.course_id=$2 and a.status='approved'
  and (a.quiz_id='proficiency' or coalesce((a.snapshot->>'proficiency')::boolean,false)))
 or not exists(select 1 from jsonb_array_elements(r.published->'lessons') l where l->>'type'='quiz'
  and not exists(select 1 from academy_attempts a where a.user_id=$1 and a.course_id=$2 and a.version=$3 and a.status='approved'
   and (a.quiz_id=l->>'id' or (a.quiz_id is null and l->>'id'=(select x->>'id' from jsonb_array_elements(r.published->'lessons') x where x->>'type'='quiz' limit 1)))))));
$$;
insert into public.academy_report_completion_state
 select distinct pair.user_id,pair.course_id,pair.version,public.academy_report_is_complete(pair.user_id,pair.course_id,pair.version),public.academy_report_is_complete(pair.user_id,pair.course_id,pair.version)
 from (select user_id,course_id,version from academy_progress union select user_id,course_id,version from academy_attempts) pair;

create function public.academy_report_capture_completion() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
declare learner uuid; course text; ver integer; current_ver integer; prior boolean; was_baseline boolean; complete_now boolean;
begin
 if tg_op='DELETE' then learner:=old.user_id;course:=old.course_id;ver:=old.version;
 else learner:=new.user_id;course:=new.course_id;ver:=new.version; end if;
 if not exists(select 1 from academy_profiles where id=learner) or not exists(select 1 from academy_resources where id=course) then return null; end if;
 select coalesce((published->>'version')::integer,revision) into current_ver from academy_resources where id=course;
 -- Existing domain semantics allow proficiency across versions. Re-evaluate current too.
 for ver in select distinct v.number from unnest(array[ver,current_ver]) v(number) where v.number is not null order by v.number loop
 perform pg_advisory_xact_lock(hashtextextended(learner::text||':'||course||':'||ver,9351));
 select complete,baseline_complete into prior,was_baseline from academy_report_completion_state where user_id=learner and course_id=course and version=ver for update;
 complete_now:=academy_report_is_complete(learner,course,ver);
 insert into academy_report_completion_state(user_id,course_id,version,complete) values(learner,course,ver,complete_now)
 on conflict(user_id,course_id,version) do update set complete=excluded.complete;
 if complete_now and not coalesce(prior,false) and not coalesce(was_baseline,false) then
  insert into academy_report_completions(user_id,course_id,version) values(learner,course,ver) on conflict do nothing;
 end if;
 end loop;
 return null;
end;
$$;
create function public.academy_report_capture_publication() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if new.kind='article' and new.published is not null then
  insert into academy_report_publications(article_id,author_id,first_published_at,origin)
   select new.id,author_id,clock_timestamp(),'prospective' from academy_community_articles where article_id=new.id and deleted_at is null
   on conflict(article_id) do nothing;
 end if;
 return null;
end;
$$;
create function public.academy_report_capture_reaction() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if (tg_op='INSERT' and new.active) or (tg_op='UPDATE' and old.active is distinct from new.active) then
  insert into academy_report_reactions(article_id,user_id,author_id,reaction,active)
   select new.article_id,new.user_id,author_id,new.reaction,new.active from academy_community_articles where article_id=new.article_id;
 end if;
 return null;
end;
$$;
create trigger academy_report_progress after insert or update or delete on public.academy_progress for each row execute function public.academy_report_capture_completion();
create trigger academy_report_attempt after insert or update or delete on public.academy_attempts for each row execute function public.academy_report_capture_completion();
create trigger academy_report_publication after insert or update of published on public.academy_resources for each row execute function public.academy_report_capture_publication();
create trigger academy_report_reaction after insert or update of active on public.academy_community_reactions for each row execute function public.academy_report_capture_reaction();

alter table public.academy_report_collection enable row level security;
alter table public.academy_report_publications enable row level security;
alter table public.academy_report_reactions enable row level security;
alter table public.academy_report_completion_state enable row level security;
alter table public.academy_report_completions enable row level security;
revoke all on public.academy_report_collection,public.academy_report_publications,public.academy_report_reactions,public.academy_report_completion_state,public.academy_report_completions from public,anon,authenticated;
grant select,insert,update,delete on public.academy_report_collection,public.academy_report_publications,public.academy_report_reactions,public.academy_report_completion_state,public.academy_report_completions to service_role;
revoke all on function public.academy_report_is_complete(uuid,text,integer),public.academy_report_capture_completion(),public.academy_report_capture_publication(),public.academy_report_capture_reaction() from public,anon,authenticated;
grant execute on function public.academy_report_is_complete(uuid,text,integer),public.academy_report_capture_completion(),public.academy_report_capture_publication(),public.academy_report_capture_reaction() to service_role;
commit;
