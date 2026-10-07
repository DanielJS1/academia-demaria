-- Read-only evidence: run and save output before and after rollout.
-- Snapshot fingerprints must remain identical; new snapshots/columns are excluded.
select count(*) as attempts,
 coalesce(sum(xp_granted),0) as attempt_xp,
 md5(coalesce(string_agg(concat_ws('|',id,user_id,quiz_id,score_percentage,passed,xp_granted,completed_at),';' order by id),'')) as attempts_fingerprint
from public.academy_quiz_attempts;
select count(*) as quiz_xp_events,coalesce(sum(amount),0) as quiz_xp,
 md5(coalesce(string_agg(concat_ws('|',id,user_id,event_key,amount),';' order by id),'')) as xp_fingerprint
from public.academy_xp where event_key like 'quiz:%';

select table_name,column_name,data_type,column_default
from information_schema.columns where table_schema='public' and
 ((table_name='academy_quizzes' and column_name in ('revision','announcement_at')) or
  (table_name='academy_quiz_attempts' and column_name in ('snapshot','snapshot_status','quiz_revision','scoring_version','passing_score_snapshot','xp_reward_snapshot')) or
  (table_name='academy_preferences' and column_name in ('quiz_notifications_enabled','quiz_notifications_since')))
order by table_name,column_name;

select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
 p.prosecdef as security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
 md5(pg_get_functiondef(p.oid)) as definition_fingerprint,
 position('academy_save_periodic_quiz.quiz_id' in pg_get_functiondef(p.oid)) > 0 as invalid_identifier
from pg_proc p where p.pronamespace='public'::regnamespace and
 p.proname in ('academy_save_periodic_quiz','academy_submit_periodic_quiz','academy_set_periodic_quiz_active','academy_delete_periodic_quiz','academy_read_periodic_quiz','academy_list_periodic_quizzes','academy_set_quiz_notifications','academy_read_quiz_notifications')
order by p.proname,arguments;

select c.relname,c.relrowsecurity,
 has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_access,
 has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_access
from pg_class c where c.relnamespace='public'::regnamespace and
 c.relname in ('academy_quizzes','academy_quiz_questions','academy_quiz_attempts','academy_preferences');
select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename in ('academy_quizzes','academy_quiz_questions','academy_quiz_attempts') order by tablename,indexname;
