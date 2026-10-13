import type { ReportDataset, ReportRow } from "@/lib/reports/contracts";
import type { ReportLocation } from "@/lib/reports/navigation";
import { reportContext } from "@/lib/reports/export";
import { formatCell, formatReportDate, formatMetric, metricLabels, reportKpis, viewLabels, type Plot, type ReportColumn } from "@/lib/reports/presentation";
import { ReportChart } from "./report-chart";
const ignore = () => {};

export function ReportPrintDocument({ data, columns, rows, location, plots }: { data: ReportDataset; columns: ReportColumn[]; rows: ReportRow[]; location: ReportLocation; plots: Plot[] }) {
  const landscape = columns.length > 6;
  return <section className={`reports-print-document reports-print-${landscape ? "landscape" : "portrait"}`} aria-label="Documento completo para impressão">
    <header><strong className="reports-print-brand">Academia DeMaria</strong><h1>{viewLabels[data.query.view]}</h1><p>Gerado em {formatReportDate(data.meta.generatedAt)} · {data.meta.timeZone} (Brasília)</p></header>
    <dl className="reports-print-context">{reportContext(data, location).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p>{rows.length} registros · {data.meta.personIds.length} pessoas · população ativa · departamento atual</p>
    <section className="reports-print-kpis" aria-label="Indicadores do relatório">{reportKpis(data).map(metric => <article key={metric.id}><h2>{metricLabels[metric.id] ?? metric.id}</h2><strong>{formatMetric(metric.value, metric.unit)}</strong><p>{metric.coverage.semantics === "current" ? "Situação atual" : metric.coverage.semantics === "latest_known" ? "Último registro conhecido" : "No recorte selecionado"}{metric.denominator !== undefined ? ` · base: ${metric.denominator ?? "não disponível"}` : ""}{metric.estimated ? " · estimado" : ""}</p>{metric.coverage.availability !== "available" && <p>{metric.coverage.availability === "partial" ? "Dados parciais" : "Indisponível"}: {metric.coverage.reason}</p>}</article>)}</section>
    {plots.map(plot => <ReportChart key={plot.id} plot={plot} location={location} onChange={ignore} onPerson={ignore} printing />)}
    <section className="reports-print-coverage"><h2>Cobertura e interpretação</h2><ul>{[...new Set(Object.values(data.meta.coverage).map(coverage => coverage.reason).filter(Boolean))].map(reason => <li key={reason}>{reason}</li>)}</ul><p>“—” significa dado indisponível ou sem registro válido; zero permanece zero. Tempo ativo é estimado. Gráficos de pessoas podem mostrar 12 maiores/menores; a tabela abaixo contém todos os registros filtrados.</p>{data.meta.collectedSince && <p>Início da coleta: {formatReportDate(data.meta.collectedSince)} (Brasília).</p>}</section>
    <h2>Colaboradores e resultados · conjunto completo</h2>
    <table className="reports-print-results"><thead><tr>{columns.map(column => <th key={column.id} scope="col">{column.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}>{columns.map(column => <td key={column.id}>{formatCell(row, column)}</td>)}</tr>)}</tbody></table>
  </section>;
}
