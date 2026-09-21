import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { formatActiveTime, formatLastAccess } from "./engagement";

const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  manager: "00000000-0000-4000-8000-000000000002",
  assigned: "00000000-0000-4000-8000-000000000003",
  department: "00000000-0000-4000-8000-000000000004",
  other: "00000000-0000-4000-8000-000000000005",
  client: "00000000-0000-4000-8000-000000000006",
  pending: "00000000-0000-4000-8000-000000000007",
};
const session = "00000000-0000-4000-8000-000000000099";
const otherSession = "00000000-0000-4000-8000-000000000098";
let db: PGlite;
async function ping(user = ids.assigned, id = session, active = true) {
  await db.query("select academy_record_presence($1,$2,$3)", [user, id, active]);
}
async function elapsed(seconds: number) {
  await db.query("update academy_presence set last_heartbeat=clock_timestamp()-make_interval(secs=>$1) where user_id=$2", [seconds, ids.assigned]);
}
async function seconds() {
  const result = await db.query<{ total: number }>("select coalesce(sum(active_seconds),0)::int as total from academy_engagement_daily where user_id=$1", [ids.assigned]);
  return result.rows[0].total;
}
async function report(actor = ids.manager, days = 7) {
  const result = await db.query<{ data: { members: { userId: string; activeDays: number; activeSeconds: number; lastAccessAt: string | null }[] } }>("select academy_read_engagement($1,$2) data", [actor, days]);
  return result.rows[0].data;
}

describe("engagement database contract", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table academy_profiles(id uuid primary key, role text, status text, audience text, department text, manager_id uuid);
    `);
    await db.exec(await readFile(new URL("../../supabase/migrations/202609210002_engagement.sql", import.meta.url), "utf8"));
  }, 60_000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec("truncate academy_profiles,academy_presence,academy_engagement_daily cascade");
    for (const [name, id] of Object.entries(ids)) {
      await db.query("insert into academy_profiles values($1,$2,$3,$4,$5,$6)", [
        id, name === "admin" ? "admin" : name === "manager" ? "manager" : "student",
        name === "pending" ? "pending" : "active", name === "client" ? "client" : "internal",
        name === "assigned" ? "Financeiro" : "Suporte",
        name === "assigned" ? ids.manager : name === "other" ? ids.admin : null,
      ]);
    }
  });

  it("records first access with zero duration, then counts a bounded server interval", async () => {
    await ping();
    expect(await seconds()).toBe(0);
    await elapsed(60);
    await ping();
    expect(await seconds()).toBe(60);
    const member = (await report()).members.find(member => member.userId === ids.assigned)!;
    expect(member.activeDays).toBe(1);
    expect(member.lastAccessAt).not.toBeNull();
  });

  it("caps jitter to 60 seconds and discards offline/idle gaps", async () => {
    await ping(); await elapsed(72); await ping();
    expect(await seconds()).toBe(60);
    await elapsed(90); await ping();
    expect(await seconds()).toBe(60);
  });

  it("does not add another tab's time or let it stop the active session", async () => {
    await ping(); await elapsed(40);
    await ping(ids.assigned, otherSession);
    await ping(ids.assigned, otherSession, false);
    expect(await seconds()).toBe(0);
    const state = await db.query<{ session_id: string; active: boolean }>("select session_id,active from academy_presence");
    expect(state.rows[0]).toEqual({ session_id: session, active: true });
    await ping();
    expect(await seconds()).toBe(40);
    await ping();
    expect(await seconds()).toBe(40);
  });

  it("releases on blur and restarts with zero free duration", async () => {
    await ping(); await elapsed(20); await ping(ids.assigned, session, false);
    expect(await seconds()).toBe(20);
    await elapsed(30); await ping(ids.assigned, otherSession);
    expect(await seconds()).toBe(20);
    await elapsed(60); await ping(ids.assigned, otherSession);
    expect(await seconds()).toBe(80);
  });

  it("allows a new session after a lost lease without crediting the gap", async () => {
    await ping(); await elapsed(80); await ping(ids.assigned, otherSession);
    expect(await seconds()).toBe(0);
  });

  it("rejects unapproved/client telemetry and student reports", async () => {
    await expect(ping(ids.client)).rejects.toThrow("Acesso não autorizado");
    await expect(ping(ids.pending)).rejects.toThrow("Acesso não autorizado");
    await expect(report(ids.assigned)).rejects.toThrow("Acesso não autorizado");
    await expect(report(ids.client)).rejects.toThrow("Acesso não autorizado");
    await expect(report(ids.manager, 90)).rejects.toThrow("Período inválido");
  });

  it("limits managers to assigned staff or unassigned members of their sector", async () => {
    const members = (await report()).members.map(member => member.userId);
    expect(members).toContain(ids.assigned);
    expect(members).toContain(ids.department);
    expect(members).not.toContain(ids.other);
    expect(members).not.toContain(ids.client);
    expect(members).not.toContain(ids.pending);
    const all = (await report(ids.admin)).members.map(member => member.userId);
    expect(all).toContain(ids.other);
    expect(all).not.toContain(ids.client);
  });

  it("uses inclusive São Paulo calendar windows and preserves unknown last access", async () => {
    await db.query(`insert into academy_engagement_daily values
      ($1,(clock_timestamp() at time zone 'America/Sao_Paulo')::date,60),
      ($1,(clock_timestamp() at time zone 'America/Sao_Paulo')::date-6,120),
      ($1,(clock_timestamp() at time zone 'America/Sao_Paulo')::date-7,180),
      ($1,(clock_timestamp() at time zone 'America/Sao_Paulo')::date-29,240),
      ($1,(clock_timestamp() at time zone 'America/Sao_Paulo')::date-30,300)`, [ids.assigned]);
    const seven = (await report()).members.find(member => member.userId === ids.assigned)!;
    expect(seven).toMatchObject({ activeDays: 2, activeSeconds: 180, lastAccessAt: null });
    const thirty = (await report(ids.manager, 30)).members.find(member => member.userId === ids.assigned)!;
    expect(thirty).toMatchObject({ activeDays: 4, activeSeconds: 600 });
  });

  it("denies browser roles direct reads and forged RPC calls", async () => {
    await db.exec("set role authenticated");
    try {
      await expect(db.query("select * from academy_presence")).rejects.toThrow("permission denied");
      await expect(db.query("select academy_read_engagement($1,7)", [ids.admin])).rejects.toThrow("permission denied");
      await expect(ping()).rejects.toThrow("permission denied");
    } finally { await db.exec("reset role"); }
  });
});

describe("honest display formatting", () => {
  it("distinguishes missing history and sub-minute tracked presence", () => {
    expect(formatLastAccess(null)).toBe("Sem registro");
    expect(formatActiveTime(0)).toBe("0 min");
    expect(formatActiveTime(35)).toBe("< 1 min");
    expect(formatActiveTime(3720)).toBe("1h 2min");
    expect(formatLastAccess("2026-09-21T01:00:00Z")).toContain("20/09/2026");
  });
});
