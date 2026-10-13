import { z } from "zod";
import { calendarDateSchema, reportPeriodSchema, resolveReportPeriod, REPORT_TIME_ZONE } from "./periods";

const id = z.string().trim().min(1).max(120);
const timestamp = z.iso.datetime({ offset: true });
export const reportViewSchema = z.enum(["overview", "presence", "learning", "challenges", "community", "xp"]);
export const reportQuerySchema = z.object({
  view: reportViewSchema.default("overview"),
  period: reportPeriodSchema.default({ kind: "last30" }),
  learningMode: z.enum(["current", "activity"]).optional(),
  learningDetail: z.enum(["courses", "assessments"]).optional(),
  population: z.literal("active").default("active"),
  personId: id.optional(), department: z.string().trim().min(1).max(100).optional(),
  courseId: id.optional(), challengeId: id.optional(),
  learningScope: z.enum(["assigned", "catalog"]).optional(),
  attemptPolicy: z.enum(["latest", "best", "all"]).optional(),
  status: z.enum(["not_started", "in_progress", "awaiting_assessment", "completed", "pending", "approved", "retry"]).optional(),
  sort: z.object({ metric: id, direction: z.enum(["asc", "desc"]) }).strict().optional(),
}).strict().superRefine((query, ctx) => {
  if (query.view !== "learning" && [query.learningMode, query.learningDetail, query.courseId, query.learningScope, query.attemptPolicy, query.status].some(value => value !== undefined)) {
    ctx.addIssue({ code: "custom", message: "Filtros de aprendizagem exigem a visão de aprendizagem." });
  }
  if (query.challengeId && query.view !== "challenges") ctx.addIssue({ code: "custom", path: ["challengeId"], message: "Selecione a visão de desafios." });
  const assessment = query.learningDetail === "assessments";
  if (query.attemptPolicy && !assessment) ctx.addIssue({ code: "custom", path: ["attemptPolicy"], message: "A política de tentativas exige avaliações." });
  if (query.status && assessment !== ["pending", "approved", "retry"].includes(query.status)) {
    ctx.addIssue({ code: "custom", path: ["status"], message: "Situação incompatível com a subvisão." });
  }
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;

export function resolveReportQuery(input: unknown, now = new Date()) {
  const query = reportQuerySchema.parse(input);
  const resolved = resolveReportPeriod(query.period, now);
  return { query, period: query.view === "learning" && (query.learningMode ?? "current") === "current" ? null : resolved };
}

export const metricCoverageSchema = z.object({
  availability: z.enum(["available", "partial", "unavailable"]),
  semantics: z.enum(["current", "period", "latest_known"]),
  observedFrom: timestamp.nullable(), observedUntil: timestamp.nullable(),
  reason: z.string().min(1).optional(),
}).strict().superRefine((coverage, ctx) => {
  if (coverage.availability !== "available" && !coverage.reason) ctx.addIssue({ code: "custom", path: ["reason"], message: "Informe a limitação dos dados." });
  if (coverage.observedFrom && coverage.observedUntil && Date.parse(coverage.observedFrom) > Date.parse(coverage.observedUntil)) ctx.addIssue({ code: "custom", message: "Cobertura invertida." });
});
export const reportMetricSchema = z.object({
  id, value: z.number().finite().nullable(), unit: z.enum(["count", "percent", "days", "minutes", "xp"]),
  denominator: z.number().nonnegative().nullable().optional(),
  estimated: z.boolean().default(false), coverage: metricCoverageSchema,
}).strict().superRefine((metric, ctx) => {
  if (metric.coverage.availability === "unavailable" && metric.value !== null) ctx.addIssue({ code: "custom", path: ["value"], message: "Dados indisponíveis não têm valor numérico." });
  if (metric.unit === "percent" && metric.value !== null && (metric.value < 0 || metric.value > 100 || metric.denominator === 0)) ctx.addIssue({ code: "custom", path: ["value"], message: "Percentual inválido ou sem denominador." });
});
export type ReportMetric = z.infer<typeof reportMetricSchema>;

export const assessmentDiagnosticSchema = z.object({
  attemptId: id, score: z.number().min(0).max(100).nullable(),
  questions: z.array(z.object({ questionId: id, outcome: z.enum(["correct", "incorrect", "partial", "pending", "unavailable"]) }).strict()),
  counts: z.object({ correct: z.number().int().nonnegative(), incorrect: z.number().int().nonnegative(), partial: z.number().int().nonnegative(), pending: z.number().int().nonnegative(), unavailable: z.number().int().nonnegative() }).strict(),
}).strict().superRefine((diagnostic, ctx) => {
  const actual = { correct: 0, incorrect: 0, partial: 0, pending: 0, unavailable: 0 };
  for (const question of diagnostic.questions) actual[question.outcome]++;
  if (Object.keys(actual).some(key => actual[key as keyof typeof actual] !== diagnostic.counts[key as keyof typeof actual])) ctx.addIssue({ code: "custom", path: ["counts"], message: "Contagens diferentes do diagnóstico." });
  if (new Set(diagnostic.questions.map(question => question.questionId)).size !== diagnostic.questions.length) ctx.addIssue({ code: "custom", path: ["questions"], message: "Questões duplicadas." });
});
export type AssessmentDiagnostic = z.infer<typeof assessmentDiagnosticSchema>;

const personFields = { id, userId: id, name: z.string().min(1), department: z.string(), metrics: z.array(reportMetricSchema) };
export const reportRowSchema = z.discriminatedUnion("type", [
  z.object({ ...personFields, type: z.literal("person") }).strict(),
  z.object({ ...personFields, type: z.literal("presence"), lastAccessAt: timestamp.nullable(), collectedSince: timestamp.nullable().optional() }).strict(),
  z.object({ ...personFields, type: z.literal("course"), courseId: id, courseTitle: z.string().optional(), courseVersion: z.number().int().positive(), completedAt: timestamp.optional(), status: z.enum(["not_started", "in_progress", "awaiting_assessment", "completed"]), assignments: z.array(z.object({ id, dueDate: calendarDateSchema, overdue: z.boolean() }).strict()).optional() }).strict(),
  z.object({ ...personFields, type: z.literal("assessment"), courseId: id, courseTitle: z.string().optional(), courseVersion: z.number().int().positive().optional(), activityId: id.optional(), submittedAt: timestamp.optional(), feedback: z.string().optional(), attemptId: id, status: z.enum(["pending", "approved", "retry"]), diagnostic: assessmentDiagnosticSchema.optional() }).strict(),
  z.object({ ...personFields, type: z.literal("challenge"), challengeId: id, challengeTitle: z.string().optional(), attemptId: id, completedAt: timestamp, passed: z.boolean(), revision: z.number().int().positive().nullable().optional(), scoringVersion: z.number().int().positive().optional(), reviewAvailable: z.boolean().optional(), correctCount: z.number().int().nonnegative().nullable().optional(), questionCount: z.number().int().nonnegative().nullable().optional() }).strict(),
  z.object({ ...personFields, type: z.literal("community") }).strict(),
  z.object({ ...personFields, type: z.literal("xp") }).strict(),
]);
export type ReportRow = z.infer<typeof reportRowSchema>;

export const resolvedPeriodSchema = z.object({
  startDate: calendarDateSchema, endDate: calendarDateSchema,
  startInclusive: timestamp, endExclusive: timestamp,
  calendarDays: z.number().int().min(1).max(366), timeZone: z.literal(REPORT_TIME_ZONE),
}).strict();
export const reportDatasetSchema = z.object({
  schema: z.literal(1), query: reportQuerySchema,
  meta: z.object({ generatedAt: timestamp, timeZone: z.literal(REPORT_TIME_ZONE),
    period: resolvedPeriodSchema.nullable(), actorId: id, personIds: z.array(id),
    departmentBasis: z.literal("current"), complete: z.literal(true), collectedSince: timestamp.nullable().optional(),
    coverage: z.record(z.string(), metricCoverageSchema),
  }).strict(),
  rows: z.array(reportRowSchema).max(10_000), kpis: z.array(reportMetricSchema),
  series: z.array(z.object({ id, metricId: id, points: z.array(z.object({ id, label: z.string(), userId: id.optional(), date: calendarDateSchema.optional(), value: z.number().finite().nullable() }).strict()) }).strict()),
}).strict().superRefine((dataset, ctx) => {
  const ids = dataset.rows.map(row => row.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["rows"], message: "IDs de registros duplicados." });
  const people = new Set(dataset.meta.personIds);
  if (people.size !== dataset.meta.personIds.length || people.has(dataset.meta.actorId)) ctx.addIssue({ code: "custom", path: ["meta", "personIds"], message: "População duplicada ou incluindo o próprio gestor." });
  if (dataset.query.personId && (people.size !== 1 || !people.has(dataset.query.personId))) ctx.addIssue({ code: "custom", path: ["meta", "personIds"], message: "População incompatível com o colaborador selecionado." });
  if (dataset.rows.some(row => !people.has(row.userId))) ctx.addIssue({ code: "custom", path: ["rows"], message: "Registro fora da população declarada." });
  if (dataset.series.some(series => series.points.some(point => point.userId && !people.has(point.userId)))) ctx.addIssue({ code: "custom", path: ["series"], message: "Série fora da população declarada." });
  const types: Record<ReportQuery["view"], string[]> = { overview: ["person"], presence: ["presence"], learning: ["course", "assessment"], challenges: ["challenge"], community: ["community"], xp: ["xp"] };
  if (dataset.rows.some(row => !types[dataset.query.view].includes(row.type))) ctx.addIssue({ code: "custom", path: ["rows"], message: "Registro incompatível com a visão." });
  const current = dataset.query.view === "learning" && (dataset.query.learningMode ?? "current") === "current";
  if (current !== (dataset.meta.period === null)) ctx.addIssue({ code: "custom", path: ["meta", "period"], message: "Situação atual não possui recorte temporal; demais visões exigem período." });
  try {
    const expected = resolveReportQuery(dataset.query, new Date(dataset.meta.generatedAt)).period;
    if (expected && dataset.meta.period && Object.keys(expected).some(key => expected[key as keyof typeof expected] !== dataset.meta.period![key as keyof typeof expected])) {
      ctx.addIssue({ code: "custom", path: ["meta", "period"], message: "Período incompatível com a consulta e a geração." });
    }
  } catch {
    ctx.addIssue({ code: "custom", path: ["query", "period"], message: "Período inválido na data de geração." });
  }
});
export type ReportDataset = z.infer<typeof reportDatasetSchema>;
