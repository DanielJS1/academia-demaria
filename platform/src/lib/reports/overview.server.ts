import type { ResolvedReportPeriod } from "./periods";
import { presenceReport } from "./presence.server";
import { learningReport } from "./learning.server";
import { challengesReport } from "./challenges.server";
import { xpReport } from "./xp.server";
import { metric, type ReportDB, type ReportPerson, type ReportDomain } from "./read.server";
export async function overviewReport(db: ReportDB, people: ReportPerson[], period: ResolvedReportPeriod, now: Date): Promise<ReportDomain> {
  const [presence, grades, challenges, xp, learning] = await Promise.all([
    presenceReport(db, people, period),
    learningReport(db, people, { view: "learning", population: "active", period: { kind: "custom", startDate: period.startDate, endDate: period.endDate }, learningMode: "activity", learningDetail: "assessments", learningScope: "catalog", attemptPolicy: "all" }, period, now),
    challengesReport(db, people, { view: "challenges", population: "active", period: { kind: "custom", startDate: period.startDate, endDate: period.endDate } }, period),
    xpReport(db, people, period, now),
    learningReport(db, people, { view: "learning", population: "active", period: { kind: "last30" }, learningMode: "current", learningDetail: "courses", learningScope: "assigned" }, null, now),
  ]);
  const chosen = [[presence, "people_with_access"], [grades, "graded_attempts"], [challenges, "challenge_attempts"], [xp, "xp_period"]] as const;
  return { coverage: { ...presence.coverage, ...grades.coverage, ...challenges.coverage, ...xp.coverage, ...learning.coverage },
    kpis: chosen.map(([domain, id]) => domain.kpis.find(item => item.id === id)!),
    rows: people.map(person => ({ type: "person", id: person.id, userId: person.id, name: person.name, department: person.department,
      metrics: chosen.map(([domain, id]) => {
        const source = domain.rows.filter(row => row.userId === person.id);
        const coverage = domain.kpis.find(item => item.id === id)!.coverage;
        const value = id === "people_with_access" ? source[0]?.metrics.find(item => item.id === "access_days")?.value :
          id === "graded_attempts" ? source.filter(row => row.type === "assessment" && row.diagnostic?.score !== null).length :
          id === "challenge_attempts" ? source.length : source[0]?.metrics.find(item => item.id === "xp_period")?.value;
        return metric(id, coverage.availability === "unavailable" ? null : id === "people_with_access" ? value == null ? null : value > 0 ? 1 : 0 : value ?? 0, id === "xp_period" ? "xp" : "count", coverage);
      }) })), series: [...presence.series.filter(series => series.id === "daily_access_people"), ...learning.series],
  };
}
