import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { academyUrl, codeHash, discordConfigured, DiscordError, discordRequest, newLinkCode, noticeMessage, validDiscordSignature } from "./discord";
import { dispatchDiscord, interactionEnvelope } from "./discord-server";
import * as trailServer from "./trails-server";
import { alertPolicySchema } from "./trails";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("segurança do Discord", () => {
  it("aceita somente corpo original assinado e timestamp recente", () => {
    const pair = generateKeyPairSync("ed25519"), pub = pair.publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
    vi.stubEnv("DISCORD_PUBLIC_KEY", pub);
    const stamp = Math.floor(Date.now() / 1000).toString(), raw = '{"type":1}', signature = sign(null, Buffer.from(stamp + raw), pair.privateKey).toString("hex");
    const request = new Request("https://example.com", { headers: { "x-signature-timestamp": stamp, "x-signature-ed25519": signature } });
    expect(validDiscordSignature(request, raw)).toBe(true);
    expect(validDiscordSignature(request, raw + " ")).toBe(false);
    expect(validDiscordSignature(request, raw, Date.now() + 301000)).toBe(false);
    expect(validDiscordSignature(new Request("https://example.com"), raw)).toBe(false);
  });
  it("exige aplicativo, servidor e identidade pessoal corretos", () => {
    vi.stubEnv("DISCORD_APPLICATION_ID", "1558246474578665562"); vi.stubEnv("DISCORD_GUILD_ID", "867749095967686676");
    const input = { application_id: "1558246474578665562", guild_id: "867749095967686676", type: 2, member: { user: { id: "111111111111111111", username: "Pessoa" } } };
    expect(interactionEnvelope(input)).toEqual(input);
    expect(() => interactionEnvelope({ ...input, guild_id: "999999999999999999" })).toThrow("servidor");
    expect(() => interactionEnvelope({ ...input, application_id: "other" })).toThrow("inválida");
    expect(() => interactionEnvelope({ ...input, member: { user: { ...input.member.user, bot: true } } })).toThrow("inválida");
  });
  it("usa código imprevisível, hash e normalização sem armazenar segredo legível", () => {
    const a = newLinkCode(), b = newLinkCode(); expect(a).toMatch(/^[A-F0-9]{32}$/); expect(a).not.toBe(b);
    expect(codeHash(a)).toHaveLength(64); expect(codeHash(a)).toBe(codeHash(a.toLowerCase()));
  });
  it("links permanecem no domínio da Academia e mensagens não provocam menções", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://academia-demaria.vercel.app");
    expect(academyUrl("/aprender/trilhas")).toBe("https://academia-demaria.vercel.app/aprender/trilhas");
    expect(() => academyUrl("//evil.example")).toThrow(); expect(() => academyUrl("/\\evil.example")).toThrow();
    const message = noticeMessage({ id: "test", title: "Prazo", message: "@everyone", link: "/aprender/trilhas" });
    expect(message.allowed_mentions.parse).toEqual([]); expect(message.enforce_nonce).toBe(true);
  });
  it("classifica bloqueio e limites sem reenviar POST automaticamente", async () => {
    vi.stubEnv("DISCORD_BOT_TOKEN", "fake"); const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 50007 }), { status: 403 })); vi.stubGlobal("fetch", fetchMock);
    await expect(discordRequest("/test", "POST", {})).rejects.toMatchObject({ code: 50007, status: 403 }); expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new DiscordError(429, 0).message).toContain("Limite");
  });
  it("não considera pronta uma configuração incompleta", () => { vi.stubEnv("DISCORD_BOT_TOKEN", ""); expect(discordConfigured()).toBe(false); });
});
describe("fila de lembretes privados", () => {
  const learner = "00000000-0000-4000-8000-000000000001", manager = "00000000-0000-4000-8000-000000000002", now = new Date("2026-10-09T12:00:00Z");
  function fixture(linked = true) {
    vi.stubEnv("DISCORD_APPLICATION_ID", "1558246474578665562"); vi.stubEnv("DISCORD_GUILD_ID", "867749095967686676"); vi.stubEnv("DISCORD_PUBLIC_KEY", "a".repeat(64)); vi.stubEnv("DISCORD_BOT_TOKEN", "fake"); vi.stubEnv("CRON_SECRET", "fake"); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    const context = { profiles: [{ id: learner, name: "Pessoa", manager_id: manager, department: "Suporte", role: "student", status: "active", audience: "internal" }, { id: manager, name: "Gestor", manager_id: null, department: "Suporte", role: "manager", status: "active", audience: "internal" }], profileDates: [], assignments: [], policies: [{ owner_id: manager, data: alertPolicySchema.parse({ discord: true, inactivityDays: 1, discordWeekdays: [0,1,2,3,4,5,6] }) }], presence: [], daily: [], progress: [], notices: [], courses: [], collectedSince: "2026-01-01T12:00:00Z" } as unknown as trailServer.TrailContext;
    const candidate = trailServer.alertCandidates(context, context.profiles[0], now).find(c => c.userId === learner)!;
    const notices: Record<string, any>[] = [{ id: "00000000-0000-4000-8000-000000000020", dedupe_key: candidate.key + ":0", user_id: learner, subject_id: learner, kind: candidate.kind, created_at: now.toISOString(), resolved_at: null, discord_status: "disabled", discord_attempts: 0 }];
    const links: Record<string, any>[] = linked ? [{ user_id: learner, discord_id: "111111111111111111", guild_id: "867749095967686676", enabled: true, last_attempt_day: null }] : [];
    vi.spyOn(trailServer, "trailContext").mockResolvedValue(context);
    const db = { from: (table: string) => {
      const source = table === "academy_discord_links" ? links : notices, filters: ((row: Record<string, any>) => boolean)[] = []; let update: Record<string, unknown> | undefined, single = false;
      const query: any = { select: () => query, order: () => query, limit: () => query, update: (value: Record<string, unknown>) => { update = value; return query; }, eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return query; }, is: (k: string, v: unknown) => { filters.push(r => (r[k] ?? null) === v); return query; }, lt: (k: string, v: string) => { filters.push(r => r[k] != null && r[k] < v); return query; }, or: () => { filters.push(r => !r.last_attempt_day || r.last_attempt_day < "2026-10-09"); return query; }, maybeSingle: () => { single = true; return query; }, then: (resolve: (r: unknown) => void) => { const matched = source.filter(r => filters.every(f => f(r))); if (update) matched.forEach(r => Object.assign(r, update)); return Promise.resolve(resolve({ data: single ? matched[0] ?? null : matched.map(r => ({ ...r })), error: null })); } };
      return query;
    } } as unknown as Parameters<typeof dispatchDiscord>[0];
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("/members/") ? { user: { id: "111111111111111111" } } : url.endsWith("/messages") ? { id: "333333333333333333" } : { id: "222222222222222222" }), { status: 200 })); vi.stubGlobal("fetch", fetchMock);
    return { db, context, notices, links, fetchMock };
  }
  it("não envia para contas desvinculadas ou em dias não autorizados", async () => {
    const f = fixture(false); await dispatchDiscord(f.db, f.context, now); expect(f.notices[0].discord_status).toBe("unlinked"); expect(f.fetchMock).not.toHaveBeenCalled();
    f.context.policies[0].data.discordWeekdays = [0]; f.links.push({ user_id: learner, guild_id: "867749095967686676", enabled: true });
    await dispatchDiscord(f.db, f.context, now); expect(f.fetchMock).not.toHaveBeenCalled();
  });
  it("envia uma vez e não repete em executores concorrentes", async () => {
    const f = fixture(); const result = await Promise.all([dispatchDiscord(f.db, f.context, now), dispatchDiscord(f.db, f.context, now)]);
    expect(result.reduce((n, r) => n + r.sent, 0)).toBe(1); expect(f.notices[0].discord_status).toBe("sent"); expect(f.fetchMock).toHaveBeenCalledTimes(3);
  });
  it("marca DM bloqueada e entrega incerta sem repetição automática", async () => {
    const f = fixture(); f.fetchMock.mockImplementation(async (url: string) => new Response(JSON.stringify(url.endsWith("/messages") ? { code: 50007 } : url.includes("/members/") ? { user: {} } : { id: "222222222222222222" }), { status: url.endsWith("/messages") ? 403 : 200 }));
    await dispatchDiscord(f.db, f.context, now); expect(f.notices[0].discord_status).toBe("blocked"); const count = f.fetchMock.mock.calls.length;
    await dispatchDiscord(f.db, f.context, now); expect(f.fetchMock).toHaveBeenCalledTimes(count);
    f.notices[0].discord_status = "disabled"; f.links[0].last_attempt_day = null; f.fetchMock.mockRejectedValue(new Error("timeout"));
    await dispatchDiscord(f.db, f.context, now); expect(f.notices[0].discord_status).toBe("uncertain");
  });
  it("revalida o acesso antes de enviar e cancela se o colaborador ficou inativo", async () => {
    const f = fixture(); vi.spyOn(trailServer, "trailContext").mockResolvedValue({ ...f.context, profiles: f.context.profiles.map(p => p.id === learner ? { ...p, status: "inactive" } : p) });
    await dispatchDiscord(f.db, f.context, now); expect(f.notices[0].discord_status).toBe("cancelled"); expect(f.fetchMock).not.toHaveBeenCalled();
  });
});
describe("vinculação transacional no PostgreSQL", () => {
  let db: PGlite;
  const learner = "00000000-0000-4000-8000-000000000001", other = "00000000-0000-4000-8000-000000000002", client = "00000000-0000-4000-8000-000000000003";
  const mutate = (actor: string | null, command: unknown) => db.query("select academy_discord_mutate($1,$2::jsonb)", [actor, JSON.stringify(command)]);
  beforeAll(async () => {
    db = new PGlite();
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create table academy_profiles(id uuid primary key,status text,audience text); create table academy_learning_notices(id uuid primary key,user_id uuid,resolved_at timestamptz,created_at timestamptz default now());");
    await db.exec(await readFile(new URL("../../supabase/migrations/20261010012411_discord_learning_bot.sql", import.meta.url), "utf8"));
    await db.query("insert into academy_profiles values($1,'active','internal'),($2,'active','internal'),($3,'active','client')", [learner, other, client]);
  }, 60000);
  afterAll(async () => db.close());
  it("consome código uma vez e preserva unicidade das duas contas", async () => {
    await mutate(learner, { type: "code", hash: codeHash("A".repeat(32)) });
    const command = { type: "consume", hash: codeHash("A".repeat(32)), discordId: "111111111111111111", guildId: "867749095967686676", username: "Pessoa" };
    await mutate(null, command); await expect(mutate(null, command)).rejects.toThrow("Código inválido");
    await mutate(other, { type: "code", hash: codeHash("B".repeat(32)) });
    await expect(mutate(null, { ...command, hash: codeHash("B".repeat(32)) })).rejects.toThrow("já está vinculada");
    expect((await db.query("select * from academy_discord_links")).rows).toHaveLength(1);
  });
  it("rejeita cliente, códigos expirados e criação repetida", async () => {
    await expect(mutate(client, { type: "code", hash: codeHash("C".repeat(32)) })).rejects.toThrow("colaboradores");
    await expect(mutate(learner, { type: "code", hash: codeHash("D".repeat(32)) })).rejects.toThrow("Aguarde");
    await db.query("update academy_discord_codes set expires_at=now()-interval '1 minute' where user_id=$1", [other]);
    await expect(mutate(null, { type: "consume", hash: codeHash("B".repeat(32)), discordId: "222222222222222222", guildId: "867749095967686676", username: "Outra" })).rejects.toThrow("Código inválido");
  });
  it("confirma apenas aviso enviado ao próprio destinatário e limita testes", async () => {
    const id = "00000000-0000-4000-8000-000000000020";
    await db.query("insert into academy_learning_notices(id,user_id,discord_status) values($1,$2,'sent')", [id, learner]);
    await expect(mutate(other, { type: "ack", id })).rejects.toThrow("Aviso indisponível");
    await mutate(learner, { type: "ack", id }); await mutate(learner, { type: "ack", id });
    expect((await db.query<{ discord_confirmed_at: string }>("select discord_confirmed_at from academy_learning_notices")).rows[0].discord_confirmed_at).toBeTruthy();
    await mutate(learner, { type: "test" }); await expect(mutate(learner, { type: "test" })).rejects.toThrow("aguarde");
  });
  it("reserva no máximo uma tentativa por pessoa/dia", async () => {
    const query = "update academy_discord_links set last_attempt_day=current_date where user_id=$1 and (last_attempt_day is null or last_attempt_day<current_date) returning user_id";
    const results = await Promise.all([db.query(query, [learner]), db.query(query, [learner])]);
    expect(results.reduce((n, r) => n + r.rows.length, 0)).toBe(1);
  });
  it("desvincula e bloqueia SELECT e RPC diretos do navegador", async () => {
    await db.exec("set role authenticated");
    try { await expect(db.query("select * from academy_discord_links")).rejects.toThrow("permission denied"); await expect(mutate(learner, { type: "unlink" })).rejects.toThrow("permission denied"); }
    finally { await db.exec("reset role"); }
    await mutate(learner, { type: "unlink" }); expect((await db.query("select * from academy_discord_links")).rows).toHaveLength(0);
  });
});
