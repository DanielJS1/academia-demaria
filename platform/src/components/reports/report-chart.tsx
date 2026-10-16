"use client";
import { useId, useState } from "react";
import { formatMetric, type Plot } from "@/lib/reports/presentation";
import { DataState } from "../layout/data-state";
import { ReportSelect } from "./report-filters";
import type { ReportLocation } from "@/lib/reports/navigation";
export function ReportChart({ plot, location, onChange, onPerson, secondary = false, printing = false }: { plot: Plot; location: ReportLocation; onChange: (location: ReportLocation) => void; onPerson: (id: string) => void; secondary?: boolean; printing?: boolean }) {
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  const format = location.format === "donut" && !plot.partition ? "bars" : location.format;
  const finite = plot.points.filter(point => point.value !== null);
  const peopleChart = finite.some(point => point.userId);
  const ranked = peopleChart ? [...finite].sort((a, b) => (a.value! - b.value!) * (location.rank === "bottom" ? 1 : -1) || a.id.localeCompare(b.id)) : finite;
  const drawn = peopleChart ? ranked.slice(0, 12) : ranked;
  const negative = drawn.some(point => point.value! < 0);
  const max = plot.unit === "percent" ? 100 : Math.max(1, ...drawn.map(point => Math.abs(point.value!)));
  const total = finite.reduce((sum, point) => sum + point.value!, 0);
  let offset = 0;
  const equivalent = <div className="reports-chart-table"><table><caption>{plot.title} · conjunto completo</caption><thead><tr><th scope="col">{peopleChart ? "Colaborador" : "Grupo / data"}</th><th scope="col">Valor {plot.unit === "percent" ? "(%)" : plot.unit === "minutes" ? "(min)" : plot.unit === "xp" ? "(XP)" : plot.unit === "days" ? "(dias)" : "(quantidade)"}</th></tr></thead><tbody>{plot.points.map(point => <tr key={point.id}><th scope="row">{point.userId && !printing ? <button type="button" className="reports-person-link" onClick={() => onPerson(point.userId!)}>{point.label}</button> : point.label}</th><td>{formatMetric(point.value, plot.unit)}</td></tr>)}</tbody></table></div>;
  return <section className="reports-chart panel" aria-labelledby={titleId}>
    <div className="reports-chart-heading"><div><h2 id={titleId}>{plot.title}</h2><p className="reports-help">{plot.semantics === "current" ? "Situação atual · independente do período" : "Período selecionado"}{plot.unit === "minutes" ? " · tempo ativo estimado" : ""}</p></div>
      {!printing && !secondary && <ReportSelect label="Visualização" value={format} onChange={value => onChange({ ...location, format: value as ReportLocation["format"] })}><option value="table">Tabela</option><option value="bars">Barras</option>{plot.partition && <option value="donut">Rosca</option>}</ReportSelect>}
      {!printing && secondary && <ReportSelect label="Visualização da situação atual" value={format} onChange={value => onChange({ ...location, format: value as ReportLocation["format"] })}><option value="table">Tabela</option><option value="bars">Barras</option>{plot.partition && <option value="donut">Rosca</option>}</ReportSelect>}
    </div>
    {format === "table" ? equivalent : !finite.length ? <DataState state="empty" title="Indicador indisponível neste recorte" description="Valores sem registro ou sem denominador não são convertidos em zero." /> : format === "donut" ? !plot.partition || total <= 0 || finite.some(point => point.value! < 0) ? <DataState state="empty" title="Sem total para dividir" description="A rosca exige partes exclusivas de um total positivo." /> : <div className="reports-donut-layout">
      <svg className="reports-donut" viewBox="0 0 120 120" role="img" aria-label={`${plot.title}. ${finite.map(point => `${point.label}: ${formatMetric(point.value, plot.unit)}`).join("; ")}`}>
        {finite.map((point, index) => { const size = point.value! / total * 100; const dashOffset = -offset; offset += size; return <circle key={point.id} className={`reports-color-${index % 4}`} cx="60" cy="60" r="44" fill="none" strokeWidth="18" pathLength="100" strokeDasharray={`${size} ${100 - size}`} strokeDashoffset={dashOffset} transform="rotate(-90 60 60)" />; })}
        <text x="60" y="57" textAnchor="middle">{formatMetric(total, plot.unit)}</text><text className="reports-donut-caption" x="60" y="73" textAnchor="middle">Total</text>
      </svg><ol className="reports-donut-legend">{finite.map((point, index) => <li key={point.id}><span className={`reports-legend-color reports-color-${index % 4}`} aria-hidden="true" /><span>{index + 1}. {point.label}</span><strong>{formatMetric(point.value, plot.unit)}</strong></li>)}</ol>
    </div> : <>
      {peopleChart && finite.length > 12 && <div className="reports-ranking">{!printing && <ReportSelect label="Seleção do gráfico" value={location.rank} onChange={rank => onChange({ ...location, rank: rank as ReportLocation["rank"] })}><option value="top">12 maiores</option><option value="bottom">12 menores</option></ReportSelect>}<p>Mostrando 12 de {finite.length} pessoas com valor disponível. A tabela inclui o conjunto completo.</p></div>}
      <p className="reports-chart-axis">{negative ? `Eixo: −${formatMetric(max, plot.unit)} → 0 → ${formatMetric(max, plot.unit)}. Ajustes negativos ficam à esquerda.` : `Eixo: 0 a ${formatMetric(max, plot.unit)}.`}</p>
      <ol className="reports-bars">{drawn.map(point => { const width = Math.abs(point.value!) / max * (negative ? 50 : 100); return <li key={point.id} data-point-id={point.id}>
        {point.userId && !printing ? <button type="button" className="reports-person-link" onClick={() => onPerson(point.userId!)}>{point.label}</button> : <span>{/^\d{4}-\d{2}-\d{2}$/.test(point.label) ? point.label.split("-").reverse().join("/") : point.label}</span>}
        <span className={`reports-bar-track ${negative ? "reports-bar-signed" : ""}`} aria-hidden="true"><i style={{ width: `${width}%`, left: negative ? `${point.value! < 0 ? 50 - width : 50}%` : 0 }} /></span><strong>{formatMetric(point.value, plot.unit)}</strong>
      </li>; })}</ol>
    </>}
    {!printing && format !== "table" && <details className="reports-chart-equivalent" onToggle={event => setExpanded(event.currentTarget.open)}><summary>Tabela equivalente · {plot.points.length} registros</summary>{expanded && equivalent}</details>}
  </section>;
}
