import type { Person } from "./model";
import type { ReportRow } from "./reports/contracts";
import { readReportLocation } from "./reports/navigation";
import { metricValue } from "./reports/presentation";
import { daysUntil, localDay, type AlertPolicy, type Assignment } from "./trails";
export type ManagementAction = "pdi" | "conquista" | "trilhas";
export type ManagementSignal = { overdue: boolean | null; contact: boolean | null; lastAccessAt: string | null; reason: string };
export function managementSignal(person: Person, assignments: Assignment[] | undefined, policy: AlertPolicy | undefined, presence?: ReportRow, frequency?: ReportRow, today = localDay()): ManagementSignal {
  const lastAccessAt = presence?.type === "presence" ? presence.lastAccessAt : null;
  const overdue = assignments ? assignments.some(a => a.userId === person.id && a.active && !a.complete && daysUntil(a.dueDate, today) < 0) : null;
  if (!policy) return { overdue, contact: null, lastAccessAt, reason: "Política de acompanhamento indisponível" };
  const sufficient = (row: ReportRow | undefined, days: number) => !!row && row.metrics.find(m => m.id === "access_days")?.coverage.availability !== "unavailable" && metricValue(row, "access_days") !== null && (metricValue(row, "observable_days") ?? 0) >= days;
  const inactiveKnown = !policy.inactivityEnabled || (sufficient(presence, policy.inactivityDays + 1) && !!lastAccessAt);
  const frequencyKnown = !policy.lowAccessEnabled || (sufficient(frequency, policy.lowAccessWindow) && sufficient(presence, policy.lowAccessWindow + 1));
  const inactive = policy.inactivityEnabled && inactiveKnown && !!lastAccessAt && daysUntil(today, localDay(new Date(lastAccessAt))) >= policy.inactivityDays;
  const low = policy.lowAccessEnabled && frequencyKnown && (metricValue(frequency!, "access_days") ?? Infinity) < policy.lowAccessMinDays;
  const contact = inactive || low ? true : inactiveKnown && frequencyKnown ? false : null;
  return { overdue, contact, lastAccessAt, reason: inactive ? "Inatividade conforme a política da equipe" : low ? "Frequência abaixo da política da equipe" : contact === null ? "Histórico insuficiente para avaliar contato" : "Sem alerta de contato confirmado" };
}
export function managementAction(value: string | null): ManagementAction {
  if (value === null) return "pdi";
  if (!["pdi", "conquista", "trilhas"].includes(value)) throw new Error("Ação de gestão inválida.");
  return value as ManagementAction;
}
export function managementReportLink(personId: string, back?: string | null) {
  if (back) try {
    const url = new URL(back, "https://academy.local");
    if (back.startsWith("/equipe/relatorios?") && url.origin === "https://academy.local" && url.pathname === "/equipe/relatorios") {
      const location = readReportLocation(url.searchParams);
      if (location.query.personId === personId) return url.pathname + url.search;
    }
  } catch { /* A malformed return URL never becomes navigation outside the application. */ }
  return `/equipe/relatorios?visao=geral&periodo=30&pessoa=${encodeURIComponent(personId)}&formato=barras`;
}
