import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { periodicQuizDetailSchema, periodicQuizListSchema, periodicQuizResultSchema, requiredCorrect } from "./periodic-quizzes";

const admin = "11111111-1111-4111-8111-111111111111";
const learner = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const client = "44444444-4444-4444-8444-444444444444";
const inactive = "55555555-5555-4555-8555-555555555555";
let db: PGlite;
let legacy: string;
let broken: string;
let sequence = 0;
function draft(cutoff = 70, reward = 70) {
  return { title: "Desafio histórico", slug: `historico-${++sequence}`, description: "Descrição", category: "sistema",
    xpReward: reward, passingScore: cutoff, periodType: "weekly", targetAudience: "internal", isActive: true, isFeatured: false,
    availableFrom: "2020-01-01T00:00:00Z", expiresAt: null as string | null,
    questions: Array.from({ length: 5 }, (_, i) => ({ id: crypto.randomUUID(), prompt: `Pergunta ${i + 1}`, options: [{ id: "a", text: "Correta" }, { id: "b", text: "Incorreta" }], correctOptionId: "a", explanation: "Explicação correta", imageUrl: "", imageAlt: "" })) };
}
async function save(payload: ReturnType<typeof draft> & { id?: string; expectedRevision?: number }, actor = admin) {
  return (await db.query<{ id: string }>("select academy_save_periodic_quiz($1,$2::jsonb) as id", [actor, JSON.stringify(payload)])).rows[0].id;
}
async function edit(id: string) {
  const snapshot = (await db.query<{ s: Record<string, unknown> }>("select academy_periodic_quiz_snapshot($1) as s", [id])).rows[0].s;
  const q = (await db.query<{ slug: string; revision: number }>("select slug,revision from academy_quizzes where id=$1", [id])).rows[0];
  return { ...draft(snapshot.passing_score as number, snapshot.xp_reward as number), id, expectedRevision: q.revision, slug: q.slug,
    title: snapshot.title as string, questions: (snapshot.questions as Record<string, unknown>[]).map(item => ({
      id: item.id as string, prompt: item.prompt as string, options: item.options as { id: string; text: string }[],
      correctOptionId: item.correct_option_id as string, explanation: item.explanation as string,
      imageUrl: (item.image_url as string) ?? "", imageAlt: (item.image_alt as string) ?? "" })) };
}
async function answers(id: string, correct: number) {
  const rows = (await db.query<{ id: string }>("select id from academy_quiz_questions where quiz_id=$1 order by order_index", [id])).rows;
  return Object.fromEntries(rows.map((q, i) => [q.id, i < correct ? "a" : "b"]));
}
async function submit(id: string, correct: number, actor = learner, revision = 1) {
  const response = await db.query<{ r: unknown }>("select academy_submit_periodic_quiz($1,$2,$3::jsonb,$4) as r", [actor, id, JSON.stringify(await answers(id, correct)), revision]);
  return periodicQuizResultSchema.parse(response.rows[0].r);
}
async function detail(id: string, actor = learner) {
  return periodicQuizDetailSchema.parse((await db.query<{ d: unknown }>("select academy_read_periodic_quiz($1,$2) as d", [actor, id])).rows[0].d);
}
async function listing(actor = learner) {
  return periodicQuizListSchema.parse((await db.query<{ l: unknown }>("select academy_list_periodic_quizzes($1) as l", [actor])).rows[0].l);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth; create table auth.users(id uuid primary key);
    create role anon; create role authenticated; create role service_role;
    create table academy_profiles(id uuid primary key references auth.users(id),status text,audience text,role text default 'student');
    create table academy_preferences(user_id uuid primary key references academy_profiles(id),bookmarks jsonb not null default '[]',read_notices jsonb not null default '[]');
    create table academy_xp(id uuid primary key default gen_random_uuid(),user_id uuid,course_id text,event_key text,amount integer,season text,label text);`);
  for (const name of ["202609240009_periodic_quizzes", "202609240010_quiz_question_media", "202609250001_periodic_quiz_admin", "202609250002_periodic_quiz_delete", "20261006181438_fix_periodic_quiz_save"])
    await db.exec(readFileSync(new URL(`../../supabase/migrations/${name}.sql`, import.meta.url), "utf8"));
  for (const id of [admin, learner, other, client, inactive]) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into academy_profiles values($1,$2,$3,$4)", [id, id === inactive ? "inactive" : "active", id === client ? "client" : "internal", id === admin ? "admin" : "student"]);
  }
  legacy = await save(draft()); broken = await save(draft());
  for (const [actor, count] of [[learner, 5], [other, 3]] as const)
    await db.query("select academy_submit_periodic_quiz($1,$2,$3::jsonb)", [actor, legacy, JSON.stringify(await answers(legacy, count))]);
  await db.query("insert into academy_quiz_attempts(user_id,quiz_id,score_percentage,answers,passed,xp_granted) values($1,$2,42,'{}',false,0)", [learner, broken]);
  await db.exec(readFileSync(new URL("../../supabase/migrations/20261006182007_periodic_quiz_history_rewards.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../supabase/migrations/20261006193250_periodic_quiz_notifications.sql", import.meta.url), "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });

describe("histórico e XP dos desafios", () => {
  it("reconstrói somente histórico compatível, preservando reprovação e XP sem retroatividade", async () => {
    const passed = (await detail(legacy)).result!;
    const failed = (await detail(legacy, other)).result!;
    expect(passed).toMatchObject({ scoringVersion: 1, passed: true, xpGranted: 70, newlyGrantedXp: 0, correctCount: 5, reviewAvailable: true });
    expect(failed).toMatchObject({ scoringVersion: 1, passed: false, xpGranted: 0, correctCount: 3 });
    const unavailable = await detail(broken);
    expect(unavailable.quiz).toBeNull();
    expect(unavailable.result).toMatchObject({ scorePercentage: 42, xpGranted: 0, reviewAvailable: false, correctCount: null, questionCount: null, results: [] });
    expect((await db.query<{ n: number }>("select count(*)::int as n from academy_xp")).rows[0].n).toBe(1);
  });
  for (const cutoff of [60, 70]) for (let count = 0; count <= 5; count++) {
    it(`${count}/5 com corte ${cutoff} concede exatamente o XP esperado`, async () => {
      const id = await save(draft(cutoff));
      const expected = (cutoff === 60 ? [0, 2, 4, 70, 70, 70] : [0, 2, 4, 6, 70, 70])[count];
      const r = await submit(id, count);
      expect(r).toMatchObject({ correctCount: count, questionCount: 5, scorePercentage: count * 20,
        passed: count >= requiredCorrect(5, cutoff), xpGranted: expected, newlyGrantedXp: expected, scoringVersion: 2, replayed: false });
      const ledger = (await db.query<{ n: number; xp: number }>("select count(*)::int as n,coalesce(sum(amount),0)::int as xp from academy_xp where event_key=$1", [`quiz:${id}`])).rows[0];
      expect(ledger).toEqual({ n: expected > 0 ? 1 : 0, xp: expected });
    });
  }
  it("respeita corte 0/100, prêmio zero e teto do simbólico", async () => {
    expect(await submit(await save(draft(0)), 0)).toMatchObject({ passed: true, xpGranted: 70 });
    expect(await submit(await save(draft(100)), 4)).toMatchObject({ passed: false, xpGranted: 8 });
    expect(await submit(await save(draft(100)), 5)).toMatchObject({ passed: true, xpGranted: 70 });
    expect(await submit(await save(draft(70, 0)), 5)).toMatchObject({ passed: true, xpGranted: 0 });
    expect(await submit(await save(draft(70, 3)), 3)).toMatchObject({ passed: false, xpGranted: 3 });
    expect(await submit(await save(draft(70, 0)), 3)).toMatchObject({ passed: false, xpGranted: 0 });
  });
  it("reenvio igual ou diferente recupera a tentativa sem trocar respostas ou duplicar XP", async () => {
    const id = await save(draft()); const first = await submit(id, 3);
    expect(await submit(id, 3)).toEqual({ ...first, newlyGrantedXp: 0, replayed: true });
    expect(await submit(id, 5, learner, 999)).toEqual({ ...first, newlyGrantedXp: 0, replayed: true });
    expect((await detail(id)).result).toEqual({ ...first, newlyGrantedXp: 0, replayed: true });
    expect((await db.query<{ n: number }>("select count(*)::int as n from academy_quiz_attempts where quiz_id=$1", [id])).rows[0].n).toBe(1);
    expect((await db.query<{ n: number }>("select count(*)::int as n from academy_xp where event_key=$1", [`quiz:${id}`])).rows[0].n).toBe(1);
  });
  it("corte e prêmio prospectivos mantêm snapshot e IDs anteriores", async () => {
    const id = await save(draft()); const first = await submit(id, 3);
    const payload = await edit(id); const ids = payload.questions.map(q => q.id);
    await save({ ...payload, passingScore: 60, xpReward: 50, title: "Novo título" });
    expect((await edit(id)).questions.map(q => q.id)).toEqual(ids);
    expect(await submit(id, 5)).toEqual({ ...first, newlyGrantedXp: 0, replayed: true });
    expect((await detail(id)).quiz).toMatchObject({ title: "Desafio histórico", passing_score: 70, xp_reward: 70, revision: 1 });
    expect(await submit(id, 3, other, 2)).toMatchObject({ passingScore: 60, xpReward: 50, passed: true, xpGranted: 50, revision: 2 });
  });
  it("bloqueia perguntas, gabarito e público após resposta, revertendo alterações", async () => {
    const id = await save(draft()); await submit(id, 3); const payload = await edit(id);
    for (const patch of [{ targetAudience: "client" }, { questions: payload.questions.slice().reverse() },
      { questions: payload.questions.map(q => ({ ...q, correctOptionId: "b" })) }])
      await expect(save({ ...payload, title: "Não salvar", ...patch })).rejects.toThrow("bloqueados");
    expect(await edit(id)).toEqual(payload);
  });
  it("reordena perguntas sem tentativas preservando seus IDs", async () => {
    const id = await save(draft()); const payload = await edit(id);
    await save({ ...payload, questions: payload.questions.slice().reverse() });
    expect((await edit(id)).questions.map(q => q.id)).toEqual(payload.questions.map(q => q.id).reverse());
  });
  it("nova edição tem identidade própria e não copia tentativas ou XP", async () => {
    const id = await save(draft()); await submit(id, 4);
    const old = await edit(id);
    const copy = { ...old, id: undefined, expectedRevision: undefined, slug: `edicao-${++sequence}`, isActive: false, isFeatured: false,
      questions: old.questions.map(q => ({ ...q, id: crypto.randomUUID() })) };
    const next = await save(copy);
    expect(next).not.toBe(id);
    expect((await edit(next)).questions.map(q => q.id)).not.toEqual(old.questions.map(q => q.id));
    expect((await db.query<{ n: number }>("select count(*)::int as n from academy_quiz_attempts where quiz_id=$1", [next])).rows[0].n).toBe(0);
    expect((await db.query<{ n: number }>("select count(*)::int as n from academy_xp where event_key=$1", [`quiz:${next}`])).rows[0].n).toBe(0);
  });
  it("falha de concessão de XP reverte também a tentativa", async () => {
    const id = await save(draft());
    await db.query("insert into academy_xp(user_id,event_key,amount,season,label) values($1,$2,70,'2026','pré-existente')", [learner, `quiz:${id}`]);
    await expect(submit(id, 5)).rejects.toThrow("unique");
    expect((await db.query<{ n: number }>("select count(*)::int as n from academy_quiz_attempts where quiz_id=$1", [id])).rows[0].n).toBe(0);
    expect((await detail(id)).result).toBeNull();
  });
  it("conflito de revisão protege save, submit, ativação e exclusão", async () => {
    const id = await save(draft()); const old = await edit(id); await save({ ...old, passingScore: 60 });
    await expect(save(old)).rejects.toThrow("Configuração alterada");
    await expect(submit(id, 5)).rejects.toThrow("Configuração alterada");
    for (const sql of ["select academy_set_periodic_quiz_active($1,$2,false,1)", "select academy_delete_periodic_quiz($1,$2,1)"])
      await expect(db.query(sql, [admin, id])).rejects.toThrow("Configuração alterada");
    await expect(db.query("select academy_submit_periodic_quiz($1,$2,$3::jsonb)", [learner, id, JSON.stringify(await answers(id, 5))])).rejects.toThrow("Configuração alterada");
    expect((await db.query<{ n: number }>("select count(*)::int as n from academy_quiz_attempts where quiz_id=$1", [id])).rows[0].n).toBe(0);
  });
  it("preserva revisão e resultado após pausa, expiração e exclusão lógica", async () => {
    const id = await save(draft()); const first = await submit(id, 4);
    await db.query("select academy_set_periodic_quiz_active($1,$2,false,1)", [admin, id]);
    await save({ ...await edit(id), expiresAt: "2021-01-01T00:00:00Z" });
    await db.query("select academy_delete_periodic_quiz($1,$2,3)", [admin, id]);
    expect((await detail(id)).result).toEqual({ ...first, newlyGrantedXp: 0, replayed: true });
    expect(await submit(id, 0, learner, 1)).toEqual({ ...first, newlyGrantedXp: 0, replayed: true });
    await expect(detail(id, other)).rejects.toThrow("indisponível");
    const list = await listing(); expect(list.completed.some(q => q.id === id)).toBe(true);
    expect(list.available.some(q => q.id === id)).toBe(false);
  });
  it("resumo não carrega perguntas nem gabarito e detalhe só revela a tentativa do dono", async () => {
    const id = await save(draft());
    const before = await detail(id); expect(before.result).toBeNull();
    expect(JSON.stringify(before)).not.toMatch(/correct_option_id|explanation/);
    const available = (await listing()).available.find(q => q.id === id)!;
    expect(available).toMatchObject({ questionCount: 5, requiredCorrect: 4 }); expect(available).not.toHaveProperty("questions");
    await submit(id, 4);
    expect((await detail(id, other)).result).toBeNull();
    expect(JSON.stringify(await detail(id, other))).not.toMatch(/correct_option_id|explanation|selectedOptionId/);
    expect((await listing(other)).completed.some(q => q.id === id)).toBe(false);
  });
  it("nega público errado, perfil inativo, edição por aluno e respostas inválidas", async () => {
    const id = await save(draft());
    await expect(detail(id, client)).rejects.toThrow("indisponível");
    await expect(submit(id, 5, client)).rejects.toThrow("indisponível");
    await expect(detail(id, inactive)).rejects.toThrow("não autorizado");
    await expect(listing(inactive)).rejects.toThrow("não autorizado");
    await expect(save(draft(), learner)).rejects.toThrow("não autorizado");
    await expect(db.query("select academy_submit_periodic_quiz($1,$2,'{}',1)", [learner, id])).rejects.toThrow("inválidas");
  });
  it("mantém RPCs privadas, SECURITY INVOKER, unicidade de tentativas e XP", async () => {
    const functions = (await db.query<{ name: string; security_definer: boolean; public_access: boolean; granted: boolean }>(`select p.proname as name,p.prosecdef as security_definer,
      has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE') as public_access,
      has_function_privilege('service_role',p.oid,'EXECUTE') as granted from pg_proc p where p.proname like 'academy_%periodic_quiz%'`)).rows;
    expect(functions.length).toBeGreaterThanOrEqual(9);
    for (const fn of functions) expect(fn).toMatchObject({ security_definer: false, public_access: false, granted: true });
    const id = await save(draft()); await submit(id, 5);
    await expect(db.query("insert into academy_xp(user_id,event_key,amount,season,label) values($1,$2,70,'2026','duplicado')", [learner, `quiz:${id}`])).rejects.toThrow("unique");
    await expect(db.query("insert into academy_quiz_attempts(user_id,quiz_id,score_percentage,answers,passed,xp_granted) values($1,$2,100,'{}',true,70)", [learner, id])).rejects.toThrow("unique");
  });
});
