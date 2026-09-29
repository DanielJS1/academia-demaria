begin;
alter table public.academy_progress add column if not exists position numeric not null default 0;
alter table public.academy_progress add column if not exists last_played_at timestamptz;

create or replace function public.academy_save_video_progress(actor uuid, command jsonb) returns void
language plpgsql set search_path=public,pg_temp as $$
declare
 doc public.academy_resources;
 lesson jsonb;
 old public.academy_progress;
 duration_seconds numeric := (command->>'duration')::numeric;
 playback_position numeric := (command->>'position')::numeric;
 merged jsonb := '[]'::jsonb;
 segment jsonb;
 start_second numeric;
 end_second numeric;
 prior_end numeric;
 watched numeric := 0;
 previous_watched numeric := 0;
 is_admin boolean;
 completed boolean;
begin
 if command->'ranges' is null or jsonb_typeof(command->'ranges') <> 'array' or jsonb_array_length(command->'ranges') > 2000
  or duration_seconds is null or duration_seconds <= 0 or duration_seconds > 86400
  or playback_position is null or playback_position < 0 or playback_position > duration_seconds + 2 then
  raise exception 'Avanço inválido';
 end if;
 select * into doc from public.academy_resources where id=command->>'courseId' and kind='course' and published is not null for update;
 if not found or not public.academy_course_allowed(actor,doc.published) then raise exception 'Curso não autorizado'; end if;
 if doc.revision <> (command->>'version')::integer then raise exception 'O curso mudou. Atualize a página'; end if;
 select value into lesson from jsonb_array_elements(doc.published->'lessons') where value->>'id'=command->>'lessonId' and value->>'type'='video';
 if lesson is null then raise exception 'Vídeo inválido'; end if;
 -- Editorial minutes determine XP, not the actual media duration.
 select role='admin' into is_admin from public.academy_profiles where id=actor and status='active';

 -- The course lock serializes saves for this course; the row lock protects existing progress.
 select * into old from public.academy_progress where user_id=actor and course_id=doc.id and version=doc.revision and lesson_id=lesson->>'id' for update;
 if found and old.duration > 0 and abs(old.duration-duration_seconds) > greatest(5,old.duration*0.05) then raise exception 'Duração do vídeo mudou'; end if;
 for segment in select value from jsonb_array_elements(command->'ranges') loop
  if jsonb_typeof(segment) <> 'array' or jsonb_array_length(segment) <> 2 then raise exception 'Intervalo inválido'; end if;
  start_second := (segment->>0)::numeric; end_second := (segment->>1)::numeric;
  if start_second is null or end_second is null or start_second < 0 or start_second >= duration_seconds or end_second > duration_seconds + 2 or end_second <= start_second then raise exception 'Intervalo inválido'; end if;
 end loop;
 for segment in
  select jsonb_build_array(s,e) from (
   select (value->>0)::numeric s,(value->>1)::numeric e from jsonb_array_elements(coalesce(old.ranges,'[]'::jsonb) || (command->'ranges'))
  ) intervals order by s,e
 loop
  start_second := (segment->>0)::numeric; end_second := least(duration_seconds,(segment->>1)::numeric);
  if jsonb_array_length(merged)>0 then
   prior_end := (merged->(jsonb_array_length(merged)-1)->>1)::numeric;
  else prior_end := null; end if;
  if prior_end is not null and start_second <= prior_end+0.25 then
   merged := jsonb_set(merged,array[(jsonb_array_length(merged)-1)::text,'1'],to_jsonb(greatest(prior_end,end_second)));
  else merged := merged || jsonb_build_array(jsonb_build_array(start_second,end_second)); end if;
 end loop;
 for segment in select value from jsonb_array_elements(merged) loop
  watched := watched + (segment->>1)::numeric-(segment->>0)::numeric;
 end loop;
 if old.ranges is not null then
  for segment in select value from jsonb_array_elements(old.ranges) loop
   previous_watched := previous_watched+(segment->>1)::numeric-(segment->>0)::numeric;
  end loop;
 end if;
 -- Played ranges may arrive after buffering, offline retries, accelerated playback,
 -- or another tab. Request arrival time is not evidence of time spent watching.
 -- Merge unique played intervals; seeking alone never contributes watched seconds.
 completed := greatest(coalesce(old.position,0),playback_position) >= duration_seconds-least(2,duration_seconds*0.01)
              and (coalesce(is_admin,false) or watched >= duration_seconds*0.5);
 insert into public.academy_progress(user_id,course_id,version,lesson_id,done,ranges,duration,position,last_played_at)
 values(actor,doc.id,doc.revision,lesson->>'id',completed,merged,duration_seconds,playback_position,clock_timestamp())
 on conflict(user_id,course_id,version,lesson_id) do update
 set done=academy_progress.done or excluded.done,ranges=excluded.ranges,duration=excluded.duration,
     position=greatest(academy_progress.position,excluded.position),
     last_played_at=case when watched>previous_watched then excluded.last_played_at else academy_progress.last_played_at end,
     updated_at=case when watched>previous_watched or playback_position>academy_progress.position then clock_timestamp() else academy_progress.updated_at end;
 if completed then
  perform public.academy_award_xp(actor,doc.id,'lesson:'||(lesson->>'id'),10+5*greatest(1,ceil((lesson->>'minutes')::numeric/5)::integer),'Aula concluída · '||(lesson->>'title'));
  if public.academy_course_completed(actor,doc.id,doc.revision) then
   perform public.academy_award_xp(actor,doc.id,'completion',30,'Curso concluído · '||(doc.published->>'title'));
  end if;
 end if;
end;
$$;
revoke all on function public.academy_save_video_progress(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.academy_save_video_progress(uuid,jsonb) to service_role;

commit;
