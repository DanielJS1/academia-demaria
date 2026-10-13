import { z } from "zod";
import { ApiError } from "../api-error";
import { isInReportPeriod, REPORT_TIME_ZONE, type ResolvedReportPeriod } from "./periods";
import { chunks, readPages, metric, refineReport, REPORT_MAX_RECORDS, type ReportDB, type ReportPerson, type ReportDomain, type Coverage } from "./read.server";
export async function xpReport(db: ReportDB, people: ReportPerson[], period: ResolvedReportPeriod, now: Date): Promise<ReportDomain> {
  const rows = [];
  for (const ids of chunks(people.map(person => person.id))) {
    rows.push(...await readPages((start, end) => db.from("academy_xp").select("id,user_id,amount,season,created_at").in("user_id", ids).lte("created_at", now.toISOString()).order("id").range(start, end)));
    if (rows.length > REPORT_MAX_RECORDS) refineReport();
  }
  const parsed = z.array(z.object({ id: z.string(), user_id: z.string(), amount: z.number().finite(), season: z.string(), created_at: z.iso.datetime({ offset: true }) })).safeParse(rows);
  if (!parsed.success) throw new ApiError("Ledger de XP inválido.", 503);
  const season = new Intl.DateTimeFormat("en-CA", { timeZone: REPORT_TIME_ZONE, year: "numeric" }).format(now);
  const coverage = (semantics: Coverage["semantics"]): Coverage => ({ availability: "partial", semantics, observedFrom: parsed.data.map(row => row.created_at).sort()[0] ?? null, observedUntil: semantics === "period" ? period.endExclusive : now.toISOString(), reason: "Soma do ledger disponível com seus valores atuais, incluindo estornos. Importações e histórico anterior não são certificados; created_at é a data registrada no ledger." });
  const byUser = new Map<string, typeof parsed.data>();
  for (const row of parsed.data) { const entries = byUser.get(row.user_id) ?? []; entries.push(row); byUser.set(row.user_id, entries); }
  const totals = people.map(person => { const entries = byUser.get(person.id) ?? []; return { person, period: entries.filter(row => isInReportPeriod(row.created_at, period)).reduce((sum, row) => sum + row.amount, 0), season: entries.filter(row => row.season === season).reduce((sum, row) => sum + row.amount, 0), history: entries.reduce((sum, row) => sum + row.amount, 0) }; });
  const periodCoverage = coverage("period"), current = coverage("current");
  // Earliest ledger entry can be after a historical range; it is not collection start.
  if (periodCoverage.observedFrom && Date.parse(periodCoverage.observedFrom) > Date.parse(period.endExclusive)) periodCoverage.observedFrom = null;
  return { coverage: { xpPeriod: periodCoverage, xpSeason: current, xpHistory: current },
    rows: totals.map(row => ({ type: "xp", id: row.person.id, userId: row.person.id, name: row.person.name, department: row.person.department,
      metrics: [metric("xp_period", row.period, "xp", periodCoverage), metric("xp_season", row.season, "xp", current), metric("xp_history", row.history, "xp", current)] })),
    kpis: [metric("xp_period", totals.reduce((sum, row) => sum + row.period, 0), "xp", periodCoverage), metric("xp_season", totals.reduce((sum, row) => sum + row.season, 0), "xp", current), metric("xp_history", totals.reduce((sum, row) => sum + row.history, 0), "xp", current)],
    series: [{ id: "person_xp", metricId: "xp_period", points: totals.map(row => ({ id: row.person.id, userId: row.person.id, label: row.person.name, value: row.period })) }],
  };
}
