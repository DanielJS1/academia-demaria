"use client";
import type { Person } from "@/lib/model";
import type { ReportQuery } from "@/lib/reports/contracts";
import { addCalendarDays, reportDay } from "@/lib/reports/periods";
import { managementSignal } from "@/lib/management";
import { useAcademy } from "../academy-provider";
import { useTrails } from "../trails/trails-provider";
import { useReportData } from "../reports/use-report-data";
export function useManagementSignals(people: Person[], enabled: boolean) {
  const { me } = useAcademy(); const trails = useTrails();
  const policy = trails.data?.policy;
  const days = Math.max(30, policy?.inactivityEnabled ? policy.inactivityDays + 1 : 0, policy?.lowAccessEnabled ? policy.lowAccessWindow + 1 : 0);
  const today = reportDay();
  const query = (window: number): ReportQuery => ({ view: "presence", population: "active", period: { kind: "custom", startDate: addCalendarDays(today, 1 - window), endDate: today } });
  const scope = JSON.stringify([me.id, me.role, me.department, me.audience, people.map(person => [person.id, person.status, person.managerId, person.department])]);
  const presence = useReportData(query(days), me.id, scope, enabled);
  const frequency = useReportData(query(policy?.lowAccessWindow ?? 30), me.id, scope, enabled && !!policy?.lowAccessEnabled);
  const members = new Map(presence.data?.rows.map(row => [row.userId, row]));
  const frequencies = new Map(frequency.data?.rows.map(row => [row.userId, row]));
  const assignments = new Map<string, NonNullable<typeof trails.data>["assignments"]>();
  for (const assignment of trails.data?.assignments ?? []) { const list = assignments.get(assignment.userId) ?? []; list.push(assignment); assignments.set(assignment.userId, list); }
  return { signals: new Map(people.filter(person => person.status === "active").map(person => [person.id, managementSignal(person, trails.data ? assignments.get(person.id) ?? [] : undefined, policy, members.get(person.id), frequencies.get(person.id), today)])),
    loading: presence.loading || trails.loading || frequency.loading, error: presence.error || trails.error || frequency.error,
    retry: () => { presence.retry(); frequency.retry(); void trails.refresh(); }, trails };
}
