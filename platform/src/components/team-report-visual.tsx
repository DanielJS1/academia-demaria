type ReportKind = "overview" | "courses" | "assessments" | "presence";

const titles: Record<ReportKind, string> = {
  overview: "Visão geral da equipe",
  courses: "Aprendizado por curso",
  assessments: "Resultados das avaliações",
  presence: "Presença na plataforma",
};

export function TeamReportVisual({ kind, rows, peopleCount, days }: {
  kind: ReportKind;
  rows: string[][];
  peopleCount: number;
  days: number;
}) {
  const numeric = (value: string | undefined) => Number(value) || 0;
  const gradedRows = kind === "assessments" ? rows.filter(row => row[5] !== "Pendente") : rows;
  const values = gradedRows.map(row => numeric(row[kind === "overview" ? 4 : kind === "courses" ? 6 : kind === "assessments" ? 5 : 4]));
  const mean = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const headline = kind === "presence" ? `${mean} de ${days} dias` : kind === "assessments" && !values.length ? "—" : `${mean}%`;
  const secondary = kind === "overview" ? rows.filter(row => numeric(row[4]) > 0).length
    : kind === "courses" ? rows.filter(row => row[7] === "Concluído").length
    : kind === "assessments" ? rows.filter(row => row[7] === "Aprovado").length
    : rows.filter(row => numeric(row[4]) > 0).length;
  const secondaryLabel = kind === "overview" ? "Pessoas que iniciaram" : kind === "courses" ? "Cursos concluídos" : kind === "assessments" ? "Tentativas aprovadas" : "Pessoas com acesso";

  const grouped = new Map<string, { name: string; sum: number; count: number }>();
  for (const row of gradedRows) {
    const key = row[1] || row[0];
    const current = grouped.get(key) ?? { name: row[0], sum: 0, count: 0 };
    current.sum += numeric(row[kind === "overview" ? 4 : kind === "courses" ? 6 : kind === "assessments" ? 5 : 4]);
    current.count += 1;
    grouped.set(key, current);
  }
  const chart = [...grouped].map(([key, value]) => ({ key, name: value.name, value: Math.round(value.sum / value.count) }))
    .sort((a, b) => b.value - a.value).slice(0, 8);
  const chartTitle = kind === "presence" ? `Dias com acesso por pessoa · últimos ${days} dias` :
    kind === "assessments" ? "Média das notas por pessoa" : kind === "courses" ? "Progresso médio nos cursos por pessoa" : "Progresso geral por pessoa";

  return <div className="team-report-visual">
    <div className="team-report-visual-intro"><span className="eyebrow">PANORAMA DA EQUIPE</span><h2>{titles[kind]}</h2><p>Indicadores calculados com os filtros selecionados.</p></div>
    <div className="team-report-kpis">
      <div><span>Colaboradores</span><strong>{peopleCount}</strong></div>
      <div><span>{kind === "presence" ? "Média de dias com acesso" : kind === "assessments" ? "Média das notas" : "Progresso médio"}</span><strong>{headline}</strong></div>
      <div><span>{secondaryLabel}</span><strong>{secondary}</strong></div>
    </div>
    {chart.length > 0 && <div className="team-report-chart" aria-label={chartTitle}>
      <h3>{chartTitle}</h3>
      <div className="team-report-chart-list">{chart.map(item => <div className="team-report-chart-row" key={item.key}>
        <span title={item.name}>{item.name}</span>
        <div className="team-report-chart-track" aria-hidden="true"><i style={{ width: `${kind === "presence" ? Math.min(100, item.value / days * 100) : Math.min(100, item.value)}%` }} /></div>
        <strong>{item.value}{kind === "presence" ? `/${days}` : "%"}</strong>
      </div>)}</div>
      {grouped.size > 8 && <p>Gráfico com os 8 maiores resultados. A tabela inclui todos os registros.</p>}
    </div>}
  </div>;
}
