import { describe, expect, it } from "vitest";
import { csvCell } from "../utils";
import { resolveReportPeriod } from "./periods";
import { reportCsv, reportContext } from "./export";
import { defaultReportLocation } from "./navigation";
import { reportColumns, type ReportColumn } from "./presentation";
import type { ReportDataset, ReportMetric } from "./contracts";
function parseCsv(csv: string) {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 1; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') { if (quoted && csv[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && char === ";") { row.push(cell); cell = ""; }
    else if (!quoted && char === "\r" && csv[i + 1] === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; }
    else cell += char;
  }
  row.push(cell); rows.push(row); return rows;
}
const location = { ...defaultReportLocation(), query: { ...defaultReportLocation().query, view: "xp" as const }, page: 2, rank: "bottom" as const };
const metric = (value: number | null): ReportMetric => ({ id: "xp_period", value, unit: "xp", estimated: false, coverage: { availability: value === null ? "unavailable" : "partial", semantics: "period", observedFrom: null, observedUntil: null, reason: "Histórico parcial; sem coleta anterior." } });
const generatedAt = "2026-10-12T15:00:00Z";
const dataset: ReportDataset = { schema: 1, query: location.query, meta: { generatedAt, timeZone: "America/Sao_Paulo", actorId: "gestor", personIds: ["a", "b", "c"], complete: true, departmentBasis: "current", period: resolveReportPeriod(location.query.period, new Date(generatedAt)), coverage: { xp: metric(1).coverage } }, rows: [
  { type: "xp", id: "a", userId: "a", name: 'José, "Financeiro"; \nLinha 2', department: "São Paulo", metrics: [metric(-3.5)] },
  { type: "xp", id: "b", userId: "b", name: "=HYPERLINK(1)", department: "@Equipe", metrics: [metric(0)] },
  { type: "xp", id: "c", userId: "c", name: "+Pessoa", department: "-Equipe", metrics: [metric(null)] },
], kpis: [metric(-3.5)], series: [] };
const columns = reportColumns(dataset);
describe("report exports", () => {
  it("keeps UTF-8 BOM, accents, embedded quotes/newlines and rectangular metadata", () => {
    const csv = reportCsv(dataset, columns, dataset.rows, location), parsed = parseCsv(csv);
    expect(csv.charCodeAt(0)).toBe(0xfeff); expect(parsed).toHaveLength(4);
    expect(parsed.every(row => row.length === parsed[0].length)).toBe(true);
    const index = parsed[0].indexOf("name"); expect(parsed[1][index]).toBe(dataset.rows[0].name);
    expect(parsed[1][parsed[0].indexOf("gerado_em")]).toBe(generatedAt);
    expect(parsed[1][parsed[0].indexOf("fuso")]).toBe("America/Sao_Paulo");
  });
  it("preserves signed numeric values and decimals without units, with null distinct from zero", () => {
    const parsed = parseCsv(reportCsv(dataset, columns, dataset.rows, location)), index = parsed[0].indexOf("xp_period");
    expect(parsed.slice(1).map(row => row[index])).toEqual(["-3,5", "0", ""]);
    expect(parsed[3][parsed[0].indexOf("xp_period_disponibilidade")]).toBe("unavailable");
    expect(parsed[3][parsed[0].indexOf("xp_period_motivo")]).toContain("Histórico parcial");
  });
  it("uses csvCell for string formulas while finite signed numbers stay numeric", () => {
    for (const prefix of ["=", "+", "-", "@", " \t="]) expect(csvCell(prefix + "payload")).toContain("'");
    expect(csvCell(-3.5)).toBe('"-3.5"');
    const parsed = parseCsv(reportCsv(dataset, columns, dataset.rows, location));
    expect(parsed[2][parsed[0].indexOf("name")]).toBe("'=HYPERLINK(1)");
  });
  it("includes every row beyond 1,000 independently of page or chart ranking", () => {
    const rows = Array.from({ length: 1005 }, (_, i) => ({ ...dataset.rows[0], id: `row-${i}`, userId: `person-${i}` }));
    const data = { ...dataset, rows, meta: { ...dataset.meta, personIds: rows.map(row => row.userId) } };
    const parsed = parseCsv(reportCsv(data, columns, rows, location));
    expect(parsed).toHaveLength(1006); expect(parsed.at(-1)).toContain("row-1004");
  });
  it("refuses empty, incomplete, paginated, duplicate or mismatched records", () => {
    expect(() => reportCsv({ ...dataset, rows: [] }, columns, [], location)).toThrow();
    expect(() => reportCsv(dataset, columns, dataset.rows.slice(0, 1), location)).toThrow();
    expect(() => reportCsv({ ...dataset, meta: { ...dataset.meta, complete: false } } as unknown as ReportDataset, columns, dataset.rows, location)).toThrow();
    expect(() => reportCsv(dataset, columns, [dataset.rows[0], dataset.rows[0], dataset.rows[2]], location)).toThrow();
  });
  it("uses current-data filter metadata and avoids unrelated private fields", () => {
    const data = { ...dataset, query: { ...dataset.query, department: "São Paulo", personId: "a" }, rows: [dataset.rows[0]], meta: { ...dataset.meta, personIds: ["a"] } };
    const csv = reportCsv(data, columns, data.rows, { ...location, query: data.query });
    expect(csv).toContain('"filtro_departamento"'); expect(csv).toContain('"São Paulo"');
    expect(csv).not.toMatch(/answers|pdi|correct_text_ids/);
    expect(reportContext(data, location)).toContainEqual(["Colaborador", dataset.rows[0].name]);
  });
  it("keeps current learning explicitly independent of the remembered period", () => {
    const data = { ...dataset, query: { ...dataset.query, view: "learning" as const, learningMode: "current" as const, learningDetail: "courses" as const, learningScope: "assigned" as const }, meta: { ...dataset.meta, period: null } };
    expect(reportContext(data, location)).toContainEqual(["Recorte", "Situação atual (sem filtro temporal)"]);
    const parsed = parseCsv(reportCsv(data, columns as ReportColumn[], data.rows, location));
    expect(parsed[1][parsed[0].indexOf("periodo_inicio")]).toBe("");
  });
});
