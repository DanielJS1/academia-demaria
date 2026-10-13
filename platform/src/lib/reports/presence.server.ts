import { z } from "zod";
import { ApiError } from "../api-error";
import { calendarDateSchema, addCalendarDays, observableCalendarDays, reportDay, type ResolvedReportPeriod } from "./periods";
import { percentage } from "./metrics";
import { chunks, readPages, metric, unavailable, refineReport, REPORT_MAX_RECORDS, type ReportDB, type ReportPerson, type Coverage, type ReportDomain } from "./read.server";

const dailySchema = z.object({ user_id: z.string(), day: calendarDateSchema, active_seconds: z.number().int().min(0).max(86400) });
const presenceSchema = z.object({ user_id: z.string(), last_access_at: z.iso.datetime({ offset: true }) });
export async function presenceReport(db: ReportDB, people: ReportPerson[], period: ResolvedReportPeriod): Promise<ReportDomain> {
  const config = await db.from("academy_engagement_config").select("collected_since").eq("id", true).maybeSingle();
  if (config.error) throw new ApiError("Coleta de presença indisponível.", 503);
  const collectedSince = z.iso.datetime({ offset: true }).nullable().safeParse(config.data?.collected_since ?? null);
  if (!collectedSince.success) throw new ApiError("Configuração de coleta inválida.", 503);
  const batches = [];
  let recordCount = 0;
  for (const ids of chunks(people.map(person => person.id))) {
    const batch = await Promise.all([
    readPages((start, end) => db.from("academy_engagement_daily").select("user_id,day,active_seconds").in("user_id", ids).gte("day", period.startDate).lte("day", period.endDate).order("user_id").order("day").range(start, end)),
    readPages((start, end) => db.from("academy_presence").select("user_id,last_access_at").in("user_id", ids).order("user_id").range(start, end)),
    ]);
    recordCount += batch[0].length + batch[1].length;
    if (recordCount > REPORT_MAX_RECORDS) refineReport();
    batches.push(batch);
  }
  const daily = z.array(dailySchema).safeParse(batches.flatMap(batch => batch[0]));
  const presence = z.array(presenceSchema).safeParse(batches.flatMap(batch => batch[1]));
  if (!daily.success || !presence.success) throw new ApiError("Registros de presença inválidos.", 503);
  const lastAccess = new Map(presence.data.map(row => [row.user_id, row.last_access_at]));
  const dailyByUser = new Map<string, z.infer<typeof dailySchema>[]>();
  for (const record of daily.data) {
    const records = dailyByUser.get(record.user_id) ?? []; records.push(record); dailyByUser.set(record.user_id, records);
  }
  const members = people.map(person => {
    const observable = observableCalendarDays(period, collectedSince.data, person.created_at);
    const first = collectedSince.data && person.created_at ? [period.startDate, reportDay(new Date(collectedSince.data)), reportDay(new Date(person.created_at))].sort().at(-1)! : null;
    const records = (dailyByUser.get(person.id) ?? []).filter(row => !first || row.day >= first);
    const coverage: Coverage = observable === null || observable === 0 ? unavailable("period", observable === 0 ? "Período anterior à coleta ou à criação do perfil." : "Início da coleta ou criação do perfil indisponível.") : {
      availability: observable < period.calendarDays ? "partial" : "available", semantics: "period",
      observedFrom: new Date(Math.max(Date.parse(period.startInclusive), Date.parse(collectedSince.data!), Date.parse(person.created_at!))).toISOString(), observedUntil: period.endExclusive,
      reason: observable < period.calendarDays ? "Coleta parcial; dias anteriores não são faltas. Criação do perfil não comprova a data de aprovação." : "Dias corridos desde a coleta/criação; criação do perfil não comprova aprovação. O dia corrente pode estar em andamento.",
    };
    return { person, observable, first, coverage, records, days: records.length, minutes: records.reduce((sum, row) => sum + row.active_seconds, 0) / 60 };
  });
  const observed = members.filter(member => member.coverage.availability !== "unavailable");
  const coverage: Coverage = !observed.length ? unavailable("period", "Sem dias observáveis para a população selecionada.") : {
    availability: observed.length < people.length || observed.some(member => member.coverage.availability === "partial") ? "partial" : "available", semantics: "period",
    observedFrom: observed.map(member => member.coverage.observedFrom!).sort()[0], observedUntil: period.endExclusive,
    reason: "Frequência consolidada = dias com acesso / dias-pessoa observáveis; datas anteriores à coleta não são faltas. Tempo ativo é estimado e o dia corrente pode estar incompleto.",
  };
  const totalDays = observed.reduce((sum, member) => sum + member.days, 0), totalObservable = observed.reduce((sum, member) => sum + member.observable!, 0);
  const dates = Array.from({ length: period.calendarDays }, (_, index) => addCalendarDays(period.startDate, index));
  return {
    collectedSince: collectedSince.data,
    coverage: { presence: coverage, lastAccessAt: { availability: "available", semantics: "latest_known", observedFrom: collectedSince.data, observedUntil: null, reason: "Último registro conhecido, independente do período; sem registro não comprova ausência de acesso." } },
    rows: members.map(member => ({ type: "presence", id: member.person.id, userId: member.person.id, name: member.person.name, department: member.person.department,
      lastAccessAt: lastAccess.get(member.person.id) ?? null, collectedSince: collectedSince.data,
      metrics: [metric("access_days", member.coverage.availability === "unavailable" ? null : member.days, "days", member.coverage),
        metric("active_minutes", member.coverage.availability === "unavailable" ? null : member.minutes, "minutes", member.coverage, undefined, true),
        metric("observable_days", member.observable === 0 ? null : member.observable, "days", member.coverage),
        metric("access_frequency", member.coverage.availability === "unavailable" ? null : percentage(member.days, member.observable), "percent", member.coverage, member.observable)] })),
    kpis: [metric("people_with_access", observed.length ? observed.filter(member => member.days > 0).length : null, "count", coverage),
      metric("access_days", observed.length ? totalDays : null, "days", coverage),
      metric("active_minutes", observed.length ? observed.reduce((sum, member) => sum + member.minutes, 0) : null, "minutes", coverage, undefined, true),
      metric("access_frequency", observed.length ? percentage(totalDays, totalObservable) : null, "percent", coverage, totalObservable)],
    series: ["access_people", "active_minutes"].map(id => ({ id: `daily_${id}`, metricId: id === "access_people" ? "people_with_access" : id, points: dates.map(date => {
      const eligible = observed.filter(member => member.first! <= date);
      const records = eligible.flatMap(member => member.records.filter(record => record.day === date));
      return { id: date, label: date, date, value: !eligible.length ? null : id === "access_people" ? records.length : records.reduce((sum, record) => sum + record.active_seconds, 0) / 60 };
    }) })),
  };
}
