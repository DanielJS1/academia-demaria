import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { commandSchema } from "./pilot-contract";
import { mergeQuizNotices, quizNoticesSchema } from "./quiz-notifications";

const admin = "11111111-1111-4111-8111-111111111111", a = "22222222-2222-4222-8222-222222222222";
const b = "33333333-3333-4333-8333-333333333333", client = "44444444-4444-4444-8444-444444444444", inactive = "55555555-5555-4555-8555-555555555555";
let db: PGlite, sequence = 0, legacyDeleted: string;
const sql = (name: string) => readFileSync(new URL(`../../supabase/migrations/${name}.sql`, import.meta.url), "utf8");
function draft(active = true, date = "2020-01-01T00:00:00Z", audience = "internal") {
  return { title: "Desafio novo", slug: `aviso-${++sequence}`, category: "sistema", description: "", xpReward: 70, passingScore: 70,
    periodType: "weekly", targetAudience: audience, isActive: active, isFeatured: false, availableFrom: date, expiresAt: null,
    questions: [1, 2].map(i => ({ id: crypto.randomUUID(), prompt: `Pergunta ${i}`, options: [{ id: "a", text: "Sim" }, { id: "b", text: "Não" }], correctOptionId: "a", explanation: "Explicação", imageUrl: "", imageAlt: "" })) };
}
async function save(payload: ReturnType<typeof draft> & { id?: string; expectedRevision?: number }) {
  return (await db.query<{ id: string }>("select academy_save_periodic_quiz($1,$2::jsonb) as id", [admin, JSON.stringify(payload)])).rows[0].id;
}
async function pref(actor = a, enabled = true) { await db.query("select academy_set_quiz_notifications($1,$2)", [actor, enabled]); }
// Arrange a subscription strictly before publication; PGlite can stamp sequential calls
// in the same millisecond, which correctly fails the production rule announcement > since.
async function subscribeBeforePublication(actor: string) {
  await pref(actor);
  await db.query("update academy_preferences set quiz_notifications_since=clock_timestamp()-interval '1 second' where user_id=$1", [actor]);
}
async function read(actor = a) { return quizNoticesSchema.parse((await db.query<{ n: unknown }>("select academy_read_quiz_notifications($1) as n", [actor])).rows[0].n); }
async function row(id: string) { return (await db.query<{ announcement_at: string | null; revision: number }>("select announcement_at::text,revision from academy_quizzes where id=$1", [id])).rows[0]; }
async function active(id: string, enabled: boolean) { await db.query("select academy_set_periodic_quiz_active($1,$2,$3,$4)", [admin, id, enabled, (await row(id)).revision]); }
async function legacyPreferences(bookmarks: string[], readNotices: string[]) {
  await db.query("select academy_mutate($1,$2::jsonb)", [a, JSON.stringify({ type: "preferences", bookmarks, readNotices })]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role;
    create table academy_profiles(id uuid primary key references auth.users(id),status text,audience text,role text);
    create table academy_xp(id uuid primary key default gen_random_uuid(),user_id uuid,course_id text,event_key text,amount integer,season text,label text);
    create table academy_preferences(user_id uuid primary key references academy_profiles(id),bookmarks jsonb not null default '[]',read_notices jsonb not null default '[]');
    create table academy_resources(id text primary key); create table academy_attempts(id uuid primary key);
    create table academy_audit(actor uuid,action text,resource text);`);
  for (const name of ["202609240009_periodic_quizzes", "202609240010_quiz_question_media", "202609250001_periodic_quiz_admin", "202609250002_periodic_quiz_delete", "20261006181438_fix_periodic_quiz_save", "20261006182007_periodic_quiz_history_rewards"])
    await db.exec(sql(name));
  // Load the actual existing preference writer, without rebuilding unrelated academy tables.
  await db.exec(sql("20260929130000_multiple_choice_quizzes").match(/create or replace function public\.academy_mutate[\s\S]*?\$\$;/)![0]);
  for (const id of [admin, a, b, client, inactive]) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into academy_profiles values($1,$2,$3,$4)", [id, id === inactive ? "inactive" : "active", id === client ? "client" : "internal", id === admin ? "admin" : "student"]);
  }
  await save(draft());
  legacyDeleted = await save(draft());
  await db.query("select academy_delete_periodic_quiz($1,$2,1)", [admin, legacyDeleted]);
  await db.exec(sql("20261006193250_periodic_quiz_notifications"));
}, 30000);
afterAll(async () => { await db?.close(); });

describe("preferência e publicação de desafios", () => {
  it("instala os avisos com desafios legados excluídos sem alterar sua exclusão", async () => {
    const deleted = (await db.query<{ deleted: boolean; announcement_at: string | null }>("select deleted_at is not null as deleted,announcement_at from academy_quizzes where id=$1", [legacyDeleted])).rows[0];
    expect(deleted).toEqual({ deleted: true, announcement_at: null });
    await expect(active(legacyDeleted, true)).rejects.toThrow();
  });
  it("começa desligada e não anuncia o backfill ao aderir", async () => {
    expect((await read()).quizNotifications).toEqual({ enabled: false, since: null });
    await pref(); expect((await read()).notifications).toEqual([]);
    expect((await read(b)).quizNotifications.enabled).toBe(false);
  });
  it("habilitar simultaneamente é idempotente; reativar reinicia adesão sem backlog", async () => {
    const first = (await read()).quizNotifications.since;
    await Promise.all([pref(), pref()]); expect((await read()).quizNotifications.since).toBe(first);
    await pref(a, false); const id = await save(draft()); await pref();
    expect((await read()).quizNotifications.since).not.toBe(first);
    expect((await read()).notifications.some(n => n.id === `quiz-published:${id}`)).toBe(false);
  });
  it("preserva bookmarks/lidos nos dois escritores existentes em ambas as ordens", async () => {
    await legacyPreferences(["curso-1"], ["welcome"]); const since = (await read()).quizNotifications.since;
    await pref(); expect((await read()).readNotices).toEqual(["welcome"]);
    expect((await db.query<{ bookmarks: string[] }>("select bookmarks from academy_preferences where user_id=$1", [a])).rows[0].bookmarks).toEqual(["curso-1"]);
    await Promise.all([pref(), legacyPreferences(["curso-2"], ["knowledge"])]);
    expect((await read()).quizNotifications).toEqual({ enabled: true, since });
    expect((await read()).readNotices).toEqual(["knowledge"]);
  });
  it("recusa perfil inativo e payload com ator/data arbitrários", async () => {
    await expect(pref(inactive)).rejects.toThrow("Perfil não autorizado"); await expect(read(inactive)).rejects.toThrow("Perfil não autorizado");
    expect(commandSchema.safeParse({ type: "quiz-notifications", enabled: true, actor: b, since: "2020-01-01" }).success).toBe(false);
  });
  it("isola usuários/públicos e não expõe perguntas; lido permanece no readNotices", async () => {
    await subscribeBeforePublication(client); const id = await save(draft()); const external = await save(draft(true, undefined, "client"));
    const notices = (await read()).notifications; expect(notices.some(n => n.id === `quiz-published:${id}`)).toBe(true);
    expect(notices.some(n => n.id === `quiz-published:${external}`)).toBe(false); expect((await read(b)).notifications).toEqual([]);
    expect((await read(client)).notifications.map(n => n.id)).toContain(`quiz-published:${external}`);
    expect(JSON.stringify(notices)).not.toMatch(/correct_option|questions|explanation/);
    await legacyPreferences(["curso-2"], [`quiz-published:${id}`]); expect((await read()).notifications.find(n => n.id === `quiz-published:${id}`)?.read).toBe(true);
  });
  it("anúncio agendado só aparece quando o relógio do banco atinge o horário", async () => {
    // A transaction pins now(), making the pre-publication check independent of CPU load.
    await db.exec("begin"); let id: string;
    try {
      const scheduled = (await db.query<{ t: string }>("select (now()+interval '500 milliseconds')::text as t")).rows[0].t;
      id = await save(draft(true, new Date(scheduled).toISOString()));
      expect((await row(id)).announcement_at).not.toBeNull(); expect((await read()).notifications.some(n => n.id === `quiz-published:${id}`)).toBe(false);
    } finally { await db.exec("commit"); }
    const remaining = (await db.query<{ ms: number }>("select greatest(0,extract(epoch from (announcement_at-clock_timestamp()))*1000)::float8 as ms from academy_quizzes where id=$1", [id!])).rows[0].ms;
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, Math.ceil(remaining) + 20));
    expect((await read()).notifications.some(n => n.id === `quiz-published:${id}`)).toBe(true);
  });
  it("reagenda antes da publicação e cancelar limpa o anúncio futuro", async () => {
    const payload = draft(true, "2099-01-01T00:00:00Z"); const id = await save(payload);
    await save({ ...payload, id, expectedRevision: 1, availableFrom: "2099-02-01T00:00:00Z" });
    expect(new Date((await row(id)).announcement_at!).toISOString()).toBe("2099-02-01T00:00:00.000Z"); await active(id, false);
    expect((await row(id)).announcement_at).toBeNull(); expect((await read()).notifications.some(n => n.id === `quiz-published:${id}`)).toBe(false);
  });
  it("publicação permanece ao editar, pausar e reativar; público fica bloqueado", async () => {
    const payload = draft(); const id = await save(payload); const original = (await row(id)).announcement_at;
    await save({ ...payload, id, expectedRevision: 1, title: "Título novo", passingScore: 60 });
    await active(id, false); expect((await read()).notifications.some(n => n.id === `quiz-published:${id}`)).toBe(false);
    await active(id, true); expect((await row(id)).announcement_at).toBe(original);
    await expect(save({ ...payload, id, expectedRevision: 4, targetAudience: "client" })).rejects.toThrow("Público publicado bloqueado");
    expect((await row(id)).revision).toBe(4);
    expect((await read()).notifications.filter(n => n.id === `quiz-published:${id}`)).toHaveLength(1);
    const next = await save(draft()); expect((await read()).notifications.some(n => n.id === `quiz-published:${next}`)).toBe(true);
  });
  it("conclusão, expiração e exclusão retiram o aviso; outro usuário continua elegível", async () => {
    await subscribeBeforePublication(b); const payload = draft(); const id = await save(payload);
    await db.query("select academy_submit_periodic_quiz($1,$2,$3::jsonb,1)", [a, id, JSON.stringify(Object.fromEntries(payload.questions.map(q => [q.id, "a"])))]);
    expect((await read()).notifications.some(n => n.id === `quiz-published:${id}`)).toBe(false);
    expect((await read(b)).notifications.some(n => n.id === `quiz-published:${id}`)).toBe(true);
    await db.query("update academy_quizzes set expires_at=now() where id=$1", [id]); expect((await read(b)).notifications.some(n => n.id === `quiz-published:${id}`)).toBe(false);
    const deleted = await save(draft()); await db.query("select academy_delete_periodic_quiz($1,$2,1)", [admin, deleted]);
    expect((await read()).notifications.some(n => n.id === `quiz-published:${deleted}`)).toBe(false);
  });
  it("não anuncia publicação com timestamp igual à adesão", async () => {
    const id = await save(draft());
    await db.query("update academy_preferences set quiz_notifications_since=(select announcement_at from academy_quizzes where id=$1) where user_id=$2", [id, b]);
    expect((await read(b)).notifications.some(n => n.id === `quiz-published:${id}`)).toBe(false);
    await db.query("update academy_preferences set quiz_notifications_since=quiz_notifications_since-interval '1 millisecond' where user_id=$1", [b]);
    expect((await read(b)).notifications.some(n => n.id === `quiz-published:${id}`)).toBe(true);
  });
  it("mantém RLS e RPCs inacessíveis por anon/authenticated", async () => {
    for (const role of ["anon", "authenticated"]) {
      expect((await db.query<{ allowed: boolean }>("select has_function_privilege($1,'academy_set_quiz_notifications(uuid,boolean)','execute') as allowed", [role])).rows[0].allowed).toBe(false);
      expect((await db.query<{ allowed: boolean }>("select has_table_privilege($1,'academy_preferences','update') as allowed", [role])).rows[0].allowed).toBe(false);
    }
    expect((await db.query<{ r: boolean }>("select relrowsecurity as r from pg_class where relname='academy_preferences'")).rows[0].r).toBe(true);
  });
  it("mescla avisos sem apagar sugestões, sem duplicar e removendo desafios não acionáveis", () => {
    const make = (id: string) => ({ id, userId: a, title: "Título", message: "Mensagem", link: "/", read: false, createdAt: "2026-01-01" });
    expect(mergeQuizNotices([make("suggestion:1"), make("quiz-published:old")], [make("quiz-published:new"), make("quiz-published:new")]).map(n => n.id)).toEqual(["suggestion:1", "quiz-published:new"]);
  });
});
