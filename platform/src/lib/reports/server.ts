import { ApiError, authenticate } from "../pilot-server";
import { reportDatasetSchema, resolveReportQuery, type ReportDataset } from "./contracts";
import { REPORT_TIME_ZONE } from "./periods";
import { reportPeople, REPORT_MAX_ROWS, refineReport } from "./read.server";
import { assertReportActor } from "./scope";
import { presenceReport } from "./presence.server";
import { learningReport } from "./learning.server";
import { challengesReport } from "./challenges.server";
import { communityReport } from "./community.server";
import { xpReport } from "./xp.server";
import { overviewReport } from "./overview.server";

export const reportHeaders = { "Cache-Control": "private, no-store", Vary: "Authorization" };
export async function readReport(request: Request, input: unknown, now = new Date()): Promise<ReportDataset> {
  const { db, me } = await authenticate(request, { createMissingProfile: false });
  try { assertReportActor(me); } catch { throw new ApiError("Somente gestores internos ativos podem consultar relatórios.", 403); }
  const resolve = (value: unknown) => { try { return resolveReportQuery(value, now); } catch { throw new ApiError("Revise os filtros e o período do relatório.", 400); } };
  const parsed = resolve(input);
  const query = { ...parsed.query };
  if (query.view === "learning") {
    query.learningDetail ??= "courses";
    query.learningMode ??= query.learningDetail === "assessments" ? "activity" : "current";
    query.learningScope ??= query.learningDetail === "assessments" ? "catalog" : "assigned";
    if (query.learningDetail === "assessments") query.attemptPolicy ??= "latest";
    if (query.learningMode === "activity" && query.learningDetail === "courses" && query.status && query.status !== "completed") throw new ApiError("Atividade por curso mostra eventos de conclusão; outros estados são consultados em Situação atual.", 400);
  }
  const { period } = resolve(query);
  const people = await reportPeople(db, me, query);
  const domain = query.view === "presence" ? await presenceReport(db, people, period!) : query.view === "learning" ? await learningReport(db, people, query, period, now) :
    query.view === "challenges" ? await challengesReport(db, people, query, period!) : query.view === "community" ? await communityReport(db, people, period!) :
    query.view === "xp" ? await xpReport(db, people, period!, now) : await overviewReport(db, people, period!, now);
  if (domain.rows.length > REPORT_MAX_ROWS) refineReport();
  if (query.sort) {
    const key = query.sort.metric;
    if (!domain.rows.some(row => row.metrics.some(item => item.id === key)) && domain.rows.length) throw new ApiError("Ordenação inválida para esta visão.");
    domain.rows.sort((a, b) => {
      const av = a.metrics.find(item => item.id === key)?.value, bv = b.metrics.find(item => item.id === key)?.value;
      if (av == null || bv == null) return av == null && bv == null ? a.id.localeCompare(b.id) : av == null ? 1 : -1;
      return (av - bv) * (query.sort!.direction === "asc" ? 1 : -1) || a.id.localeCompare(b.id);
    });
  }
  const dataset = reportDatasetSchema.safeParse({ schema: 1, query, meta: { generatedAt: now.toISOString(), timeZone: REPORT_TIME_ZONE, period,
    actorId: me.id, personIds: people.map(person => person.id), departmentBasis: "current", complete: true,
    coverage: domain.coverage, ...(domain.collectedSince === undefined ? {} : { collectedSince: domain.collectedSince }) }, rows: domain.rows, kpis: domain.kpis, series: domain.series });
  if (!dataset.success) throw new ApiError("Dados do relatório incompatíveis com o contrato.", 503);
  return dataset.data;
}
