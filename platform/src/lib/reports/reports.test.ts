import { describe, expect, it } from "vitest";
import { initialState } from "../seed";
import type { Attempt, Course } from "../model";
import { assertManagedPerson, assertReportActor, scopeProfile, selectManagedPeople, type ScopeActor, type ScopePerson } from "./scope";
import { assessmentDiagnosticSchema, reportDatasetSchema, reportMetricSchema, resolveReportQuery } from "./contracts";
import { assessmentDiagnostic } from "./diagnostics.server";
import { assessmentAverages, assignedCompletion, assignedCoursePairs, courseLearningMetrics, learningRecordsFromAcademy, percentage, selectGradedAttempts } from "./metrics";
import { isInReportPeriod, observableCalendarDays, resolveReportPeriod } from "./periods";

const now = new Date("2026-10-12T02:59:59Z"); // Still October 11 in Brasília.
const actor: ScopeActor = { id: "manager", role: "manager", status: "active", audience: "internal", department: " Suporte " };
const person = (id: string, overrides: Partial<ScopePerson> = {}): ScopePerson => ({ id, department: "suporte", managerId: null, audience: "internal", status: "active", ...overrides });
const course: Course = { ...initialState.courses[0], id: "course", version: 2, audience: "internal", status: "published", availability: "active", lessons: [
  { id: "reading", title: "Leitura", type: "reading", module: "M", minutes: 5, content: "Texto", videoUrl: "" },
  { id: "quiz", title: "Prova", type: "quiz", module: "M", minutes: 0, content: "", videoUrl: "" },
] };
const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({
  id: "attempt", userId: "learner", courseId: "course", courseTitle: "Curso", courseVersion: 2, quizId: "quiz",
  questions: [], answers: {}, status: "approved", feedback: "", score: 80, passingScore: 70, xp: 30,
  submittedAt: "2026-10-10T12:00:00Z", retryPolicy: "free", retryAllowed: false, correctTextIds: [], partialTextIds: [], ...overrides,
});

describe("authorized team scope", () => {
  it("excludes another manager's report, self, clients and inactive; separates pending", () => {
    const people = [person("manager"), person("direct", { managerId: actor.id, department: "Financeiro" }), person("same"),
      person("other", { managerId: "another" }), person("pending", { status: "pending" }),
      person("inactive", { status: "inactive" }), person("client", { audience: "client" })];
    expect(selectManagedPeople(people, actor).map(p => p.id)).toEqual(["direct", "same"]);
    expect(selectManagedPeople(people, actor, "pending").map(p => p.id)).toEqual(["pending"]);
    expect(selectManagedPeople(people, actor, "operational").map(p => p.id)).toEqual(["direct", "same", "pending"]);
    expect(() => assertManagedPerson(actor, people[3])).toThrow();
  });
  it("fails closed for students, clients and inactive actors", () => {
    for (const forbidden of [{ ...actor, role: "student" as const }, { ...actor, audience: "client" as const }, { ...actor, status: "inactive" as const }]) {
      expect(() => assertReportActor(forbidden)).toThrow();
      expect(() => selectManagedPeople([person("p")], forbidden)).toThrow();
    }
  });
  it("admin sees the active internal population, without inheriting manager restrictions", () => {
    expect(selectManagedPeople([person("foreign", { department: "Outro", managerId: "other" }), person("p", { status: "pending" })], { ...actor, role: "admin" }).map(p => p.id)).toEqual(["foreign"]);
  });
  it("trims and ignores case, but does not erase accents or infer indirect reports", () => {
    expect(selectManagedPeople([person("p", { department: "COMERCIAL" })], { ...actor, department: " Comercial " })).toHaveLength(1);
    expect(selectManagedPeople([person("p", { department: "Operacoes" })], { ...actor, department: "Operações" })).toHaveLength(0);
    expect(selectManagedPeople([person("p", { department: " " })], { ...actor, department: " " })).toHaveLength(0);
    expect(scopeProfile({ manager_id: "manager" }).managerId).toBe("manager");
  });
});

describe("calendar periods and observation", () => {
  it("includes today in Brasília and uses an exclusive next-day boundary", () => {
    const period = resolveReportPeriod({ kind: "last7" }, now);
    expect(period).toMatchObject({ startDate: "2026-10-05", endDate: "2026-10-11", calendarDays: 7,
      startInclusive: "2026-10-05T03:00:00.000Z", endExclusive: "2026-10-12T03:00:00.000Z" });
    expect(isInReportPeriod(period.startInclusive, period)).toBe(true);
    expect(isInReportPeriod(period.endExclusive, period)).toBe(false);
    expect(isInReportPeriod("invalid", period)).toBe(false);
    expect(resolveReportPeriod({ kind: "last30" }, now).calendarDays).toBe(30);
  });
  it("rejects impossible, reversed, future and oversized intervals; accepts leap-day and 366 days", () => {
    for (const [startDate, endDate] of [["2026-02-30", "2026-03-01"], ["2026-10-11", "2026-10-10"], ["2026-10-10", "2026-10-12"], ["2025-10-09", "2026-10-11"]]) {
      expect(() => resolveReportPeriod({ kind: "custom", startDate, endDate }, now)).toThrow();
    }
    expect(resolveReportPeriod({ kind: "custom", startDate: "2024-02-29", endDate: "2024-02-29" }, now).calendarDays).toBe(1);
    expect(resolveReportPeriod({ kind: "custom", startDate: "2025-10-11", endDate: "2026-10-11" }, now).calendarDays).toBe(366);
  });
  it("does not count pre-collection days or invent coverage when profile dates are unknown", () => {
    const period = resolveReportPeriod({ kind: "last7" }, now);
    expect(observableCalendarDays(period, "2026-10-07T12:00:00Z", "2026-10-09T12:00:00Z")).toBe(3);
    expect(observableCalendarDays(period, null, "2026-10-09T12:00:00Z")).toBeNull();
    expect(observableCalendarDays(period, "2026-10-12T12:00:00Z", "2026-10-09T12:00:00Z")).toBe(0);
  });
  it("resolves historical daylight saving without assuming every local day has 24 hours", () => {
    const period = resolveReportPeriod({ kind: "custom", startDate: "2018-11-04", endDate: "2018-11-04" }, now);
    expect(period.startInclusive).toBe("2018-11-04T03:00:00.000Z");
    expect(period.endExclusive).toBe("2018-11-05T02:00:00.000Z");
    expect(period.calendarDays).toBe(1);
  });
});

describe("learning semantics", () => {
  it("does not use the manager's progress for a learner or call pending assessment completed", () => {
    const records = learningRecordsFromAcademy({ completed: { course: ["reading"] }, teamProgress: { learner: { course: [] } }, attempts: [] }, "manager");
    expect(courseLearningMetrics(course, "learner", records)).toMatchObject({ progress: 0, complete: false });
    records.completedByUser.learner.course = ["reading", "reading", "unknown"];
    expect(courseLearningMetrics(course, "learner", records)).toMatchObject({ progress: 100, complete: false, status: "awaiting_assessment", completedLessons: 1 });
    expect(courseLearningMetrics(course, "learner", { ...records, attempts: [attempt()] }).complete).toBe(true);
    expect(courseLearningMetrics(course, "learner", { ...records, attempts: [attempt({ userId: "manager" })] }).complete).toBe(false);
    expect(courseLearningMetrics(course, "learner", { ...records, attempts: [attempt({ courseVersion: 1 })] }).complete).toBe(false);
  });
  it("preserves proficiency and courses without evaluations; no lesson denominator yields null", () => {
    const records = { completedByUser: { learner: { course: ["reading"] } }, attempts: [attempt({ quizId: "proficiency" })] };
    expect(courseLearningMetrics(course, "learner", records).complete).toBe(true);
    expect(courseLearningMetrics({ ...course, lessons: course.lessons.slice(0, 1) }, "learner", { ...records, attempts: [] }).complete).toBe(true);
    expect(courseLearningMetrics({ ...course, lessons: [] }, "learner", records)).toMatchObject({ progress: null, complete: false });
    expect(percentage(0, 0)).toBeNull();
    expect(percentage(0, null)).toBeNull();
    expect(percentage(0, 5)).toBe(0);
  });
  it("deduplicates attributed pairs and excludes unauthorized, inactive and client-only courses", () => {
    const assignments = [{ userId: "learner", active: true, courseIds: ["course", "course", "private"] },
      { userId: "learner", active: true, courseIds: ["course"] }, { userId: "other", active: true, courseIds: ["course"] },
      { userId: "learner", active: false, courseIds: ["different"] }];
    const courses = [course, { ...course, id: "private", audience: "client" as const }, { ...course, id: "different" }];
    const authorized = new Set(["learner"]);
    expect(assignedCoursePairs(assignments, courses, authorized)).toHaveLength(1);
    expect(assignedCompletion(assignments, courses, authorized, { completedByUser: { learner: { course: ["reading"] } }, attempts: [attempt()] })).toEqual({ total: 1, completed: 1, percent: 100 });
    expect(assignedCompletion([], courses, authorized, { completedByUser: {}, attempts: [] })).toEqual({ total: 0, completed: 0, percent: null });
  });
});

describe("assessment averages", () => {
  const attempts = [attempt({ id: "old", score: 100, submittedAt: "2026-10-06T12:00:00Z" }),
    attempt({ id: "latest", score: 40 }), attempt({ id: "b", userId: "b", score: 80 }),
    attempt({ id: "pending", status: "pending", score: null })];
  it("selects last graded attempt per activity/version and does not overweight retries", () => {
    expect(selectGradedAttempts(attempts).map(a => a.id).sort()).toEqual(["b", "latest"]);
    expect(assessmentAverages(attempts)).toMatchObject({ average: 60, peopleWithGrades: 2, gradedAttempts: 2 });
    expect(assessmentAverages(attempts, "best").average).toBe(90);
    expect(assessmentAverages(attempts, "all").average).toBe(75); // mean((100+40)/2, 80)
  });
  it("filters before selecting, separates versions and retains real zero grades", () => {
    const period = resolveReportPeriod({ kind: "custom", startDate: "2026-10-10", endDate: "2026-10-10" }, now);
    expect(assessmentAverages(attempts, "best", period).average).toBe(60);
    expect(selectGradedAttempts([attempt(), attempt({ id: "v1", courseVersion: 1 })])).toHaveLength(2);
    expect(assessmentAverages([attempt({ score: 0 })]).average).toBe(0);
    expect(assessmentAverages([attempt({ score: null })]).average).toBeNull();
  });
});

describe("sanitized persisted-snapshot diagnostic", () => {
  const data = attempt({ questions: [
    { id: "multi", type: "choice", prompt: "Escolha", options: ["A", "B"], multiple: true, correct: '["A","B"]' },
    { id: "text", type: "text", prompt: "Explique", options: [], correct: "" },
    { id: "wrong", type: "choice", prompt: "Escolha", options: ["A", "B"], correct: "A" },
  ], answers: { multi: '["B","A"]', text: "Texto privado", wrong: "B" }, partialTextIds: ["text"] });
  it("uses domain multiple-choice comparison and preserves partial credit and official score", () => {
    const result = assessmentDiagnostic(data);
    expect(result.counts).toEqual({ correct: 1, partial: 1, incorrect: 1, pending: 0, unavailable: 0 });
    expect(result.score).toBe(80);
    expect(JSON.stringify(result)).not.toContain("Texto privado");
    expect(JSON.stringify(result)).not.toContain('"correct":[');
    expect(result.questions[0]).toEqual({ questionId: "multi", outcome: "correct" });
  });
  it("never treats pending evaluation or redacted/unknown grading as wrong answers", () => {
    expect(assessmentDiagnostic({ ...data, status: "pending", score: null }).counts.pending).toBe(3);
    expect(assessmentDiagnostic({ ...data, questions: [{ ...data.questions[0], correct: "" }] }).counts.unavailable).toBe(1);
    expect(assessmentDiagnostic({ ...data, questions: [data.questions[1]], correctTextIds: undefined, partialTextIds: undefined }).counts.unavailable).toBe(1);
  });
  it("rejects gabarito payloads and inconsistent counts in the response contract", () => {
    const result = assessmentDiagnostic(data);
    expect(assessmentDiagnosticSchema.safeParse({ ...result, correctAnswer: "A" }).success).toBe(false);
    expect(assessmentDiagnosticSchema.safeParse({ ...result, counts: { ...result.counts, correct: 9 } }).success).toBe(false);
  });
});

describe("report contracts", () => {
  it("resolves defaults and explicitly removes the temporal cut for current learning", () => {
    expect(resolveReportQuery({}, now).query).toMatchObject({ view: "overview", population: "active", period: { kind: "last30" } });
    expect(resolveReportQuery({ view: "learning" }, now).period).toBeNull();
    expect(resolveReportQuery({ view: "learning", learningMode: "activity" }, now).period).not.toBeNull();
    expect(() => resolveReportQuery({ view: "xp", courseId: "course" }, now)).toThrow();
    expect(() => resolveReportQuery({ view: "presence", population: "pending" }, now)).toThrow();
    expect(() => resolveReportQuery({ view: "presence", unknown: true }, now)).toThrow();
  });
  it("does not allow unknown coverage to be serialized as zero", () => {
    const metric = { id: "frequency", unit: "percent", value: null, denominator: 0,
      coverage: { availability: "unavailable", semantics: "period", observedFrom: null, observedUntil: null, reason: "Sem histórico" } };
    expect(reportMetricSchema.safeParse(metric).success).toBe(true);
    expect(reportMetricSchema.safeParse({ ...metric, value: 0 }).success).toBe(false);
    expect(reportMetricSchema.safeParse({ ...metric, value: 0, coverage: { ...metric.coverage, availability: "available" } }).success).toBe(false);
  });
  it("validates row IDs, population, view and current-versus-period metadata", () => {
    const { query, period } = resolveReportQuery({ view: "presence" }, now);
    const row = { id: "p", userId: "learner", name: "Learner", department: "Suporte", metrics: [], type: "presence", lastAccessAt: null };
    const dataset = { schema: 1, query, meta: { generatedAt: now.toISOString(), timeZone: "America/Sao_Paulo", period, actorId: "manager", personIds: ["learner"], departmentBasis: "current", complete: true, coverage: {} }, rows: [row], kpis: [], series: [] };
    expect(reportDatasetSchema.safeParse(dataset).success).toBe(true);
    expect(reportDatasetSchema.safeParse({ ...dataset, rows: [row, row] }).success).toBe(false);
    expect(reportDatasetSchema.safeParse({ ...dataset, rows: [{ ...row, userId: "other" }] }).success).toBe(false);
    expect(reportDatasetSchema.safeParse({ ...dataset, meta: { ...dataset.meta, period: null } }).success).toBe(false);
    expect(reportDatasetSchema.safeParse({ ...dataset, query: { view: "xp" } }).success).toBe(false);
    expect(reportDatasetSchema.safeParse({ ...dataset, query: { ...query, personId: "other" } }).success).toBe(false);
    expect(reportDatasetSchema.safeParse({ ...dataset, meta: { ...dataset.meta, period: { ...period, endDate: "2026-10-10" } } }).success).toBe(false);
    expect(reportDatasetSchema.safeParse({ ...dataset, series: [{ id: "s", metricId: "days", points: [{ id: "point", label: "Other", userId: "other", value: 1 }] }] }).success).toBe(false);
  });
});
