import { z } from "zod";
import { ApiError } from "../api-error";
import type { ResolvedReportPeriod } from "./periods";
import { chunks, readPages, unavailable, REPORT_MAX_RECORDS, refineReport, type ReportDB, type Coverage } from "./read.server";

export async function reportCollectedSince(db: ReportDB): Promise<string> {
  const result = await db.from("academy_report_collection").select("collected_since").eq("id", true).maybeSingle();
  const parsed = z.iso.datetime({ offset: true }).safeParse(result.data?.collected_since);
  if (result.error || !parsed.success) throw new ApiError("Histórico analítico indisponível. Aplique a migração report_temporal_events em ambiente autorizado.", 503);
  return parsed.data;
}
export function historicalCoverage(period: ResolvedReportPeriod, since: string, legacy = false): Coverage {
  if (Date.parse(period.endExclusive) <= Date.parse(since)) return legacy ? { availability: "partial", semantics: "period", observedFrom: null, observedUntil: period.endExclusive, reason: "Legado parcial: somente registros comprovados. Nenhuma retroatividade foi criada." } : unavailable("period", "Período anterior à coleta prospectiva. Baseline não comprova data de evento.");
  return { availability: Date.parse(period.startInclusive) < Date.parse(since) ? "partial" : "available", semantics: "period",
    observedFrom: new Date(Math.max(Date.parse(period.startInclusive), Date.parse(since))).toISOString(), observedUntil: period.endExclusive,
    ...(Date.parse(period.startInclusive) < Date.parse(since) ? { reason: "Coleta prospectiva parcial; registros anteriores não são considerados ausências." } : {}) };
}
export async function completionHistory(db: ReportDB, ids: string[], period: ResolvedReportPeriod) {
  const since = await reportCollectedSince(db), coverage = historicalCoverage(period, since);
  const rows = [];
  if (coverage.availability !== "unavailable") for (const batch of chunks(ids)) {
    rows.push(...await readPages((start, end) => db.from("academy_report_completions").select("user_id,course_id,version,completed_at").in("user_id", batch).gte("completed_at", period.startInclusive).lt("completed_at", period.endExclusive).order("user_id").order("course_id").order("version").range(start, end)));
    if (rows.length > REPORT_MAX_RECORDS) refineReport();
  }
  const parsed = z.array(z.object({ user_id: z.string(), course_id: z.string(), version: z.number().int().positive(), completed_at: z.iso.datetime({ offset: true }) })).safeParse(rows);
  if (!parsed.success) throw new ApiError("Eventos de conclusão inválidos.", 503);
  return { rows: parsed.data, coverage, since };
}
