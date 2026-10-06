import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { strict as assert } from "node:assert";

// Deliberately refuses remote databases and requires a dedicated, empty database.
const port = process.env.QUIZ_PG_PORT;
const database = process.env.QUIZ_PG_DATABASE;
const user = process.env.QUIZ_PG_USER;
if (!port || !/^\d+$/.test(port) || !database?.startsWith("quiz_") || !user)
  throw new Error("Configure QUIZ_PG_PORT, QUIZ_PG_DATABASE=quiz_..., QUIZ_PG_USER for an empty local test database");
const binary = process.env.QUIZ_PSQL_PATH || "psql";
const sqlLiteral = value => `'${String(value).replaceAll("'", "''")}'`;
const json = value => `${sqlLiteral(JSON.stringify(value))}::jsonb`;
function sql(statement) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ["-h", "127.0.0.1", "-p", port, "-U", user, "-d", database, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"], { windowsHide: true });
    let output = "", error = "";
    child.stdout.on("data", data => output += data);
    child.stderr.on("data", data => error += data);
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(error.trim())));
    child.stdin.end(statement);
  });
}
const admin = "11111111-1111-4111-8111-111111111111";
const learner = "22222222-2222-4222-8222-222222222222";
const check = (name) => process.stdout.write(`${name} OK\n`);
assert.equal(await sql("select count(*) from pg_tables where schemaname='public'"), "0", "Test database must be empty");
assert(Number(await sql("show server_version_num")) >= 170000, "Use PostgreSQL 17 or later for this verification");
process.stdout.write(`${await sql("select version()" )}\n`);
await sql(`create extension pgcrypto; create schema auth; create table auth.users(id uuid primary key);
 do $$ begin
   if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
   if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
   if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
 end $$;
 create table academy_profiles(id uuid primary key references auth.users(id),status text,audience text,role text default 'student');
 create table academy_preferences(user_id uuid primary key references academy_profiles(id),bookmarks jsonb not null default '[]',read_notices jsonb not null default '[]');
 create table academy_xp(id uuid primary key default gen_random_uuid(),user_id uuid,course_id text,event_key text,amount integer,season text,label text);
 insert into auth.users values('${admin}'),('${learner}');
 insert into academy_profiles values('${admin}','active','internal','admin'),('${learner}','active','internal','student');`);
for (const migration of ["202609240009_periodic_quizzes", "202609240010_quiz_question_media", "202609250001_periodic_quiz_admin", "202609250002_periodic_quiz_delete", "20261006181438_fix_periodic_quiz_save", "20261006182007_periodic_quiz_history_rewards", "20261006193250_periodic_quiz_notifications"])
  await sql(readFileSync(new URL(`../supabase/migrations/${migration}.sql`, import.meta.url), "utf8").replace(/^\uFEFF/, ""));
function draft() {
  return { title: "Desafio concorrente", slug: `fixture-${randomUUID()}`, description: "Fixture", category: "sistema", xpReward: 70, passingScore: 70, periodType: "weekly", targetAudience: "internal", isActive: true, isFeatured: false, availableFrom: "2020-01-01T00:00:00Z", expiresAt: null,
    questions: Array.from({ length: 5 }, (_, i) => ({ id: randomUUID(), prompt: `Pergunta ${i}`, options: [{ id: "a", text: "Certa" }, { id: "b", text: "Errada" }], correctOptionId: "a", explanation: "Explicação", imageUrl: "", imageAlt: "" })) };
}
const saveSql = payload => `select academy_save_periodic_quiz('${admin}',${json(payload)});`;
const answers = (payload, correct) => Object.fromEntries(payload.questions.map((q, i) => [q.id, i < correct ? "a" : "b"]));
const submitSql = (id, payload, correct, revision = 1) => `select academy_submit_periodic_quiz('${learner}','${id}',${json(answers(payload, correct))},${revision});`;
// Wait for the first transaction to own the row lock, rather than relying on timing.
async function lockedRace(id, firstSql, secondSql) {
  const first = sql(`begin; ${firstSql} select pg_sleep(1); commit;`);
  let locked = false;
  for (let i = 0; i < 100; i++) {
    locked = (await sql(`select exists(select 1 from pg_stat_activity where pid<>pg_backend_pid() and query like '%pg_sleep(1)%' and state='active')`)) === "t";
    if (locked) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert(locked, `First transaction did not acquire its lock for ${id}`);
  const second = sql(secondSql);
  return Promise.allSettled([first, second]);
}

let payload = draft(), id = await sql(saveSql(payload));
let results = await lockedRace(id, submitSql(id, payload, 3), submitSql(id, payload, 5));
assert(results.every(result => result.status === "fulfilled"));
const original = JSON.parse(results[0].value.split("\n")[0]), replay = JSON.parse(results[1].value);
assert.equal(original.xpGranted, 6); assert.equal(replay.xpGranted, 6); assert.equal(replay.newlyGrantedXp, 0); assert.equal(replay.attemptId, original.attemptId);
assert.equal(await sql(`select count(*)||':'||sum(xp_granted) from academy_quiz_attempts where quiz_id='${id}'`), "1:6");
assert.equal(await sql(`select count(*)||':'||sum(amount) from academy_xp where event_key='quiz:${id}'`), "1:6");
check("Different simultaneous submissions preserve original attempt and single XP");

payload = draft(); id = await sql(saveSql(payload));
results = await lockedRace(id, saveSql({ ...payload, id, expectedRevision: 1, passingScore: 60 }), submitSql(id, payload, 3));
assert.equal(results[0].status, "fulfilled"); assert.equal(results[1].status, "rejected"); assert.match(results[1].reason.message, /QUIZ_REVISION_CONFLICT/);
assert.equal(await sql(`select count(*) from academy_quiz_attempts where quiz_id='${id}'`), "0");
const changedResult = JSON.parse(await sql(submitSql(id, payload, 3, 2)));
assert.equal(changedResult.xpGranted, 70); assert.equal(changedResult.passingScore, 60);
check("Concurrent rule change rejects stale submission without partial XP");

payload = draft(); id = await sql(saveSql(payload));
const editedQuestions = payload.questions.map((question, i) => i === 0 ? { ...question, prompt: "Outra pergunta" } : question);
results = await lockedRace(id, submitSql(id, payload, 3), saveSql({ ...payload, id, expectedRevision: 1, questions: editedQuestions }));
assert.equal(results[0].status, "fulfilled"); assert.equal(results[1].status, "rejected"); assert.match(results[1].reason.message, /QUIZ_CONTENT_LOCKED/);
assert.equal(await sql(`select prompt from academy_quiz_questions where id='${payload.questions[0].id}'`), "Pergunta 0");
check("Official attempt locks questions during concurrent admin save");

payload = draft(); id = await sql(saveSql(payload));
results = await lockedRace(id, saveSql({ ...payload, id, expectedRevision: 1, title: "Título vencedor" }), saveSql({ ...payload, id, expectedRevision: 1, title: "Título atrasado" }));
assert.equal(results[0].status, "fulfilled"); assert.equal(results[1].status, "rejected"); assert.match(results[1].reason.message, /QUIZ_REVISION_CONFLICT/);
assert.equal(await sql(`select title||':'||revision from academy_quizzes where id='${id}'`), "Título vencedor:2");
assert.equal(await sql(`select count(*) from academy_quiz_questions where quiz_id='${id}' and id in (${payload.questions.map(q => sqlLiteral(q.id)).join(",")})`), "5");
check("Concurrent admin edits preserve winner, revision and question IDs");

const enable = `select academy_set_quiz_notifications('${learner}',true); select jsonb_build_object('since',quiz_notifications_since) from academy_preferences where user_id='${learner}';`;
results = await lockedRace("preferences", enable, enable);
assert(results.every(result => result.status === "fulfilled"));
const firstPreference = JSON.parse(results[0].value.split("\n")[0]), secondPreference = JSON.parse(results[1].value);
assert.deepEqual(firstPreference, secondPreference);
assert.equal(await sql(`select quiz_notifications_enabled from academy_preferences where user_id='${learner}'`), "t");
check("Concurrent opt-in does not advance subscription timestamp");
results = await lockedRace("preferences", `update academy_preferences set bookmarks='["course-fixture"]',read_notices='["notice-fixture"]' where user_id='${learner}';`, `select academy_set_quiz_notifications('${learner}',false);`);
assert(results.every(result => result.status === "fulfilled"));
assert.deepEqual(JSON.parse(await sql(`select jsonb_build_object('enabled',quiz_notifications_enabled,'bookmarks',bookmarks,'read',read_notices) from academy_preferences where user_id='${learner}'`)), { enabled: false, bookmarks: ["course-fixture"], read: ["notice-fixture"] });
check("Concurrent preference and bookmark/read writes preserve independent columns");
