"use client";
import { ArrowDown, ArrowUp, FileSearch } from "lucide-react";
import { formatCell, type ReportColumn } from "@/lib/reports/presentation";
import type { ReportDataset, ReportRow } from "@/lib/reports/contracts";
import type { ReportLocation } from "@/lib/reports/navigation";
import { Button } from "../ui/button";
export function ReportTable({ dataset, rows, columns, location, onChange, onPerson, onAssessment }: { dataset: ReportDataset; rows: ReportRow[]; columns: ReportColumn[]; location: ReportLocation; onChange: (location: ReportLocation) => void; onPerson: (id: string) => void; onAssessment: (id: string) => void }) {
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const visible = rows.slice((location.page - 1) * 25, location.page * 25);
  return <section className="reports-table-section panel" aria-labelledby="report-table-title">
    <div className="reports-section-heading"><div><h2 id="report-table-title">Colaboradores e resultados</h2><p>{rows.length} registros · {dataset.meta.personIds.length} pessoas no escopo ativo</p></div><span>25 linhas por página</span></div>
    <div className="reports-table-scroll" tabIndex={0} role="region" aria-label="Tabela de resultados, com rolagem horizontal se necessário">
      <table className="reports-data-table"><caption className="sr-only">Resultados com os filtros atuais. Ordene pelas colunas ou selecione um colaborador para analisar.</caption><thead><tr>{columns.map(column => <th key={column.id} scope="col" aria-sort={location.order === column.id ? location.direction === "asc" ? "ascending" : "descending" : "none"}>
        <button type="button" onClick={() => onChange({ ...location, page: 1, order: column.id, direction: location.order === column.id && location.direction === "asc" ? "desc" : "asc" })} aria-label={`Ordenar por ${column.label}${location.order === column.id ? location.direction === "asc" ? ", atualmente crescente" : ", atualmente decrescente" : ""}`}>{column.label}{location.order === column.id && (location.direction === "asc" ? <ArrowUp size={15} aria-hidden="true" /> : <ArrowDown size={15} aria-hidden="true" />)}</button>
      </th>)}{dataset.query.learningDetail === "assessments" && <th scope="col">Diagnóstico</th>}</tr></thead><tbody>{visible.map(row => <tr key={row.id} data-row-id={row.id}>{columns.map(column => {
        const metric = column.metricId ? row.metrics.find(item => item.id === column.metricId) : undefined;
        const text = formatCell(row, column);
        return <td key={column.id}>{column.id === "name" ? <button type="button" className="reports-person-link" onClick={() => onPerson(row.userId)} aria-label={`Analisar ${row.name}`}>{text}</button> : column.id === "status" ? <span className="reports-status">{text}</span> : <>{text}{column.id === "lesson_progress" && metric?.value !== null && metric?.value !== undefined && <span className="reports-progress" aria-hidden="true"><i style={{ width: `${metric.value}%` }} /></span>}{metric?.value === null && <span className="sr-only"> {metric.coverage.reason ?? "Sem denominador ou registros válidos"}</span>}</>}</td>;
      })}{row.type === "assessment" && <td><Button type="button" variant="secondary" size="sm" onClick={() => onAssessment(row.id)}><FileSearch size={16} aria-hidden="true" />Ver diagnóstico</Button></td>}</tr>)}</tbody></table>
    </div>
    {!visible.length && <p role="status">Não há registros nesta página. <button type="button" className="reports-person-link" onClick={() => onChange({ ...location, page: 1 })}>Ir para a primeira página</button></p>}
    <nav className="reports-pagination" aria-label="Páginas dos resultados"><Button type="button" variant="secondary" disabled={location.page <= 1} onClick={() => onChange({ ...location, page: location.page - 1 })}>Anterior</Button><span role="status">Página {location.page} de {pages}</span><Button type="button" variant="secondary" disabled={location.page >= pages} onClick={() => onChange({ ...location, page: location.page + 1 })}>Próxima</Button></nav>
  </section>;
}
