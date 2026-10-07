import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const learner = "22222222-2222-4222-8222-222222222222";
const secondLearner = "33333333-3333-4333-8333-333333333333";
const admin = "11111111-1111-4111-8111-111111111111";
let db: PGlite;
let quizId: string;
let questionIds: string[];

function adminDraft(slug: string) {
  return { title: "Desafio de regressão", slug, description: "Teste", category: "sistema",
    xpReward: 70, passingScore: 70, periodType: "weekly", targetAudience: "internal", isActive: true, isFeatured: false,
    availableFrom: new Date(Date.now() - 1000).toISOString(), expiresAt: null,
    questions: [0, 1].map(index => ({ prompt: `Pergunta ${index + 1}`, options: [{ id: "a", text: "Correta" }, { id: "b", text: "Incorreta" }],
      correctOptionId: "a", explanation: "Explicação de teste", imageUrl: "", imageAlt: "" })) };
}

async function saveDraft(payload: ReturnType<typeof adminDraft> & { id?: string }) {
  const saved = await db.query<{ id: string }>("select academy_save_periodic_quiz($1,$2::jsonb) as id", [admin, JSON.stringify(payload)]);
  return saved.rows[0].id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users(id uuid primary key);
    create role anon; create role authenticated; create role service_role;
    create table public.academy_profiles(id uuid primary key references auth.users(id), status text not null, audience text not null, role text not null default 'student');
    create table public.academy_xp(id uuid primary key default gen_random_uuid(), user_id uuid not null,
      course_id text, event_key text not null, amount integer not null, season text not null, label text not null);
  `);
  await db.exec(readFileSync(new URL("../../supabase/migrations/202609240009_periodic_quizzes.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../supabase/migrations/202609240010_quiz_question_media.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../supabase/migrations/202609250001_periodic_quiz_admin.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../supabase/migrations/202609250002_periodic_quiz_delete.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../supabase/migrations/20261006181438_fix_periodic_quiz_save.sql", import.meta.url), "utf8"));
  await db.query("insert into auth.users(id) values($1),($2),($3)", [learner, secondLearner, admin]);
  await db.query("insert into academy_profiles(id,status,audience) values($1,'active','internal'),($2,'active','internal')", [learner, secondLearner]);
  await db.query("insert into academy_profiles(id,status,audience,role) values($1,'active','internal','admin')", [admin]);
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

  it("salva perguntas e destaque apenas para administrador, de forma atômica", async () => {
    const payload = { title: "Desafio de teste", slug: "desafio-de-teste", description: "Teste", category: "sistema",
      xpReward: 70, passingScore: 70, periodType: "weekly", targetAudience: "internal", isActive: true, isFeatured: true,
      availableFrom: new Date(Date.now() - 1000).toISOString(), expiresAt: null,
      questions: [0, 1].map(index => ({ prompt: `Pergunta ${index + 1}`, options: [{ id: "a", text: "Correta" }, { id: "b", text: "Incorreta" }],
        correctOptionId: "a", explanation: "Explicação de teste", imageUrl: "", imageAlt: "" })) };
    await expect(db.query("select academy_save_periodic_quiz($1,$2::jsonb)", [learner, JSON.stringify(payload)])).rejects.toThrow("Apenas administradores");
    const saved = await db.query<{ academy_save_periodic_quiz: string }>("select academy_save_periodic_quiz($1,$2::jsonb)", [admin, JSON.stringify(payload)]);
    const id = saved.rows[0].academy_save_periodic_quiz;
    const rows = await db.query<{ count: number }>("select count(*)::integer as count from academy_quiz_questions where quiz_id=$1", [id]);
    expect(rows.rows[0].count).toBe(2);
    const featured = await db.query<{ count: number }>("select count(*)::integer as count from academy_quizzes where target_audience='internal' and is_featured");
    expect(featured.rows[0].count).toBe(1);
    await db.query("select academy_set_periodic_quiz_active($1,$2,false)", [admin, id]);
    const disabled = await db.query<{ is_active: boolean }>("select is_active from academy_quizzes where id=$1", [id]);
    expect(disabled.rows[0].is_active).toBe(false);
  });

  it("edita um existente sem respostas, incluindo corte, perguntas e destaque", async () => {
    const payload = adminDraft("regressao-update");
    const id = await saveDraft(payload);
    const edited = { ...payload, id, title: "Desafio atualizado", passingScore: 60, isFeatured: true,
      questions: [...payload.questions, { ...payload.questions[0], prompt: "Terceira pergunta atualizada" }] };
    expect(await saveDraft(edited)).toBe(id);
    const quiz = await db.query("select title,passing_score,is_featured from academy_quizzes where id=$1", [id]);
    expect(quiz.rows[0]).toMatchObject({ title: edited.title, passing_score: 60, is_featured: true });
    const questions = await db.query<{ prompt: string }>("select prompt from academy_quiz_questions where quiz_id=$1 order by order_index", [id]);
    expect(questions.rows.map(row => row.prompt)).toEqual(edited.questions.map(question => question.prompt));
    const featured = await db.query("select id from academy_quizzes where target_audience='internal' and is_featured");
    expect(featured.rows).toEqual([{ id }]);
    await saveDraft({ ...edited, isFeatured: false });
    const cleared = await db.query<{ is_featured: boolean }>("select is_featured from academy_quizzes where id=$1", [id]);
    expect(cleared.rows[0].is_featured).toBe(false);
  });

  it("identifica inexistente, dados inválidos, duplicidade e ator não autorizado", async () => {
    const payload = adminDraft("regressao-validacao");
    await saveDraft(payload);
    await expect(saveDraft({ ...payload, id: "99999999-9999-4999-8999-999999999999" }))
      .rejects.toMatchObject({ code: "P0001", detail: "QUIZ_NOT_FOUND" });
    await expect(saveDraft({ ...payload, passingScore: 101 })).rejects.toMatchObject({ code: "P0001", detail: "QUIZ_INVALID_DATA" });
    await expect(saveDraft(payload)).rejects.toMatchObject({ code: "23505" });
    await expect(db.query("select academy_save_periodic_quiz($1,$2::jsonb)", [learner, JSON.stringify(payload)]))
      .rejects.toMatchObject({ code: "P0001", detail: "QUIZ_FORBIDDEN" });
  });

  it("mantém bloqueado todo save de desafio já respondido, sem alterar nota ou XP", async () => {
    const before = await db.query("select passing_score from academy_quizzes where id=$1", [quizId]);
    await expect(saveDraft({ ...adminDraft("regressao-respondido"), id: quizId, passingScore: 60 }))
      .rejects.toMatchObject({ code: "P0001", detail: "QUIZ_ALREADY_ANSWERED" });
    const after = await db.query("select passing_score from academy_quizzes where id=$1", [quizId]);
    expect(after.rows).toEqual(before.rows);
    const attempts = await db.query("select passed,xp_granted from academy_quiz_attempts where quiz_id=$1 order by user_id", [quizId]);
    expect(attempts.rows).toEqual([{ passed: true, xp_granted: 60 }, { passed: false, xp_granted: 0 }]);
  });

  it("reverte metadados, perguntas e destaque se uma pergunta falhar durante update", async () => {
    const previousFeatured = await saveDraft({ ...adminDraft("regressao-destaque"), isFeatured: true });
    const payload = adminDraft("regressao-rollback");
    const id = await saveDraft(payload);
    const before = await db.query("select * from academy_quizzes where id=$1", [id]);
    const questions = await db.query("select * from academy_quiz_questions where quiz_id=$1 order by order_index", [id]);
    await expect(saveDraft({ ...payload, id, passingScore: 60, isFeatured: true,
      questions: [payload.questions[0], { ...payload.questions[1], correctOptionId: "inexistente" }] }))
      .rejects.toMatchObject({ code: "P0001", detail: "QUIZ_INVALID_QUESTIONS" });
    expect((await db.query("select * from academy_quizzes where id=$1", [id])).rows).toEqual(before.rows);
    expect((await db.query("select * from academy_quiz_questions where quiz_id=$1 order by order_index", [id])).rows).toEqual(questions.rows);
    expect((await db.query("select id from academy_quizzes where target_audience='internal' and is_featured")).rows).toEqual([{ id: previousFeatured }]);
  });

  it("preserva SECURITY INVOKER e execução exclusiva pelo servidor", async () => {
    const privileges = await db.query(`select
      has_function_privilege('anon','academy_save_periodic_quiz(uuid,jsonb)','EXECUTE') as anon,
      has_function_privilege('authenticated','academy_save_periodic_quiz(uuid,jsonb)','EXECUTE') as authenticated,
      has_function_privilege('service_role','academy_save_periodic_quiz(uuid,jsonb)','EXECUTE') as service,
      prosecdef from pg_proc where oid='academy_save_periodic_quiz(uuid,jsonb)'::regprocedure`);
    expect(privileges.rows[0]).toEqual({ anon: false, authenticated: false, service: true, prosecdef: false });
  });

  it("exclui rascunhos e desafios ativos sem apagar tentativas ou XP", async () => {
    const draft = await db.query<{ id: string }>("select id from academy_quizzes where slug='desafio-alagoas'");
    await expect(db.query("select academy_delete_periodic_quiz($1,$2)", [learner, draft.rows[0].id])).rejects.toThrow("Apenas administradores");
    await db.query("select academy_delete_periodic_quiz($1,$2)", [admin, draft.rows[0].id]);
    await db.query("select academy_delete_periodic_quiz($1,$2)", [admin, quizId]);
    const archived = await db.query<{ deleted_at: string; is_active: boolean; is_featured: boolean }>(
      "select deleted_at,is_active,is_featured from academy_quizzes where id=$1", [quizId]);
    expect(archived.rows[0]).toMatchObject({ is_active: false, is_featured: false });
    expect(archived.rows[0].deleted_at).toBeTruthy();
    const attempts = await db.query<{ count: number }>("select count(*)::integer as count from academy_quiz_attempts where quiz_id=$1", [quizId]);
    expect(attempts.rows[0].count).toBe(2);
    const xp = await db.query<{ count: number }>("select count(*)::integer as count from academy_xp where event_key=$1", [`quiz:${quizId}`]);
    expect(xp.rows[0].count).toBe(1);
    await expect(db.query("select academy_set_periodic_quiz_active($1,$2,true)", [admin, quizId])).rejects.toThrow("Desafio excluído");
    await expect(db.query("select academy_delete_periodic_quiz($1,$2)", [admin, quizId])).rejects.toThrow("Desafio não encontrado");
  });
});
