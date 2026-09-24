import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const db = new PGlite();
try {
  await db.exec("create schema auth; create table auth.users(id uuid primary key); create role service_role; create role anon; create role authenticated; create schema storage; create table storage.buckets (id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
  for (const name of [
    "202609150001_pilot.sql", "202609160001_learning_rewards.sql",
    "202609170001_activity_assessments.sql", "202609170002_fix_settings_where_clause.sql",
    "202609170003_cartorios_and_clients.sql", "202609170004_partial_reviews_and_proficiency.sql",
    "202609210001_community.sql", "202609210002_engagement.sql", "202609210003_profile_avatar.sql",
    "202609230001_media_rich_articles.sql", "202609230001_video_resume.sql",
    "202609240001_manager_recognition.sql", "202609240005_private_article_files.sql",
    "202609240006_video_progress.sql", "202609240007_recognition_idempotency.sql",
    "202609240008_lesson_notes.sql",
  ]) {
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
    const course = { id: "course", status: "published", audience: "internal", title: "Curso", lessons: [{ id: "lesson", type: "video", title: "Vídeo", minutes: 1 }] };
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
  }
} finally { await db.close(); }
