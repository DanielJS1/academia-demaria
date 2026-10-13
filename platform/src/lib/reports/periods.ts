import { z } from "zod";

export const REPORT_TIME_ZONE = "America/Sao_Paulo" as const;
const DAY_MS = 86_400_000;

export const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Data de calendário inválida.");

export const reportPeriodSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("last7") }).strict(),
  z.object({ kind: z.literal("last30") }).strict(),
  z.object({ kind: z.literal("custom"), startDate: calendarDateSchema, endDate: calendarDateSchema }).strict(),
]).superRefine((period, ctx) => {
  if (period.kind !== "custom") return;
  const days = (Date.parse(`${period.endDate}T12:00:00Z`) - Date.parse(`${period.startDate}T12:00:00Z`)) / DAY_MS + 1;
  if (days < 1 || days > 366) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Selecione um intervalo de 1 a 366 dias." });
});
export type ReportPeriod = z.infer<typeof reportPeriodSchema>;
export type ResolvedReportPeriod = {
  startDate: string; endDate: string; startInclusive: string; endExclusive: string;
  calendarDays: number; timeZone: typeof REPORT_TIME_ZONE;
};

export function reportDay(now = new Date()): string {
  if (!Number.isFinite(now.getTime())) throw new Error("Instante inválido.");
  return new Intl.DateTimeFormat("en-CA", { timeZone: REPORT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addCalendarDays(day: string, amount: number): string {
  calendarDateSchema.parse(day);
  if (!Number.isInteger(amount)) throw new Error("Quantidade de dias inválida.");
  return new Date(Date.parse(`${day}T12:00:00Z`) + amount * DAY_MS).toISOString().slice(0, 10);
}

function midnight(day: string): string {
  // First instant of the local calendar day, including historical DST midnight gaps.
  const wanted = Date.parse(`${day}T00:00:00Z`);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  });
  let low = wanted - DAY_MS, high = wanted + DAY_MS;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (formatter.format(new Date(middle)) < day) low = middle + 1;
    else high = middle;
  }
  return new Date(low).toISOString();
}

export function resolveReportPeriod(input: ReportPeriod, now = new Date()): ResolvedReportPeriod {
  const period = reportPeriodSchema.parse(input);
  const today = reportDay(now);
  const endDate = period.kind === "custom" ? period.endDate : today;
  const startDate = period.kind === "custom" ? period.startDate : addCalendarDays(today, period.kind === "last7" ? -6 : -29);
  const calendarDays = Math.round((Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / DAY_MS) + 1;
  if (calendarDays < 1 || calendarDays > 366) throw new Error("Selecione um intervalo de 1 a 366 dias.");
  if (endDate > today) throw new Error("O período não pode incluir datas futuras.");
  return { startDate, endDate, calendarDays, timeZone: REPORT_TIME_ZONE, startInclusive: midnight(startDate), endExclusive: midnight(addCalendarDays(endDate, 1)) };
}

export function isInReportPeriod(timestamp: string, period: ResolvedReportPeriod): boolean {
  const stamp = Date.parse(timestamp);
  return Number.isFinite(stamp) && stamp >= Date.parse(period.startInclusive) && stamp < Date.parse(period.endExclusive);
}

export function observableCalendarDays(period: ResolvedReportPeriod, collectedSince: string | null, profileCreatedAt: string | null): number | null {
  if (!collectedSince || !profileCreatedAt || !Number.isFinite(Date.parse(collectedSince)) || !Number.isFinite(Date.parse(profileCreatedAt))) return null;
  const start = [period.startDate, reportDay(new Date(collectedSince)), reportDay(new Date(profileCreatedAt))].sort().at(-1)!;
  if (start > period.endDate) return 0;
  return Math.round((Date.parse(`${period.endDate}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / DAY_MS) + 1;
}
