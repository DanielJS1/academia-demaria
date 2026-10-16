import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const admin = "11111111-1111-4111-8111-111111111111", student = "22222222-2222-4222-8222-222222222222", client = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
const base = { title: "Aula teste", host: "Equipe", description: "", youtubeUrl: "https://youtu.be/abcdefghijk", recordingUrl: "", scheduledAt: "2026-10-08T12:00:00Z", audience: "both", chatEnabled: true, status: "scheduled", version: 0 };
type Row = { id: string; version: number; document: typeof base };
const save = async (actor: string, payload: object) => (await db.query<{ value: Row }>("select public.academy_save_live_event($1::uuid,$2::jsonb) value", [actor, JSON.stringify(payload)])).rows[0].value;
const chat = async (actor: string, event: string, payload: object) => (await db.query<{ value: { id: string; content: string; removed: boolean; pinned: boolean; author_role: string; seq: number } }>("select public.academy_live_chat($1::uuid,$2::uuid,$3::jsonb) value", [actor, event, JSON.stringify(payload)])).rows[0].value;
const identity = async (id: string) => { await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec("set role authenticated"); };
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create table academy_cartorios(id uuid primary key,status text);
    create table academy_profiles(id uuid primary key,name text,role text,status text,audience text,cartorio_id uuid);
    insert into academy_cartorios values ('44444444-4444-4444-8444-444444444444','active');
    insert into academy_profiles values
      ('${admin}','Admin','admin','active','internal',null),
      ('${student}','Aluno','student','active','internal',null),
      ('${client}','Cliente','student','active','client','44444444-4444-4444-8444-444444444444');
    revoke all on academy_profiles,academy_cartorios from authenticated,anon;
    grant all on academy_profiles,academy_cartorios to service_role;
  `);
  await db.exec(readFileSync(new URL("../../supabase/migrations/20261008004241_live_classes_and_highlights.sql", import.meta.url), "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });
describe("Postgres: aulas e chat", () => {
  it("bloqueia administração por aluno e escrita direta do navegador", async () => {
    await expect(save(student, base)).rejects.toThrow("Apenas administradores");
    await identity(student);
    try {
      await expect(db.query("insert into academy_live_events(document) values($1)", [JSON.stringify(base)])).rejects.toThrow();
      await expect(db.query("select academy_save_live_event($1,$2)", [admin, JSON.stringify(base)])).rejects.toThrow();
      await expect(db.query("select academy_live_chat($1,$2,$3)", [admin, admin, "{}"])).rejects.toThrow();
    } finally { await db.exec("reset role"); }
  });
  it("verifica etapas e impede sobrescrita de uma edição concorrente", async () => {
    await expect(save(admin, { ...base, status: "live" })).rejects.toThrow("Etapa");
    const event = await save(admin, base);
    await expect(save(admin, { ...base, id: event.id, version: 0 })).rejects.toThrow("outra sessão");
    const live = await save(admin, { ...base, id: event.id, version: 1, status: "live" });
    expect(live.version).toBe(2);
    expect(live.document).toHaveProperty("startedAt");
    await expect(save(admin, { ...base, id: event.id, version: 2, status: "live", youtubeUrl: "https://youtu.be/12345678901" })).rejects.toThrow("trocar o vídeo");
  });
  it("restringe aulas e mensagens por público, rascunho e cartório ativo", async () => {
    const internal = await save(admin, { ...base, audience: "internal" });
    const external = await save(admin, { ...base, audience: "client" });
    const draft = await save(admin, { ...base, status: "draft" });
    await identity(client);
    try {
      const rows = (await db.query<{ id: string }>("select id from academy_live_events")).rows.map(row => row.id);
      expect(rows).toContain(external.id); expect(rows).not.toContain(internal.id); expect(rows).not.toContain(draft.id);
    } finally { await db.exec("reset role"); }
    await db.query("update academy_cartorios set status='inactive'");
    await identity(client);
    try { expect((await db.query("select * from academy_live_events")).rows).toHaveLength(0); }
    finally { await db.exec("reset role"); await db.query("update academy_cartorios set status='active'"); }
  });
  it("preserva o chat, controla ritmo, rejeita moderação por aluno e torna reenvios idempotentes", async () => {
    let event = await save(admin, base);
    const messageId = "55555555-5555-4555-8555-555555555555";
    await expect(chat(student, event.id, { action: "send", id: messageId, content: "Olá" })).rejects.toThrow("fechado");
    event = await save(admin, { ...base, id: event.id, version: 1, status: "live" });
    const message = await chat(student, event.id, { action: "send", id: messageId, content: "Pergunta importante", author_role: "admin" });
    expect(message.author_role).toBe("student");
    expect((await chat(student, event.id, { action: "send", id: messageId, content: "Outra" })).id).toBe(messageId);
    await expect(chat(student, event.id, { action: "send", id: "66666666-6666-4666-8666-666666666666", content: "Spam" })).rejects.toThrow("Aguarde");
    await expect(chat(student, event.id, { action: "remove", id: messageId })).rejects.toThrow("administradores");
    expect((await chat(admin, event.id, { action: "pin", id: messageId, pinned: true })).pinned).toBe(true);
    const removed = await chat(admin, event.id, { action: "remove", id: messageId });
    expect(removed.removed).toBe(true); expect(removed.content).toBe(""); expect(removed.pinned).toBe(false);
    event = await save(admin, { ...base, id: event.id, version: 2, status: "processing" });
    await save(admin, { ...base, id: event.id, version: 3, status: "recorded" });
    expect((await db.query("select * from academy_live_messages where event_id=$1", [event.id])).rows).toHaveLength(1);
  });
  it("protege a ordem da vitrine por versão e limita oito itens", async () => {
    const saveHighlights = (actor: string, value: unknown) => db.query("select academy_save_home_highlights($1,$2)", [actor, JSON.stringify(value)]);
    await expect(saveHighlights(student, { version: 0, items: [] })).rejects.toThrow("administradores");
    await saveHighlights(admin, { version: 0, items: [] });
    await expect(saveHighlights(admin, { version: 0, items: [] })).rejects.toThrow("outra sessão");
    await expect(saveHighlights(admin, { version: 1, items: Array(9).fill({}) })).rejects.toThrow();
  });
});
