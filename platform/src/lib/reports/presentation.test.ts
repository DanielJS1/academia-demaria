import { describe, expect, it } from "vitest";
import { readReportLocation, reportLocationParams, changeReportView } from "./navigation";
import { reportPlots, sortReportRows, reportColumns, formatMetric } from "./presentation";
import type { ReportDataset, ReportRow } from "./contracts";
const now = new Date("2026-10-12T15:00:00Z");
const metric = (id: string, value: number | null) => ({ id, value, unit: "count" as const, estimated: false, coverage: { availability: "available" as const, semantics: "current" as const, observedFrom: null, observedUntil: null } });
const dataset = { query: { view: "learning", learningMode: "current", learningDetail: "courses", learningScope: "assigned", period: { kind: "last30" }, population: "active" }, rows: [], kpis: [], series: [{ id: "course_status", metricId: "course_pairs", points: [{ id: "not_started", label: "not_started", value: 2 }, { id: "completed", label: "completed", value: 1 }] }] } as unknown as ReportDataset;
const row = (id: string, userId: string, done: number, total: number): ReportRow => ({ type: "course", id, userId, name: "Mesmo nome", department: "Suporte", courseId: id, courseVersion: 1, status: "in_progress", metrics: [metric("completed_lessons", done), metric("total_lessons", total)] });
describe("report navigation and visual semantics", () => {
  it("round-trips custom dates, individual context, presentation and pagination", () => {
    const params = new URLSearchParams("visao=aprendizagem&inicio=2026-10-01&fim=2026-10-10&pessoa=a&detalhe=avaliacoes&tentativas=melhor&formato=tabela&pagina=2&ordem=score&direcao=desc");
    const value = readReportLocation(params, now);
    expect(value.query).toMatchObject({ personId: "a", learningMode: "activity", attemptPolicy: "best" });
    expect(readReportLocation(reportLocationParams(value), now)).toEqual(value);
  });
  it("rejects invalid/duplicate URL values without replacing them with broader scope", () => {
    for (const query of ["visao=desconhecida", "pessoa=a&pessoa=b", "visao=presenca&curso=c", "periodo=custom&inicio=2026-10-01&fim=2026-10-13", "pagina=0", "populacao=all"]) expect(() => readReportLocation(new URLSearchParams(query), now)).toThrow();
  });
  it("view change preserves global filters but clears incompatible filters", () => {
    const learning = readReportLocation(new URLSearchParams("visao=aprendizagem&pessoa=a&departamento=suporte&curso=c&status=pending&detalhe=avaliacoes"), now);
    expect(changeReportView(learning, "xp").query).toEqual({ view: "xp", period: { kind: "last30" }, population: "active", personId: "a", department: "suporte" });
  });
  it("weights lessons instead of averaging or adding individual percentages; keeps same-name people distinct", () => {
    const plots = reportPlots({ ...dataset, rows: [row("c1", "a", 1, 1), row("c2", "a", 0, 9), row("c3", "b", 1, 2)] });
    const progress = plots.find(plot => plot.id === "person_progress")!;
    expect(progress.partition).toBe(false); expect(progress.points.map(point => [point.id, point.value])).toEqual([["a", 10], ["b", 50]]);
    expect(plots.find(plot => plot.id === "course_status")?.partition).toBe(true);
    expect(plots.some(plot => plot.id.includes("overdue"))).toBe(false);
  });
  it("only permits lesson parts for one person's one course, with counts instead of percentages", () => {
    const data = { ...dataset, query: { ...dataset.query, personId: "a", courseId: "c1" }, rows: [row("c1", "a", 3, 5)] };
    const parts = reportPlots(data).find(plot => plot.id === "lesson_parts")!;
    expect(parts.partition).toBe(true); expect(parts.points.map(point => point.value)).toEqual([3, 2]);
    expect(reportPlots({ ...data, query: { ...data.query, personId: undefined } }).some(plot => plot.id === "lesson_parts")).toBe(false);
  });
  it("sorting preserves every row and sends unavailable values last; formatting keeps zero and negative XP", () => {
    const data = { ...dataset, rows: [row("c1", "a", 0, 5), row("c2", "b", 4, 5)] };
    const columns = reportColumns(data);
    expect(sortReportRows(data.rows, columns, "name", "desc").map(row => row.id)).toEqual(["c1", "c2"]);
    expect(formatMetric(null, "percent")).toBe("—"); expect(formatMetric(0, "percent")).toBe("0%"); expect(formatMetric(-3, "xp")).toBe("-3 XP");
  });
});
