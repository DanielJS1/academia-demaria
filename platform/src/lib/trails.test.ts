import { afterAll, beforeAll, describe, expect, it, vi, afterEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { alertPolicySchema, canManagePerson, daysUntil, deadlineKind, localDay, trailCommandSchema, trailCompletion } from "./trails";
import { alertCandidates, dispatchEmails, evaluateAlerts, readTrails, mutateTrails, validCronToken, type TrailContext } from "./trails-server";
import { type Profile } from "./pilot-server";
import { courseSchema, type AcademyState } from "./model";

const admin = "00000000-0000-4000-8000-000000000001", manager = "00000000-0000-4000-8000-000000000002", learner = "00000000-0000-4000-8000-000000000003", other = "00000000-0000-4000-8000-000000000004", client = "00000000-0000-4000-8000-000000000005", trailId = "00000000-0000-4000-8000-000000000010";
const makeProfile = (id: string, manager_id: string | null = manager): Profile => ({ id, manager_id, name: "Pessoa " + id.slice(-1), email: "teste@example.com", department: "Suporte", role: id === manager ? "manager" : id === admin ? "admin" : "student", audience: id === client ? "client" : "internal", status: "active" });
const course = courseSchema.parse({ id: "c1", title: "Curso técnico", description: "", product: "DOC", category: "", level: "essencial", accent: "violet", status: "published", xp: 10, required: false, banner: "", author: "", lessons: [{ id: "l1", title: "Aula", module: "", minutes: 1, type: "reading", content: "", videoUrl: "" }, { id: "q1", title: "Prova", module: "", minutes: 0, type: "quiz", content: "", videoUrl: "" }], questions: [], passingScore: 85, retryPolicy: "free", version: 1 });
const assignment = { id: trailId, trailId, userId: learner, assignedBy: manager, title: "Integração", courseIds: ["c1"], dueDate: "2026-10-10", learnerDays: 7, managerDays: 2, active: true, revision: 1, createdAt: "2026-10-01T12:00:00Z", completedCourses: 0, totalCourses: 1, progress: 0, complete: false };
function context(): TrailContext { return { profiles: [makeProfile(admin), makeProfile(manager, null), makeProfile(learner), makeProfile(other, admin)], profileDates: [{ id: learner, created_at: "2026-01-01T00:00:00Z" }], assignments: [assignment], policies: [{ owner_id: manager, data: alertPolicySchema.parse({ email: true }) }], presence: [{ user_id: learner, last_access_at: "2026-10-09T12:00:00Z" }], daily: [], progress: [], notices: [], trails: [], courses: [course], stateFor: () => ({ completed: {}, attempts: [] }) as unknown as AcademyState, collectedSince: "2026-01-01T00:00:00Z" }; }

describe("regras de trilhas e lembretes", () => {
  it("considera dias de São Paulo e antecedências diferentes, incluindo zero", () => {
    expect(localDay(new Date("2026-10-10T01:00:00Z"))).toBe("2026-10-09");
    expect(daysUntil("2026-10-10", "2026-10-09")).toBe(1);
    expect(deadlineKind({ ...assignment, learnerDays: 3, managerDays: 1 }, false, "2026-10-07")).toBe("deadline");
    expect(deadlineKind({ ...assignment, learnerDays: 3, managerDays: 1 }, true, "2026-10-07")).toBeNull();
    expect(deadlineKind({ ...assignment, learnerDays: 0 }, false, "2026-10-10")).toBe("deadline");
    expect(deadlineKind(assignment, true, "2026-10-11")).toBe("overdue");
    expect(deadlineKind({ ...assignment, complete: true }, true, "2026-10-11")).toBeNull();
    expect(deadlineKind({ ...assignment, active: false }, true, "2026-10-11")).toBeNull();
  });
  it("rejeita datas impossíveis, duplicatas e configurações incoerentes", () => {
    const command = { type: "assign", requestId: trailId, trailId, userIds: [learner], dueDate: "2026-02-30", learnerDays: 1, managerDays: 0 };
    expect(trailCommandSchema.safeParse(command).success).toBe(false);
    expect(trailCommandSchema.safeParse({ ...command, dueDate: "2026-02-28", userIds: [learner, learner] }).success).toBe(false);
    expect(alertPolicySchema.safeParse({ lowAccessWindow: 7, lowAccessMinDays: 8 }).success).toBe(false);
  });
  it("reutiliza aulas concluídas e exige aprovação das atividades do curso", () => {
    const state = { completed: { c1: ["l1"] }, attempts: [] } as unknown as AcademyState;
    expect(trailCompletion(["c1"], [course], state, learner).complete).toBe(false);
    state.attempts = [{ courseId: "c1", courseVersion: 1, userId: learner, status: "approved", quizId: "q1" }] as AcademyState["attempts"];
    expect(trailCompletion(["c1"], [course], state, learner).complete).toBe(true);
    expect(trailCompletion(["c1", "missing"], [course], state, learner).progress).toBe(50);
  });
  it("restringe gestão à equipe e exclui clientes e pessoas inativas", () => {
    const actor = { id: manager, role: "manager" as const, department: "Suporte" };
    const target = { id: learner, managerId: "", department: " suporte ", status: "active" as const, audience: "internal" as const };
    expect(canManagePerson(actor, target)).toBe(true);
    expect(canManagePerson(actor, { ...target, managerId: admin })).toBe(false);
    expect(canManagePerson(actor, { ...target, status: "inactive" })).toBe(false);
    expect(canManagePerson(actor, { ...target, audience: "client" })).toBe(false);
    expect(canManagePerson({ ...actor, department: "" }, { ...target, department: "" })).toBe(false);
  });
  it("avisa o gestor atual, sem e-mails para publicação de trilhas e retomadas", () => {
    const c = context(); c.assignments[0] = { ...assignment, assignedBy: admin };
    c.policies.push({ owner_id: admin, data: alertPolicySchema.parse({ email: true }) });
    c.progress.push({ user_id: learner, course_id: "c1", version: 1, position: 12 });
    const candidates = alertCandidates(c, makeProfile(learner), new Date("2026-10-09T12:00:00Z"));
    expect(candidates.find(n => n.kind === "deadline" && n.userId === manager)?.email).toBe(true);
    expect(candidates.some(n => n.kind === "deadline" && n.userId === admin)).toBe(false);
    expect(candidates.find(n => n.kind === "assigned")?.email).toBe(false);
    expect(candidates.find(n => n.kind === "resume")?.email).toBe(false);
    c.assignments[0] = { ...assignment, complete: true };
    expect(alertCandidates(c, makeProfile(learner), new Date("2026-10-09T12:00:00Z")).some(n => ["deadline", "assigned", "overdue"].includes(n.kind))).toBe(false);
  });
  it("não inventa inatividade ou baixa frequência antes de um período observado", () => {
    const c = context(); c.presence = []; c.assignments = []; c.collectedSince = "2026-10-08T00:00:00Z";
    c.policies[0].data = alertPolicySchema.parse({ inactivityDays: 5, lowAccessEnabled: true, lowAccessWindow: 7, lowAccessMinDays: 3 });
    expect(alertCandidates(c, makeProfile(learner), new Date("2026-10-09T12:00:00Z"))).toHaveLength(0);
    c.collectedSince = "2026-09-01T00:00:00Z";
    expect(alertCandidates(c, makeProfile(learner), new Date("2026-10-09T12:00:00Z")).filter(n => n.kind === "inactive")).toHaveLength(2);
    c.presence = [{ user_id: learner, last_access_at: "2026-10-09T12:00:00Z" }];
    expect(alertCandidates(c, makeProfile(learner), new Date("2026-10-09T12:00:00Z")).filter(n => n.kind === "low-access")).toHaveLength(2);
  });
  it("colaborador sem vínculo direto usa o gestor do seu setor", () => {
    const c = context(); c.profiles = c.profiles.map(p => p.id === learner ? { ...p, manager_id: null } : p);
    c.presence = [{ user_id: learner, last_access_at: "2026-09-01T12:00:00Z" }];
    expect(alertCandidates(c, makeProfile(learner, null), new Date("2026-10-09T12:00:00Z")).some(n => n.kind === "inactive" && n.userId === manager)).toBe(true);
  });
  it("a rotina agendada recusa segredo ausente e token incorreto", () => {
    vi.stubEnv("CRON_SECRET", "secret-test-long");
    expect(validCronToken(new Request("https://example.com"))).toBe(false);
    expect(validCronToken(new Request("https://example.com", { headers: { Authorization: "Bearer wrong" } }))).toBe(false);
    expect(validCronToken(new Request("https://example.com", { headers: { Authorization: "Bearer secret-test-long" } }))).toBe(true);
  });
  afterEach(() => vi.unstubAllEnvs());
});

describe("persistência transacional das trilhas", () => {
  let db: PGlite;
  const mutate = (actor: string, command: unknown) => db.query("select academy_trail_mutate($1,$2::jsonb)", [actor, JSON.stringify(command)]);
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create table academy_profiles(id uuid primary key,name text,email text,department text,manager_id uuid,role text,status text,audience text);
      create table academy_resources(id text primary key,kind text,published jsonb);
      create table academy_audit(actor uuid,action text,resource text);
      grant all on academy_profiles,academy_resources,academy_audit to service_role;`);
    await db.exec(await readFile(new URL("../../supabase/migrations/20261009213438_learning_trails_and_alerts.sql", import.meta.url), "utf8"));
    for (const p of [makeProfile(admin), makeProfile(manager, null), makeProfile(learner), makeProfile(other, admin), makeProfile(client)]) await db.query("insert into academy_profiles values($1,$2,$3,$4,$5,$6,$7,$8)", [p.id,p.name,p.email,p.department,p.manager_id,p.role,p.status,p.audience]);
    await db.query("insert into academy_resources values('c1','course',$1)", [JSON.stringify(course)]);
  }, 60000);
  afterAll(async () => { await db.close(); });
  const trail = { id: trailId, title: "Integração Suporte", description: "", purpose: "onboarding", department: "Suporte", courseIds: ["c1"], active: true };
  it("gestor cria e edita sua trilha com revisão; aluno não pode criar", async () => {
    await expect(mutate(learner, { type: "save", trail, expectedRevision: 0 })).rejects.toThrow("Somente a gestão");
    await mutate(manager, { type: "save", trail, expectedRevision: 0 });
    await expect(mutate(manager, { type: "save", trail, expectedRevision: 0 })).rejects.toThrow("alterada");
    await mutate(manager, { type: "save", trail: { ...trail, title: "Integração atualizada" }, expectedRevision: 1 });
  });
  it("atribuição em grupo é atômica, restrita à equipe e idempotente", async () => {
    const command = { type: "assign", requestId: "00000000-0000-4000-8000-000000000020", trailId, userIds: [learner, other], dueDate: "2026-12-10", learnerDays: 10, managerDays: 3 };
    await expect(mutate(manager, command)).rejects.toThrow("fora da sua equipe");
    expect((await db.query("select * from academy_trail_assignments")).rows).toHaveLength(0);
    await mutate(manager, { ...command, userIds: [learner] });
    await mutate(manager, { ...command, userIds: [learner] });
    await expect(mutate(manager, { ...command, userIds: [learner], learnerDays: 20 })).rejects.toThrow("outro conteúdo");
    expect((await db.query("select * from academy_trail_assignments")).rows).toHaveLength(1);
    await expect(mutate(manager, { ...command, requestId: "00000000-0000-4000-8000-000000000021", userIds: [client] })).rejects.toThrow("fora da sua equipe");
  });
  it("edição do modelo não altera cursos ou prazos das atribuições", async () => {
    await mutate(manager, { type: "save", trail: { ...trail, title: "Novo título" }, expectedRevision: 2 });
    const row = (await db.query<{ title: string; due_date: string; course_ids: string[] }>("select title,due_date::text,course_ids from academy_trail_assignments")).rows[0];
    expect(row.title).toBe("Integração atualizada"); expect(row.course_ids).toEqual(["c1"]); expect(row.due_date).toBe("2026-12-10");
  });
  it("ajuste individual cancela lembretes anteriores e rejeita concorrência", async () => {
    const a = (await db.query<{ id: string }>("select id from academy_trail_assignments")).rows[0];
    await db.query("insert into academy_learning_notices(dedupe_key,user_id,subject_id,assignment_id,kind,title,message,link,email_status) values('test',$1,$1,$2,'deadline','Prazo','Texto','/aprender/trilhas','pending')", [learner,a.id]);
    const command = { type: "assignment", id: a.id, expectedRevision: 1, dueDate: "2027-01-10", learnerDays: 5, managerDays: 1, active: true };
    await mutate(manager, command); await expect(mutate(manager, command)).rejects.toThrow("alterada");
    const notice = (await db.query<{ email_status: string; resolved_at: string }>("select * from academy_learning_notices where dedupe_key='test'")).rows[0];
    expect(notice.email_status).toBe("cancelled"); expect(notice.resolved_at).toBeTruthy();
  });
  it("configuração tem revisão e aviso só pode ser confirmado pelo destinatário", async () => {
    const p = { type: "policy", policy: alertPolicySchema.parse({}), expectedRevision: 0 };
    await mutate(manager, p); await expect(mutate(manager, p)).rejects.toThrow("alterada");
    const notice = (await db.query<{ id: string }>("select id from academy_learning_notices where dedupe_key='test'")).rows[0];
    await expect(mutate(other, { type: "ack", id: notice.id })).rejects.toThrow("não autorizado");
    await mutate(learner, { type: "ack", id: notice.id });
    expect((await db.query<{ seen_at: string }>("select seen_at from academy_learning_notices where id=$1", [notice.id])).rows[0].seen_at).toBeTruthy();
  });
  it("avisos manuais são idempotentes e não agendam e-mails", async () => {
    const command = { type: "announce", requestId: "00000000-0000-4000-8000-000000000022", userIds: [learner], title: "Nova meta", message: "Confira a trilha", popup: true };
    await mutate(manager, command); await mutate(manager, command);
    const rows = (await db.query<{ email_status: string }>("select * from academy_learning_notices where kind='manual'")).rows;
    expect(rows).toHaveLength(1); expect(rows[0].email_status).toBe("disabled");
  });
  it("navegador não tem acesso direto a tabelas nem à função de mutação", async () => {
    await db.exec("set role authenticated");
    try { await expect(db.query("select * from academy_trail_assignments")).rejects.toThrow("permission denied"); await expect(mutate(manager, { type: "ack", id: trailId })).rejects.toThrow("permission denied"); }
    finally { await db.exec("reset role"); }
  });
});

// A small in-memory PostgREST contract exercises outbox claiming and completion cancellation.
function noticeDB(notices: Record<string, any>[]) {
  return { from: () => {
    let update: Record<string, any> | undefined, insert: Record<string, any> | undefined, limit = Infinity;
    const filters: ((n: Record<string, any>) => boolean)[] = [];
    const query: any = {
      select: () => query, order: () => query, limit: (n: number) => { limit = n; return query; },
      update: (u: Record<string, any>) => { update = u; return query; },
      upsert: (u: Record<string, any>) => { insert = u; return query; },
      eq: (k: string, v: unknown) => { filters.push(n => n[k] === v); return query; },
      neq: (k: string, v: unknown) => { filters.push(n => n[k] !== v); return query; },
      lt: (k: string, v: any) => { filters.push(n => n[k] < v); return query; },
      gte: (k: string, v: any) => { filters.push(n => n[k] >= v); return query; },
      is: (k: string, v: unknown) => { filters.push(n => (n[k] ?? null) === v); return query; },
      in: (k: string, vs: unknown[]) => { filters.push(n => vs.includes(n[k])); return query; },
      then: (resolve: (value: unknown) => void) => {
        if (insert) { if (!notices.some(n => n.dedupe_key === insert!.dedupe_key)) notices.push({ id: `notice-${notices.length}`, seen_at: null, resolved_at: null, email_attempts: 0, ...insert }); return Promise.resolve(resolve({ data: [], error: null })); }
        const matches = notices.filter(n => filters.every(f => f(n))).slice(0, limit);
        if (update) matches.forEach(n => Object.assign(n, update));
        return Promise.resolve(resolve({ data: matches.map(n => ({ ...n })), error: null }));
      },
    }; return query;
  } } as unknown as Parameters<typeof dispatchEmails>[0];
}
describe("deduplicação e entrega dos avisos", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("não repete avisos ao atualizar a página e cancela a pendência ao concluir", async () => {
    const c = context(); const notices: Record<string, any>[] = []; const db = noticeDB(notices);
    const now = new Date("2026-10-09T12:00:00Z");
    await evaluateAlerts(db, c, [makeProfile(learner)], now); c.notices = notices;
    const count = notices.length; expect(count).toBe(3);
    await evaluateAlerts(db, c, [makeProfile(learner)], now); expect(notices).toHaveLength(count);
    c.assignments = [{ ...assignment, complete: true }];
    await evaluateAlerts(db, c, [makeProfile(learner)], now);
    expect(notices.every(n => n.resolved_at)).toBe(true);
    expect(notices.filter(n => n.email_status === "pending")).toHaveLength(0);
  });
  it("desativação de pop-ups é aplicada a avisos já criados", async () => {
    const c = context(), notices: Record<string, any>[] = [], db = noticeDB(notices), now = new Date("2026-10-09T12:00:00Z");
    await evaluateAlerts(db, c, [makeProfile(learner)], now); c.notices = notices;
    c.policies[0].data = alertPolicySchema.parse({ popup: false, email: false });
    await evaluateAlerts(db, c, [makeProfile(learner)], now);
    expect(notices.every(n => !n.popup)).toBe(true); expect(notices.some(n => n.email_status === "pending")).toBe(false);
  });
  it("sem credenciais do provedor nenhum e-mail é disparado", async () => {
    vi.stubEnv("RESEND_API_KEY", ""); const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect(await dispatchEmails(noticeDB([]), context())).toEqual({ sent: 0, failed: 0, configured: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reserva um envio uma única vez e não envia lembrete de trilha já concluída", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key"); vi.stubEnv("LEARNING_EMAIL_FROM", "Academia <teste@example.com>"); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    const now = new Date(), c = context(); c.assignments = [{ ...assignment, dueDate: localDay(now) }];
    const candidate = alertCandidates(c, makeProfile(learner), now).find(n => n.kind === "deadline" && n.userId === learner)!;
    const notice = { id: "mail-1", dedupe_key: candidate.key + ":bucket", user_id: learner, subject_id: learner, assignment_id: trailId, title: "Prazo", message: "Concluir", link: "/aprender/trilhas", email_status: "pending", email_attempts: 0, resolved_at: null, created_at: now.toISOString() };
    const notices = [notice], db = noticeDB(notices);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetchMock);
    const deliveries = await Promise.all([dispatchEmails(db, c), dispatchEmails(db, c)]);
    expect(deliveries.reduce((sum, d) => sum + d.sent, 0)).toBe(1); expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBe("learning-mail-1");
    notices.push({ ...notice, id: "mail-2", dedupe_key: candidate.key + ":other", email_status: "pending" });
    c.assignments[0].complete = true;
    await dispatchEmails(db, c); expect(fetchMock).toHaveBeenCalledTimes(1); expect(notices[1].email_status).toBe("cancelled");
  });
  it("falha de confirmação fica visível e não causa reenvio automático incerto", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key"); vi.stubEnv("LEARNING_EMAIL_FROM", "Academia <teste@example.com>"); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    const c = context(); c.assignments = [{ ...assignment, dueDate: localDay() }];
    const candidate = alertCandidates(c, makeProfile(learner)).find(n => n.kind === "deadline" && n.userId === learner)!;
    const notices = [{ id: "uncertain-1", dedupe_key: candidate.key + ":bucket", user_id: learner, subject_id: learner, title: "Prazo", message: "Concluir", link: "/aprender/trilhas", email_status: "pending", email_attempts: 0, resolved_at: null, created_at: new Date().toISOString() }];
    const db = noticeDB(notices), fetchMock = vi.fn().mockRejectedValue(new Error("Timeout")); vi.stubGlobal("fetch", fetchMock);
    expect((await dispatchEmails(db, c)).failed).toBe(1); expect(notices[0].email_status).toBe("uncertain");
    await dispatchEmails(db, c); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("privacidade da resposta da API", () => {
  it("aluno recebe apenas seus avisos; gestor vê apenas avisos da própria equipe", async () => {
    const profiles = [makeProfile(admin, null), makeProfile(manager, null), makeProfile(learner), makeProfile(other, admin)];
    const notice = (id: string, user_id: string, subject_id: string) => ({ id, user_id, subject_id, assignment_id: null, kind: "manual", title: "Aviso", message: "Interno", link: "/aprender/trilhas", popup: true, created_at: "2026-10-09T12:00:00Z", email_status: "disabled" });
    const data: Record<string, unknown[]> = { academy_profiles: profiles.map(p => ({ ...p, created_at: "2026-10-09T12:00:00Z" })), academy_resources: [], academy_trail_assignments: [], academy_trail_policies: [], academy_presence: [], academy_engagement_daily: [], academy_progress: [], academy_attempts: [], academy_learning_notices: [notice("own", learner, learner), notice("manager-private", manager, learner), notice("other-team", other, other)], academy_trails: [] };
    const db = { from: (table: string) => {
      const query: any = { select: () => query, order: () => query, range: () => query, single: () => Promise.resolve({ data: { collected_since: "2026-10-09T12:00:00Z" }, error: null }), then: (resolve: any) => Promise.resolve(resolve({ data: data[table] ?? [], error: null })) }; return query;
    } } as unknown as Parameters<typeof readTrails>[0];
    const student = await readTrails(db, makeProfile(learner)); expect(student.notices.map(n => n.id)).toEqual(["own"]);
    const managed = await readTrails(db, makeProfile(manager, null)); expect(managed.notices.map(n => n.id)).toEqual(["own", "manager-private"]);
    await expect(readTrails(db, { ...makeProfile(client), audience: "client" })).rejects.toMatchObject({ status: 403 });
  });
  it("aluno não consegue publicar aviso nem alterar configurações", async () => {
    const rpc = vi.fn(), db = { rpc } as unknown as Parameters<typeof mutateTrails>[0];
    await expect(mutateTrails(db, makeProfile(learner), { type: "policy", policy: alertPolicySchema.parse({}), expectedRevision: 0 })).rejects.toMatchObject({ status: 403 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
