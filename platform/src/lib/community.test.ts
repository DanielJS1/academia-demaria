import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { communityValidationError } from "./community";
import { executeCommand, type Profile } from "./pilot-server";
import type { Article } from "./model";

const admin = "11111111-1111-4111-8111-111111111111";
const author = "22222222-2222-4222-8222-222222222222";
const manager = "33333333-3333-4333-8333-333333333333";
const client = "44444444-4444-4444-8444-444444444444";
const inactive = "55555555-5555-4555-8555-555555555555";
const readers = Array.from({ length: 25 }, (_, i) => `66666666-6666-4666-8666-${String(i).padStart(12, "0")}`);
const content = "Para orientar o suporte, confira os dados de entrada, revise cada campo e confirme o resultado antes de finalizar o procedimento.";
const article = (id: string): Article => ({ id, title: "Procedimento de suporte", product: "Geral", category: "Passo a passo", content, author: "Nome adulterado", revision: 1, updatedAt: "2020-01-01", status: "draft", blocks: [{ id: "p", type: "paragraph", text: content }] });
let db: PGlite;
const command = (actor: string, input: unknown) => db.query("select academy_community_mutate($1::uuid,$2::jsonb)", [actor, JSON.stringify(input)]);
const save = (actor: string, id: string, expectedVersion = 0, publish = true) => command(actor, { type: "community-save", data: article(id), expectedVersion, publish });
const react = (actor: string, articleId: string, reaction = "like", active = true) => command(actor, { type: "community-react", articleId, reaction, active });
const read = async (actor: string, id: string | null = null, edit = false) => (await db.query<{ result: { articles: Article[]; articleDrafts: Article[]; article: Article; comments: unknown[] } }>("select academy_community_read($1::uuid,$2,$3) result", [actor, id, edit])).rows[0].result;
const xp = async (id: string) => Number((await db.query<{ amount: number }>("select coalesce(sum(amount),0)::integer amount from academy_xp where course_id=$1", [id])).rows[0].amount);

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role;");
  for (const file of ["202609150001_pilot.sql", "202609160001_learning_rewards.sql"])
    await db.exec(readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), "utf8"));
  await db.exec("alter table academy_profiles add column audience text not null default 'internal';");
  await db.exec(readFileSync(new URL("../../supabase/migrations/202609210001_community.sql", import.meta.url), "utf8"));
  for (const id of [admin, author, manager, client, inactive, ...readers]) {
    await db.query("insert into auth.users values($1);", [id]);
    await db.query("insert into academy_profiles(id,name,email,role,audience,status) values($1,$2,$3,$4,$5,$6)", [id, id === author ? "Autor real" : "Pessoa", `${id}@demaria.com.br`, id === admin ? "admin" : id === manager ? "manager" : "student", id === client ? "client" : "internal", id === inactive ? "inactive" : "active"]);
  }
}, 30000);
afterAll(async () => { await db?.close(); });

describe("comunidade: autorização, versões e corpo sob demanda", () => {
  it("recusa clientes/inativos na API e no banco", async () => {
    for (const actor of [client, inactive]) {
      await expect(save(actor, `blocked-${actor}`)).rejects.toThrow("colaboradores aprovados");
      await expect(read(actor)).rejects.toThrow("colaboradores aprovados");
    }
    await expect(executeCommand({} as Parameters<typeof executeCommand>[0], { id: client, role: "student", audience: "client", status: "active" } as Profile, { type: "community-react", articleId: "x", reaction: "like", active: true })).rejects.toMatchObject({ status: 403 });
  });
  it("nega acesso direto às tabelas e RPC ao navegador", async () => {
    await db.exec("set role authenticated");
    await expect(db.query("select * from academy_community_rewards")).rejects.toThrow();
    await expect(read(author)).rejects.toThrow();
    await db.exec("reset role");
  });
  it("isola rascunhos, preserva autoria e não transmite corpo nas listas", async () => {
    await save(author, "draft", 0, false);
    expect((await read(readers[0])).articleDrafts).toHaveLength(0);
    const own = (await read(author)).articleDrafts[0];
    expect(own.author).toBe("Autor real");
    expect(own.authorId).toBe(author);
    expect(own.content).toBe("");
    expect(own.blocks).toBeUndefined();
    expect(own.revision).toBe(1);
    expect((await read(author, "draft", true)).article.blocks?.[0].text).toBe(content);
    await expect(read(readers[0], "draft")).rejects.toThrow("não encontrado");
    await expect(read(manager, "draft", true)).rejects.toThrow("Somente o autor");
    await expect(save(readers[0], "draft", 1)).rejects.toThrow("Somente o autor");
    await expect(save(author, "draft", 0)).rejects.toThrow("outra sessão");
    await save(author, "draft", 1);
    expect((await read(readers[0])).articles[0].blocks).toBeUndefined();
    expect((await read(readers[0], "draft")).article.content).toBe(content);
  });
  it("gestor solicita atualização, rascunho preserva pedido e publicação resolve", async () => {
    await command(manager, { type: "community-request-update", articleId: "draft", message: "Atualize as capturas de tela." });
    expect((await read(author, "draft")).article.updateRequest?.message).toContain("capturas");
    await save(author, "draft", 2, false);
    expect((await read(author, "draft", true)).article.updateRequest).toBeTruthy();
    await save(author, "draft", 3);
    expect((await read(author, "draft")).article.updateRequest).toBeNull();
    expect(await xp("draft")).toBe(10);
  });
});

describe("comunidade: limites atômicos e idempotência de XP", () => {
  it("republicações/reações concorrentes, toggles e vários comentários não repetem recompensa", async () => {
    await save(author, "one");
    await Promise.all(Array.from({ length: 6 }, () => react(readers[0], "one")));
    await react(readers[0], "one", "like", false);
    await react(readers[0], "one");
    const commentId = randomUUID();
    await Promise.all(Array.from({ length: 3 }, () => command(readers[0], { type: "community-comment", articleId: "one", commentId, content: "Bom procedimento" })));
    await command(readers[0], { type: "community-comment", articleId: "one", commentId: randomUUID(), content: "Outro comentário" });
    await react(author, "one");
    await command(author, { type: "community-comment", articleId: "one", commentId: randomUUID(), content: "Obrigado" });
    expect(await xp("one")).toBe(12);
    expect((await read(author, "one")).comments).toHaveLength(3);
    const results = await Promise.allSettled([save(author, "one", 1), save(author, "one", 1)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await xp("one")).toBe(12);
  });
  it("limita a 20 XP por artigo e 40 XP totais por autor/semana com múltiplos participantes", async () => {
    await save(author, "third");
    expect(await xp("third")).toBe(0); // The two rewarded publications are draft and one.
    await Promise.all(readers.map(reader => react(reader, "one")));
    expect(await xp("one")).toBe(30);
    await Promise.all(readers.map(reader => react(reader, "third")));
    expect(await xp("third")).toBe(0);
    const total = (await db.query<{ amount: number }>("select sum(amount)::integer amount from academy_community_rewards where author_id=$1", [author])).rows[0].amount;
    expect(total).toBe(40);
  });
  it("hype concede 2 XP e no máximo 3 artigos por usuário por semana, mesmo após retirar a reação", async () => {
    for (let i = 0; i < 4; i++) await save(readers[24], `hype-${i}`);
    for (let i = 0; i < 3; i++) await react(readers[23], `hype-${i}`, "hype");
    expect(await xp("hype-0")).toBe(12);
    await react(readers[23], "hype-0", "hype", false);
    await expect(react(readers[23], "hype-3", "hype")).rejects.toThrow("3 hypes");
    await react(readers[23], "hype-0", "hype");
    expect(await xp("hype-0")).toBe(12);
  });
  it("exclusão de gestor revoga XP sem restaurar cotas nem permitir recriar o identificador", async () => {
    await expect(command(author, { type: "community-delete", articleId: "one" })).rejects.toThrow("gestores");
    await command(manager, { type: "community-delete", articleId: "one" });
    expect(await xp("one")).toBe(0);
    await expect(read(author, "one")).rejects.toThrow("não encontrado");
    await expect(save(author, "one")).rejects.toThrow("não encontrado");
    await save(author, "after-delete");
    await react(readers[0], "after-delete");
    expect(await xp("after-delete")).toBe(0);
    expect((await db.query("select * from academy_community_rewards where article_id='one' and revoked_at is not null")).rows.length).toBeGreaterThan(0);
  });
  it("calcula cotas em semanas ISO de São Paulo", async () => {
    const result = await db.query<{ sunday: string; monday: string }>("select date_trunc('week',timestamptz '2026-09-21 02:59:59+00' at time zone 'America/Sao_Paulo')::date::text sunday,date_trunc('week',timestamptz '2026-09-21 03:00:00+00' at time zone 'America/Sao_Paulo')::date::text monday");
    expect(result.rows[0]).toEqual({ sunday: "2026-09-14", monday: "2026-09-21" });
  });
});

describe("comunidade: validação de conteúdo", () => {
  it("rejeita SVG, imagens externas, sem texto alternativo e conteúdo insuficiente", () => {
    for (const src of ["data:image/svg+xml;base64,PHN2Zz4=", "https://example.com/image.png", "data:image/png;base64," + "A".repeat(360000)]) {
      expect(communityValidationError({ ...article("x"), blocks: [{ id: "image", type: "image", src, alt: "Teste" }] }, true)).toBeTruthy();
    }
    expect(communityValidationError({ ...article("x"), blocks: [{ id: "image", type: "image", src: "data:image/png;base64,AAAA" }] }, true)).toContain("Descreva");
    expect(communityValidationError({ ...article("x"), content: "Curto", blocks: undefined }, true)).toContain("80 caracteres");
    expect(communityValidationError(article("x"), true)).toBeNull();
  });
  it("ignora autoria/XP do cliente e deriva texto dos blocos na API", async () => {
    const calls: { command: { data: Article } }[] = [];
    const mock = { rpc: async (_: string, args: { command: { data: Article } }) => { calls.push(args); return { error: null }; } } as unknown as Parameters<typeof executeCommand>[0];
    await executeCommand(mock, { id: author, role: "student", status: "active" } as Profile, { type: "community-save", data: { ...article("api"), content: "Texto desatualizado", xp: 99999 }, publish: true, expectedVersion: 0 });
    expect(calls[0].command.data.content).toBe(content);
    expect(calls[0].command.data).not.toHaveProperty("xp");
  });
});
