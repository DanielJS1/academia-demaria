import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const learner = "22222222-2222-4222-8222-222222222222";
const secondLearner = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
let quizId: string;
let questionIds: string[];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users(id uuid primary key);
    create role anon; create role authenticated; create role service_role;
    create table public.academy_profiles(id uuid primary key references auth.users(id), status text not null, audience text not null);
    create table public.academy_xp(id uuid primary key default gen_random_uuid(), user_id uuid not null,
      course_id text, event_key text not null, amount integer not null, season text not null, label text not null);
  `);
  await db.exec(readFileSync(new URL("../../supabase/migrations/202609240009_periodic_quizzes.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../supabase/migrations/202609240010_quiz_question_media.sql", import.meta.url), "utf8"));
  await db.query("insert into auth.users(id) values($1),($2)", [learner, secondLearner]);
  await db.query("insert into academy_profiles(id,status,audience) values($1,'active','internal'),($2,'active','internal')", [learner, secondLearner]);
  const seeded = await db.query<{ id: string }>("select id from academy_quizzes where slug='desafio-doc-fila'");
  quizId = seeded.rows[0].id;
  const questions = await db.query<{ id: string }>("select id from academy_quiz_questions where quiz_id=$1 order by order_index", [quizId]);
  questionIds = questions.rows.map(row => row.id);
}, 30000);

afterAll(async () => { await db?.close(); });

describe("desafios periódicos", () => {
  it("cria seis desafios inativos com duas perguntas cada", async () => {
    const result = await db.query<{ count: number }>("select count(*)::integer as count from academy_quizzes where is_active=false");
    expect(result.rows[0].count).toBe(6);
    expect(questionIds).toHaveLength(2);
  });

  it("recusa desafio inativo e respostas incompletas", async () => {
    const answers = JSON.stringify(Object.fromEntries(questionIds.map(id => [id, "a"])));
    await expect(db.query("select academy_submit_periodic_quiz($1,$2,$3::jsonb)", [learner, quizId, answers])).rejects.toThrow("Desafio indisponível");
    await db.query("update academy_quizzes set is_active=true where id=$1", [quizId]);
    await expect(db.query("select academy_submit_periodic_quiz($1,$2,$3::jsonb)", [learner, quizId, JSON.stringify({ [questionIds[0]]: "a" })])).rejects.toThrow("Respostas incompletas");
  });

  it("corrige no banco e concede XP uma única vez", async () => {
    const answers = JSON.stringify(Object.fromEntries(questionIds.map(id => [id, "a"])));
    const first = await db.query<{ academy_submit_periodic_quiz: { passed: boolean; xpGranted: number; results: unknown[] } }>(
      "select academy_submit_periodic_quiz($1,$2,$3::jsonb)", [learner, quizId, answers]);
    expect(first.rows[0].academy_submit_periodic_quiz).toMatchObject({ passed: true, xpGranted: 60 });
    expect(first.rows[0].academy_submit_periodic_quiz.results).toHaveLength(2);
    const duplicate = await db.query<{ academy_submit_periodic_quiz: { alreadySubmitted: boolean } }>(
      "select academy_submit_periodic_quiz($1,$2,$3::jsonb)", [learner, quizId, answers]);
    expect(duplicate.rows[0].academy_submit_periodic_quiz.alreadySubmitted).toBe(true);
    const rewards = await db.query<{ count: number; total: number }>(
      "select count(*)::integer as count, sum(amount)::integer as total from academy_xp where user_id=$1 and event_key=$2",
      [learner, `quiz:${quizId}`]);
    expect(rewards.rows[0]).toMatchObject({ count: 1, total: 60 });
  });

  it("não concede XP na reprovação e impede repetir para trocar respostas", async () => {
    const wrong = JSON.stringify(Object.fromEntries(questionIds.map(id => [id, "b"])));
    const first = await db.query<{ academy_submit_periodic_quiz: { passed: boolean; xpGranted: number } }>(
      "select academy_submit_periodic_quiz($1,$2,$3::jsonb)", [secondLearner, quizId, wrong]);
    expect(first.rows[0].academy_submit_periodic_quiz).toMatchObject({ passed: false, xpGranted: 0 });
    const correct = JSON.stringify(Object.fromEntries(questionIds.map(id => [id, "a"])));
    const retry = await db.query<{ academy_submit_periodic_quiz: { alreadySubmitted: boolean } }>(
      "select academy_submit_periodic_quiz($1,$2,$3::jsonb)", [secondLearner, quizId, correct]);
    expect(retry.rows[0].academy_submit_periodic_quiz.alreadySubmitted).toBe(true);
    const rewards = await db.query<{ count: number }>("select count(*)::integer as count from academy_xp where user_id=$1", [secondLearner]);
    expect(rewards.rows[0].count).toBe(0);
  });
});
