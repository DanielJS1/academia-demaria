import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { initialState } from "../seed";
import { ApiError } from "../api-error";
import { readReport } from "./server";
import { readPages, type ReportDB } from "./read.server";
import { GET } from "@/app/api/reports/route";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { reportCsv } from "./export";
import { reportColumns } from "./presentation";
import { defaultReportLocation } from "./navigation";

const auth = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock("../pilot-server", () => ({ authenticate: auth.authenticate, ApiError }));
const now = new Date("2026-10-12T15:00:00Z");
const actor = { id: "manager", name: "Gestor", email: "private@example.test", department: " Suporte ", manager_id: null, role: "manager", status: "active", audience: "internal" };
const db = new PGlite();
const queries: { table: string; predicates: string[]; values: unknown[]; start: number; end: number }[] = [];
function adapter(): ReportDB {
  return { from(table: string) {
    let columns = "*", start = 0, end = 499;
    const predicates: string[] = [], values: unknown[] = [], orders: string[] = [];
    const bind = (field: string, operator: string, value: unknown) => { values.push(value); predicates.push(`${field} ${operator} $${values.length}`); return builder; };
    const run = async (single = false) => {
      queries.push({ table, predicates: [...predicates], values: [...values], start, end });
      try {
        const result = await db.query<Record<string, unknown>>(`select ${columns} from ${table}${predicates.length ? ` where ${predicates.join(" and ")}` : ""}${orders.length ? ` order by ${orders.join(",")}` : ""} limit ${end - start + 1} offset ${start}`, values);
        const rows = result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? ["day", "due_date"].includes(key) ? value.toISOString().slice(0, 10) : value.toISOString() : value])));
        return { data: single ? rows[0] ?? null : rows, error: null };
      } catch (error) { return { data: null, error }; }
    };
    const builder = {
      select: (value: string) => { columns = value; return builder; },
      eq: (field: string, value: unknown) => bind(field, "=", value), neq: (field: string, value: unknown) => bind(field, "<>", value),
      gte: (field: string, value: unknown) => bind(field, ">=", value), lte: (field: string, value: unknown) => bind(field, "<=", value), lt: (field: string, value: unknown) => bind(field, "<", value),
      ilike: (field: string, value: unknown) => bind(field, "ilike", value),
      is: (field: string) => { predicates.push(`${field} is null`); return builder; },
      not: (field: string) => { predicates.push(`${field} is not null`); return builder; },
      in: (field: string, list: unknown[]) => { const placeholders = list.map(value => { values.push(value); return `$${values.length}`; }); predicates.push(`${field} in (${placeholders.join(",")})`); return builder; },
      order: (field: string) => { orders.push(field); return builder; },
      range: (from: number, to: number) => { start = from; end = to; return builder; },
      maybeSingle: () => run(true),
      then: (resolve: (result: unknown) => unknown) => run().then(resolve),
    };
    return builder;
  } } as unknown as ReportDB;
}
const course = { ...initialState.courses[0], id: "course", title: "Curso interno", version: 2, lessons: [
  { ...initialState.courses[0].lessons[0], id: "reading" },
  { ...initialState.courses[0].lessons[4], id: "quiz" },
] };
const question = { id: "choice", prompt: "Questão", type: "choice", options: ["A", "B", "C"], correct: '["A","B"]', multiple: true };
async function addAttempt(id: string, userId: string, score: number | null, submittedAt: string, status = "approved", version = 2, quizId: string | null = "quiz") {
  await db.query("insert into academy_attempts values($1,$2,'course',$3,$4,$5,$6,$7,'Feedback oficial',$8,$9,$10,$11)", [id, userId, version, quizId, JSON.stringify({ ...course, questions: [question, { id: "text", prompt: "Dissertativa", type: "text", options: [], correct: "Gabarito privado" }] }), JSON.stringify({ choice: '["B","A"]', text: "Resposta particular" }), status, score, submittedAt, JSON.stringify([]), JSON.stringify(["text"])]);
}
const request = new Request("http://localhost/api/reports", { headers: { Authorization: "Bearer fixture" } });
const value = (dataset: Awaited<ReturnType<typeof readReport>>, id: string) => dataset.kpis.find(item => item.id === id)?.value;
const custom = { kind: "custom", startDate: "2026-10-01", endDate: "2026-10-10" };

beforeAll(async () => {
  await db.exec(`
    create table academy_profiles(id text primary key, name text, department text, manager_id text, status text, audience text, created_at timestamptz);
    create table academy_engagement_config(id boolean primary key, collected_since timestamptz);
    create table academy_presence(user_id text primary key,last_access_at timestamptz);
    create table academy_engagement_daily(user_id text, day date, active_seconds integer, primary key(user_id,day));
    create table academy_trail_assignments(id text primary key,user_id text,active boolean,course_ids jsonb,due_date date);
    create table academy_resources(id text primary key,kind text,published jsonb);
    create table academy_progress(user_id text,course_id text,version integer,lesson_id text,done boolean,primary key(user_id,course_id,version,lesson_id));
    create table academy_attempts(id text primary key,user_id text,course_id text,version integer,quiz_id text,snapshot jsonb,answers jsonb,status text,feedback text,score double precision,submitted_at timestamptz,correct_text_ids jsonb,partial_text_ids jsonb);
    create table academy_report_collection(id boolean primary key,collected_since timestamptz);
    create table academy_report_completions(user_id text,course_id text,version integer,completed_at timestamptz);
    create table academy_quizzes(id text primary key,target_audience text);
    create table academy_quiz_attempts(id text primary key,user_id text,quiz_id text,score_percentage double precision,passed boolean,completed_at timestamptz,snapshot jsonb,quiz_revision integer,scoring_version integer,snapshot_status text,correct_count integer,question_count integer);
    create table academy_xp(id text primary key,user_id text,amount integer,season text,created_at timestamptz);
    create table academy_community_articles(article_id text primary key,author_id text);
    create table academy_community_comments(id text primary key,article_id text,user_id text,created_at timestamptz);
    create table academy_community_reactions(article_id text,user_id text,reaction text,active boolean);
    create table academy_report_reactions(id text primary key,article_id text,user_id text,author_id text,reaction text,active boolean,occurred_at timestamptz);
    create table academy_report_publications(article_id text primary key,author_id text,first_published_at timestamptz,origin text);
  `);
}, 30000);
afterAll(async () => { await db.close(); });
beforeEach(async () => {
  queries.length = 0; auth.authenticate.mockReset(); auth.authenticate.mockResolvedValue({ db: adapter(), me: actor });
  await db.exec("truncate academy_profiles,academy_engagement_config,academy_presence,academy_engagement_daily,academy_trail_assignments,academy_resources,academy_progress,academy_attempts,academy_report_collection,academy_report_completions; insert into academy_report_collection values(true,'2026-10-11T15:00:00Z');");
  await db.exec("truncate academy_quizzes,academy_quiz_attempts,academy_xp,academy_community_articles,academy_community_comments,academy_community_reactions,academy_report_reactions,academy_report_publications;");
  await db.exec(`insert into academy_profiles values
    ('manager','Gestor','Suporte',null,'active','internal','2026-09-01'),
    ('a','Pessoa A',' Financeiro ','manager','active','internal','2026-09-01'),
    ('b','Pessoa B',' suporte ',null,'active','internal','2026-10-08'),
    ('outside','Outra equipe','Suporte','other-manager','active','internal','2026-09-01'),
    ('accent','Outro departamento','Supórte',null,'active','internal','2026-09-01'),
    ('pending','Pendente','Suporte','manager','pending','internal','2026-09-01'),
    ('client','Cliente','Suporte','manager','active','client','2026-09-01'),
    ('inactive','Inativo','Suporte','manager','inactive','internal','2026-09-01');
    insert into academy_engagement_config values(true,'2026-10-05T15:00:00Z');
    insert into academy_engagement_daily values('a','2026-10-05',0),('a','2026-10-06',120),('b','2026-10-08',60),('outside','2026-10-08',86400);
    insert into academy_presence values('a','2026-10-12T12:00:00Z');
    insert into academy_trail_assignments values('t1','a',true,'["course"]','2026-10-09'),('t2','a',true,'["course"]','2026-10-11'),('old','b',false,'["course"]','2026-10-01');
    insert into academy_progress values('a','course',2,'reading',true),('b','course',1,'reading',true);`);
  await db.query("insert into academy_resources values('course','course',$1),('client-course','course',$2)", [JSON.stringify(course), JSON.stringify({ ...course, id: "client-course", audience: "client" })]);
});

describe("read-only managerial reports with isolated PostgreSQL queries", () => {
  it("isolates a second manager and refuses the first manager's direct report", async () => {
    auth.authenticate.mockResolvedValue({ db: adapter(), me: { ...actor, id: "other-manager", department: "Comercial" } });
    const report = await readReport(request, { view: "presence", period: custom }, now);
    expect(report.meta.personIds).toEqual(["outside"]);
    expect(value(report, "active_minutes")).toBe(1440);
    queries.length = 0;
    await expect(readReport(request, { view: "presence", personId: "a" }, now)).rejects.toMatchObject({ status: 403 });
    expect(queries.every(query => query.table === "academy_profiles")).toBe(true);
  });
  it("matches independent source arithmetic and exports the same reference dataset", async () => {
    const report = await readReport(request, { view: "presence", period: custom }, now);
    const source = await db.query<{ seconds: number; days: number }>(`select sum(active_seconds)::int as seconds, count(*)::int as days
      from academy_engagement_daily where user_id in ('a','b') and day >= '2026-10-01' and day < '2026-10-11'`);
    // Independently counted: A has 6 observable calendar days, B has 3; 3 access days, 180 seconds.
    expect(source.rows[0]).toEqual({ seconds: 180, days: 3 });
    expect(value(report, "active_minutes")).toBe(source.rows[0].seconds / 60);
    expect(value(report, "access_frequency")).toBeCloseTo(source.rows[0].days / (6 + 3) * 100);
    await db.exec("insert into academy_xp values('one','a',10,'2026','2026-10-06'),('two','b',-2,'2026','2026-10-08'),('excluded','outside',900,'2026','2026-10-08');");
    const xp = await readReport(request, { view: "xp", period: custom }, now);
    expect(value(xp, "xp_period")).toBe(10 - 2);
    expect(xp.rows.map(row => row.userId)).toEqual(["a", "b"]);
    const location = { ...defaultReportLocation(), query: xp.query };
    const csv = reportCsv(xp, reportColumns(xp), xp.rows, location);
    expect(csv).toContain('"10"'); expect(csv).toContain('"-2"'); expect(csv).not.toContain('"900"');
    const output = process.env.REPORT_QA_OUTPUT;
    if (output) {
      mkdirSync(output, { recursive: true });
      writeFileSync(join(output, "reference-datasets.json"), JSON.stringify({ presence: report, xp, expected: { minutes: 3, frequency: 100 / 3, xp: 8, people: ["a", "b"] } }, null, 2));
      writeFileSync(join(output, "reference-xp.csv"), csv);
    }
  });
  it("enforces actor scope on the real GET route for admin, both managers, student and client", async () => {
    const cases = [
      { me: { ...actor, role: "admin" }, personId: "outside", status: 200 },
      { me: actor, personId: "outside", status: 403 },
      { me: { ...actor, id: "other-manager", department: "Comercial" }, personId: "a", status: 403 },
      { me: { ...actor, role: "student" }, personId: "a", status: 403 },
      { me: { ...actor, audience: "client" }, personId: "a", status: 403 },
    ];
    for (const scenario of cases) {
      auth.authenticate.mockResolvedValue({ db: adapter(), me: scenario.me });
      queries.length = 0;
      const query = encodeURIComponent(JSON.stringify({ view: "presence", period: custom, personId: scenario.personId }));
      const response = await GET(new Request(`http://localhost/api/reports?query=${query}`, { headers: { Authorization: "Bearer fixture" } }));
      expect(response.status).toBe(scenario.status);
      expect(response.headers.get("cache-control")).toContain("no-store");
      if (scenario.status === 403) {
        expect(queries.every(query => query.table === "academy_profiles")).toBe(true);
        expect(await response.text()).not.toMatch(/lastAccessAt|active_minutes|Gabarito|PDI/);
      } else expect((await response.json()).meta.personIds).toEqual(["outside"]);
    }
  });
  it("resolves only active internal scope before reading events; keeps last known access outside historical period", async () => {
    const report = await readReport(request, { view: "presence", period: custom }, now);
    expect(report.meta.personIds).toEqual(["a", "b"]);
    expect(report.meta.collectedSince).toBe("2026-10-05T15:00:00.000Z");
    const row = report.rows[0]; expect(row.type).toBe("presence");
    expect(row).toMatchObject({ lastAccessAt: "2026-10-12T12:00:00.000Z" });
    expect(row.metrics.find(item => item.id === "access_days")?.value).toBe(2);
    expect(row.metrics.find(item => item.id === "observable_days")?.value).toBe(6);
    expect(value(report, "access_frequency")).toBeCloseTo(3 / 9 * 100);
    expect(value(report, "active_minutes")).toBe(3);
    expect(report.kpis.find(item => item.id === "active_minutes")?.estimated).toBe(true);
    expect(report.series[0].points[0].value).toBeNull();
    expect(report.meta.coverage.presence.availability).toBe("partial");
    for (const query of queries.filter(query => ["academy_presence", "academy_engagement_daily"].includes(query.table))) {
      expect(query.values).toContain("a"); expect(query.values).toContain("b"); expect(query.values).not.toContain("outside");
    }
    expect(JSON.stringify(report)).not.toContain("private@example.test");
    expect(auth.authenticate).toHaveBeenCalledWith(request, { createMissingProfile: false });
  });
  it("rejects person/department forgery without reading events; denies student, client, pending and inactive", async () => {
    for (const input of [{ personId: "outside" }, { personId: "pending" }, { department: "Supórte" }, { personId: "a", department: "Suporte" }]) {
      queries.length = 0;
      await expect(readReport(request, { view: "presence", ...input }, now)).rejects.toMatchObject({ status: 403 });
      expect(queries.every(query => query.table === "academy_profiles")).toBe(true);
    }
    for (const me of [{ ...actor, role: "student" }, { ...actor, audience: "client" }, { ...actor, status: "pending" }, { ...actor, status: "inactive" }]) {
      queries.length = 0; auth.authenticate.mockResolvedValue({ db: adapter(), me });
      await expect(readReport(request, { view: "presence" }, now)).rejects.toMatchObject({ status: 403 }); expect(queries).toHaveLength(0);
    }
  });
  it("admin can read all active internal people except self and can refine department", async () => {
    auth.authenticate.mockResolvedValue({ db: adapter(), me: { ...actor, role: "admin" } });
    const report = await readReport(request, { view: "presence", department: "Suporte" }, now);
    expect(report.meta.personIds).toEqual(["outside", "b"].sort());
  });
  it("uses calendar midnight boundaries for 7/30/custom, distinguishes zero from unavailable", async () => {
    for (const kind of ["last7", "last30"]) {
      const report = await readReport(request, { view: "presence", period: { kind } }, now);
      expect(report.meta.period?.calendarDays).toBe(kind === "last7" ? 7 : 30);
      expect(report.meta.period?.startInclusive.endsWith("T03:00:00.000Z")).toBe(true);
    }
    const before = await readReport(request, { view: "presence", period: { kind: "custom", startDate: "2026-10-01", endDate: "2026-10-04" } }, now);
    expect(before.kpis.every(item => item.value === null)).toBe(true);
    const zero = await readReport(request, { view: "presence", period: { kind: "custom", startDate: "2026-10-09", endDate: "2026-10-10" } }, now);
    expect(value(zero, "active_minutes")).toBe(0); expect(value(zero, "access_days")).toBe(0);
    await expect(readReport(request, { view: "presence", period: { kind: "custom", startDate: "2026-10-10", endDate: "2026-10-13" } }, now)).rejects.toMatchObject({ status: 400 });
  });
  it("deduplicates two active trail assignments; 100% lessons waits for an assessment; overdue is a distinct assignment count", async () => {
    const report = await readReport(request, { view: "learning" }, now);
    expect(report.meta.period).toBeNull(); expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ status: "awaiting_assessment", courseVersion: 2 });
    expect(value(report, "lesson_progress")).toBe(100); expect(value(report, "completion_rate")).toBe(0);
    expect(value(report, "overdue_assignments")).toBe(2); expect(value(report, "overdue_people")).toBe(1);
    await addAttempt("approve", "a", 80, "2026-10-10T12:00:00Z");
    const completed = await readReport(request, { view: "learning" }, now);
    expect(value(completed, "completion_rate")).toBe(100); expect(value(completed, "overdue_assignments")).toBe(0);
    expect(JSON.stringify(completed)).not.toContain("Gabarito privado");
  });
  it("keeps catalog separate and refuses to infer temporal completions from current progress", async () => {
    const current = await readReport(request, { view: "learning", learningScope: "catalog" }, now);
    expect(current.rows).toHaveLength(2); expect(value(current, "completion_rate")).toBe(0);
    const activity = await readReport(request, { view: "learning", learningMode: "activity", period: custom }, now);
    expect(value(activity, "period_completions")).toBeNull();
    expect(activity.meta.coverage.periodCompletions.availability).toBe("unavailable");
    expect(activity.rows).toHaveLength(0);
  });
  it("keeps lack of assignments distinct from zero completion; rejects client-course filters", async () => {
    const report = await readReport(request, { view: "learning", personId: "b" }, now);
    expect(report.rows).toHaveLength(0); expect(value(report, "course_pairs")).toBe(0); expect(value(report, "completion_rate")).toBeNull();
    await expect(readReport(request, { view: "learning", learningScope: "catalog", courseId: "client-course" }, now)).rejects.toMatchObject({ status: 403 });
    await db.exec("delete from academy_engagement_config");
    const presence = await readReport(request, { view: "presence" }, now);
    expect(presence.meta.collectedSince).toBeNull(); expect(value(presence, "active_minutes")).toBeNull();
  });
  it("groups assessment versions separately, resolves legacy activity IDs, and preserves proficiency completion semantics", async () => {
    await addAttempt("v1", "a", 90, "2026-10-09T12:00:00Z", "approved", 1);
    await addAttempt("legacy", "a", 80, "2026-10-10T12:00:00Z", "approved", 2, null);
    await addAttempt("v2", "a", 60, "2026-10-10T15:00:00Z", "retry", 2);
    const report = await readReport(request, { view: "learning", learningDetail: "assessments", period: custom }, now);
    expect(report.rows.map(row => row.id).sort()).toEqual(["v1", "v2"]);
    expect(report.rows.every(row => row.type === "assessment" && row.activityId === "quiz")).toBe(true);
    expect(value(report, "grade_average")).toBe(75);
    await addAttempt("proficiency", "a", 85, "2026-10-10T15:00:00Z", "approved", 2, "proficiency");
    const complete = await readReport(request, { view: "learning" }, now);
    expect(complete.rows[0]).toMatchObject({ status: "completed" });
    expect(value(complete, "overdue_assignments")).toBe(0);
  });
  it("defaults to latest graded in the interval by person/activity/version; sanitizes choice/partial/pending and averages people", async () => {
    await addAttempt("old", "a", 100, "2026-10-09T12:00:00Z");
    await addAttempt("latest", "a", 80, "2026-10-10T12:00:00Z");
    await addAttempt("b", "b", 40, "2026-10-10T12:00:00Z");
    await addAttempt("pending", "a", null, "2026-10-10T15:00:00Z", "pending");
    await addAttempt("after-midnight", "a", 20, "2026-10-11T03:00:00Z");
    await addAttempt("outside", "outside", 0, "2026-10-10T12:00:00Z");
    const query = { view: "learning", learningDetail: "assessments", period: custom };
    const latest = await readReport(request, query, now);
    expect(latest.query).toMatchObject({ learningMode: "activity", attemptPolicy: "latest", learningScope: "catalog" });
    expect(latest.rows.map(row => row.id).sort()).toEqual(["b", "latest", "pending"]);
    expect(value(latest, "grade_average")).toBe(60); expect(value(latest, "pending_attempts")).toBe(1);
    expect(latest.rows.find(row => row.id === "latest")).toMatchObject({ diagnostic: { counts: { correct: 1, partial: 1, incorrect: 0 } }, feedback: "Feedback oficial" });
    expect(latest.rows.find(row => row.id === "pending")).toMatchObject({ diagnostic: { score: null, counts: { pending: 2 } } });
    expect(JSON.stringify(latest)).not.toMatch(/Gabarito privado|Resposta particular|snapshot|answers/);
    const best = await readReport(request, { ...query, attemptPolicy: "best" }, now); expect(value(best, "grade_average")).toBe(70);
    const all = await readReport(request, { ...query, attemptPolicy: "all" }, now); expect(value(all, "grade_average")).toBe(65);
    const pending = await readReport(request, { ...query, status: "pending" }, now); expect(value(pending, "grade_average")).toBeNull(); expect(value(pending, "people_with_grades")).toBe(0);
  });
  it("reads more than 1,000 attempts with bounded pagination and rejects explicit return overflow", async () => {
    await db.query("insert into academy_attempts select 'many-'||n,'a','course',2,'quiz',$1,'{}','approved','',50,'2026-10-10T12:00:00Z','[]','[]' from generate_series(1,1005) n", [JSON.stringify({ ...course, questions: [] })]);
    const report = await readReport(request, { view: "learning", learningDetail: "assessments", attemptPolicy: "all", period: custom }, now);
    expect(report.rows).toHaveLength(1005); expect(value(report, "graded_attempts")).toBe(1005);
    expect(queries.filter(query => query.table === "academy_attempts").map(query => query.start)).toEqual([0, 500, 1000]);
    await db.query("insert into academy_attempts select 'extra-'||n,'a','course',2,'quiz',$1,'{}','approved','',50,'2026-10-10T12:00:00Z','[]','[]' from generate_series(1,9000) n", [JSON.stringify({ ...course, questions: [] })]);
    await expect(readReport(request, { view: "learning", learningDetail: "assessments", attemptPolicy: "all", period: custom }, now)).rejects.toMatchObject({ status: 422 });
  });
  it("never maps a source error to zero; returns private/no-store for successes and failures", async () => {
    const result = await GET(new Request(`http://localhost/api/reports?query=${encodeURIComponent(JSON.stringify({ view: "presence" }))}`));
    expect(result.status).toBe(200); expect(result.headers.get("cache-control")).toBe("private, no-store");
    auth.authenticate.mockRejectedValue(new ApiError("Sessão expirada", 401));
    const denied = await GET(new Request(`http://localhost/api/reports?query=${encodeURIComponent('{"view":"presence"}')}`));
    expect(denied.status).toBe(401); expect(denied.headers.get("vary")).toBe("Authorization");
    await expect(readPages(async () => ({ data: null, error: new Error("offline") }))).rejects.toMatchObject({ status: 503 });
    const malformed = await GET(new Request('http://localhost/api/reports?query={broken}')); expect(malformed.status).toBe(400);
  });
  it("reads challenge official results without exposing snapshots and flags legacy review; rejects client challenge before attempts", async () => {
    await db.exec(`insert into academy_quizzes values('q1','internal'),('q2','internal'),('client-quiz','client');
      insert into academy_quiz_attempts values('a1','a','q1',80,true,'2026-10-09',null,null,1,'unavailable',null,null),
      ('a2','a','q2',40,false,'2026-10-09',null,null,1,'unavailable',null,null),
      ('b1','b','q1',100,true,'2026-10-09','{"title":"Desafio vigente","target_audience":"internal","questions":[{"correct_option_id":"secret"},{"correct_option_id":"secret"}]}',2,2,'complete',2,2),
      ('outsider','outside','q1',0,false,'2026-10-09',null,null,1,'unavailable',null,null);`);
    const report=await readReport(request,{view:"challenges",period:custom},now);
    expect(report.rows).toHaveLength(3);expect(value(report,"challenge_average")).toBe(80);expect(value(report,"challenge_participation_rate")).toBeNull();
    expect(report.rows.find(row=>row.id==="a1")).toMatchObject({reviewAvailable:false,correctCount:null});
    expect(report.rows.find(row=>row.id==="b1")).toMatchObject({reviewAvailable:true,correctCount:2,revision:2});
    expect(JSON.stringify(report)).not.toMatch(/secret|"snapshot"|outsider/);
    queries.length=0;await expect(readReport(request,{view:"challenges",challengeId:"client-quiz"},now)).rejects.toMatchObject({status:403});
    expect(queries.some(query=>query.table==="academy_quiz_attempts")).toBe(false);
  });
  it("uses the team ledger for period/season/history, including zeroed and signed adjustments",async()=>{
    await db.exec(`insert into academy_xp values('a-period','a',20,'2026','2026-10-09'),('a-old','a',10,'2025','2025-01-01'),
      ('revoked','a',0,'2026','2026-10-09'),('adjustment','a',-3,'2026','2026-10-09'),('b-period','b',15,'2026','2026-10-09'),('outside','outside',999,'2026','2026-10-09');`);
    const report=await readReport(request,{view:"xp",period:custom},now);
    expect(value(report,"xp_period")).toBe(32);expect(value(report,"xp_season")).toBe(32);expect(value(report,"xp_history")).toBe(42);
    expect(report.meta.coverage.xpHistory.availability).toBe("partial");expect(report.rows.map(row=>row.userId)).toEqual(["a","b"]);
    expect(report.rows.reduce((sum,row)=>sum+(row.metrics.find(metric=>metric.id==="xp_period")?.value??0),0)).toBe(32);
  });
  it("counts surviving comments independently of rewards, deduplicates on-off-on, and separates active balances",async()=>{
    await db.exec(`update academy_report_collection set collected_since='2026-10-05';
      insert into academy_community_articles values('article-a','a'),('article-b','b');
      insert into academy_report_publications values('article-a','a','2026-10-06','legacy_reward'),('article-b','b','2026-10-08','prospective');
      insert into academy_community_comments values('c1','article-a','b','2026-10-08'),('c2','article-a','b','2026-10-08'),('self','article-a','a','2026-10-08');
      insert into academy_report_reactions values('on','article-a','b','a','like',true,'2026-10-08'),('off','article-a','b','a','like',false,'2026-10-08'),('on-again','article-a','b','a','like',true,'2026-10-09');
      insert into academy_community_reactions values('article-a','b','like',false);`);
    const report=await readReport(request,{view:"community",period:custom},now);
    expect(value(report,"publications")).toBe(2);expect(value(report,"comments_made")).toBe(3);expect(value(report,"comments_received")).toBe(2);
    expect(value(report,"like_made")).toBe(1);expect(value(report,"like_received")).toBe(1);expect(value(report,"like_active_received")).toBe(0);
    expect(report.meta.coverage.comments.availability).toBe("partial");expect(report.meta.coverage.reactions.availability).toBe("partial");
    expect(JSON.stringify(report)).not.toMatch(/article-a|on-again|c1|content/);
    await db.exec("insert into academy_report_reactions values('deleted1','article-a',null,'a','like',true,'2026-10-08'),('deleted2','article-a',null,'a','like',true,'2026-10-09');");
    const partial=await readReport(request,{view:"community",period:{kind:"custom",startDate:"2026-10-07",endDate:"2026-10-10"}},now);
    expect(partial.meta.coverage.reactions.availability).toBe("partial");expect(partial.meta.coverage.reactions.reason).toContain("Contas excluídas");
    expect(value(partial,"like_received")).toBe(2);
  });
  it("reads prospective completions by their recorded version and never invents baseline dates",async()=>{
    await db.exec(`update academy_report_collection set collected_since='2026-10-05';
      insert into academy_report_completions values('a','course',1,'2026-10-06'),('a','course',2,'2026-10-09'),('outside','course',2,'2026-10-09');`);
    const report=await readReport(request,{view:"learning",learningMode:"activity",period:custom},now);
    expect(value(report,"period_completions")).toBe(2);expect(report.rows.map(row=>row.type==="course"?row.courseVersion:0).sort()).toEqual([1,2]);
    expect(report.rows.every(row=>row.type==="course"&&row.completedAt)).toBe(true);
    expect(report.rows.every(row=>row.metrics.every(metric=>metric.coverage.semantics==="period"))).toBe(true);
  });
  it("refuses outside-team people before all new sources and produces four overview KPIs from the detail domains",async()=>{
    for(const view of ["challenges","community","xp","overview"]) {queries.length=0;await expect(readReport(request,{view,personId:"outside"},now)).rejects.toMatchObject({status:403});expect(queries.every(query=>query.table==="academy_profiles")).toBe(true);}
    await addAttempt("overview-a","a",80,"2026-10-09T12:00:00Z");
    await db.exec("insert into academy_xp values('overview-xp','a',30,'2026','2026-10-09');");
    const report=await readReport(request,{view:"overview",period:custom},now);
    expect(report.kpis.map(metric=>metric.id)).toEqual(["people_with_access","graded_attempts","challenge_attempts","xp_period"]);
    expect(report.kpis.map(metric=>metric.value)).toEqual([2,1,0,30]);
    for(const kpi of report.kpis) expect(report.rows.reduce((sum,row)=>sum+(row.metrics.find(metric=>metric.id===kpi.id)?.value??0),0)).toBe(kpi.value);
    expect(report.series.map(series=>series.id)).toEqual(["daily_access_people","course_status"]);
  });
  it("paginates comments, XP and challenges beyond 1,000 entries",async()=>{
    await db.exec(`insert into academy_community_articles values('many-article','a');
      insert into academy_community_comments select 'comment-'||n,'many-article','b','2026-10-09' from generate_series(1,1005) n;
      insert into academy_xp select 'xp-'||n,'b',1,'2026','2026-10-09' from generate_series(1,1005) n;
      insert into academy_quizzes select 'quiz-'||n,'internal' from generate_series(1,1005) n;
      insert into academy_quiz_attempts select 'attempt-'||n,'b','quiz-'||n,50,false,'2026-10-09',null,null,1,'unavailable',null,null from generate_series(1,1005) n;`);
    const community=await readReport(request,{view:"community",period:custom},now);expect(value(community,"comments_made")).toBe(1005);expect(value(community,"comments_received")).toBe(1005);
    const xp=await readReport(request,{view:"xp",period:custom},now);expect(value(xp,"xp_period")).toBe(1005);
    const challenges=await readReport(request,{view:"challenges",period:custom},now);expect(challenges.rows).toHaveLength(1005);expect(value(challenges,"challenge_attempts")).toBe(1005);
    for(const table of ["academy_community_comments","academy_xp","academy_quiz_attempts"]) expect(queries.some(query=>query.table===table&&query.start===1000)).toBe(true);
  });
});
