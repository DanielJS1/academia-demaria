import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const db = new PGlite();
const migrations = readdirSync(join("supabase", "migrations")).filter(name => name.endsWith(".sql")).sort();
try {
  await db.exec("create schema auth; create table auth.users(id uuid primary key); create role service_role; create role anon; create role authenticated; create schema storage; create table storage.buckets (id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
  for (const name of migrations.filter(name => name <= "202609240008_lesson_notes.sql")) {
    try {
      await db.exec(readFileSync(join("supabase", "migrations", name), "utf8").replace(/^\uFEFF/, ""));
      process.stdout.write(`${name} OK\n`);
    } catch (error) {
      process.stderr.write(`${name}: ${error.message}\n`);
      process.exitCode = 1;
      break;
    }
  }
  if (!process.exitCode) {
    const manager = "00000000-0000-4000-8000-000000000001";
    const learner = "00000000-0000-4000-8000-000000000002";
    await db.query("insert into auth.users(id) values ($1::uuid),($2::uuid)", [manager, learner]);
    await db.query("insert into public.academy_profiles(id,name,email,department,role,status) values ($1::uuid,'Gestor','g@example.test','TI','admin','active'),($2::uuid,'Aluno','a@example.test','TI','student','active')", [manager, learner]);
    const course = { id: "course", status: "published", audience: "internal", title: "Curso", level: "essencial", lessons: [{ id: "lesson", type: "video", title: "Vídeo", minutes: 1 }] };
    await db.query("insert into public.academy_resources(id,kind,published,revision) values ('course','course',$1::jsonb,1)", [JSON.stringify(course)]);
    const video = { type: "video", courseId: "course", version: 1, lessonId: "lesson", duration: 100, position: 90, ranges: [[0, 90]] };
    let shortRejected = false;
    try { await db.query("select public.academy_save_video_progress($1::uuid,$2::jsonb)", [learner, JSON.stringify({ ...video, duration: 1, position: 1, ranges: [[0, 1]] })]); } catch { shortRejected = true; }
    if (!shortRejected) throw new Error("Forged one-second duration was accepted");
    let rejected = false;
    try { await db.query("select public.academy_save_video_progress($1::uuid,$2::jsonb)", [learner, JSON.stringify(video)]); } catch { rejected = true; }
    if (!rejected) { const debug = await db.query("select ranges,done,last_played_at from public.academy_progress where user_id=$1::uuid", [learner]); throw new Error(`Forged 90-second completion was accepted: ${JSON.stringify(debug.rows)}`); }
    await db.query("select public.academy_save_video_progress($1::uuid,$2::jsonb)", [learner, JSON.stringify({ ...video, position: 10, ranges: [[0, 10]] })]);
    await db.query("select public.academy_save_video_progress($1::uuid,$2::jsonb)", [learner, JSON.stringify({ ...video, position: 5, ranges: [[0, 5]] })]);
    const progress = await db.query("select position,done from public.academy_progress where user_id=$1::uuid", [learner]);
    if (Number(progress.rows[0].position) !== 10 || progress.rows[0].done) throw new Error("Stale video save regressed progress");
    await db.query("update public.academy_progress set last_played_at=now()-interval '100 seconds' where user_id=$1::uuid", [learner]);
    await db.query("select public.academy_save_video_progress($1::uuid,$2::jsonb)", [learner, JSON.stringify(video)]);
    await db.query("select public.academy_save_video_progress($1::uuid,$2::jsonb)", [learner, JSON.stringify(video)]);
    const lessonReward = await db.query("select count(*)::integer as count from public.academy_xp where user_id=$1::uuid and event_key='lesson:lesson'", [learner]);
    if (lessonReward.rows[0].count !== 1) throw new Error("Video completion granted lesson XP twice");
    const requestId = "00000000-0000-4000-8000-000000000003";
    for (let i = 0; i < 2; i++) await db.query("select public.academy_grant_recognition($1::uuid,$2::uuid,'Entrega','Ótima entrega',$3::uuid)", [manager, learner, requestId]);
    const reward = await db.query("select count(*)::integer as count from public.academy_xp where user_id=$1::uuid and event_key=$2", [learner, `recognition:${requestId}`]);
    if (reward.rows[0].count !== 1) throw new Error("Recognition granted XP twice");
    process.stdout.write("RPC behavior OK\n");
    // Preserve the original security regression at its schema boundary. Later
    // video recovery migrations intentionally changed duration validation.
    for (const name of migrations.filter(name => name > "202609240008_lesson_notes.sql")) {
      await db.exec(readFileSync(join("supabase", "migrations", name), "utf8").replace(/^\uFEFF/, ""));
      process.stdout.write(`${name} OK\n`);
    }
    const definitions = await db.query("select proname, pg_get_functiondef(oid) as definition, prosecdef, has_function_privilege('anon',oid,'EXECUTE') as anon_execute, has_function_privilege('authenticated',oid,'EXECUTE') as client_execute, has_function_privilege('service_role',oid,'EXECUTE') as server_execute from pg_proc where pronamespace='public'::regnamespace and proname in ('academy_save_periodic_quiz','academy_submit_periodic_quiz','academy_set_periodic_quiz_active','academy_delete_periodic_quiz','academy_read_periodic_quiz','academy_list_periodic_quizzes','academy_set_quiz_notifications','academy_read_quiz_notifications')");
    if (definitions.rows.length !== 8) throw new Error("Final quiz RPC set is incomplete or contains obsolete overloads");
    for (const rpc of definitions.rows) {
      if (rpc.prosecdef || rpc.anon_execute || rpc.client_execute || !rpc.server_execute) throw new Error(`Unsafe final RPC grants: ${rpc.proname}`);
      if (rpc.definition.includes('academy_save_periodic_quiz.quiz_id')) throw new Error("Invalid quiz identifier survived the migration chain");
    }
    process.stdout.write("Final challenge RPC definitions and grants OK\n");
    const tables = await db.query("select relname,relrowsecurity,has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE') as anon_access,has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE') as client_access from pg_class where relnamespace='public'::regnamespace and relname in ('academy_quizzes','academy_quiz_questions','academy_quiz_attempts','academy_preferences')");
    if (tables.rows.length !== 4 || tables.rows.some(table => !table.relrowsecurity || table.anon_access || table.client_access)) throw new Error("Final challenge table RLS or grants are unsafe");
    process.stdout.write("Final challenge table RLS and grants OK\n");
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
} finally { await db.close(); }
