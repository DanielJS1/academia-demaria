import type { ReportDataset, ReportMetric, ReportRow } from "./contracts";

export const viewLabels = { overview: "Visão geral", presence: "Presença", learning: "Aprendizagem", challenges: "Desafios", community: "Comunidade", xp: "XP" } as const;
export const statusLabels: Record<string, string> = { not_started: "Não iniciado", in_progress: "Em andamento", awaiting_assessment: "Prova pendente", completed: "Concluído", pending: "Aguardando correção", approved: "Aprovado", retry: "Nova tentativa" };
export const metricLabels: Record<string, string> = {
  people_with_access: "Pessoas com acesso", access_days: "Dias com acesso", active_minutes: "Tempo ativo estimado", access_frequency: "Frequência de acesso", observable_days: "Dias observáveis",
  course_pairs: "Cursos por pessoa", completed_courses: "Cursos concluídos", completion_rate: "Conclusão dos cursos", lesson_progress: "Progresso das aulas", completed_lessons: "Aulas concluídas", total_lessons: "Aulas elegíveis", course_complete: "Curso concluído", overdue_people: "Pessoas em atraso", overdue_assignments: "Atribuições em atraso",
  grade_average: "Média das notas", score: "Nota oficial", graded_attempts: "Tentativas corrigidas", pending_attempts: "Correções pendentes", people_with_grades: "Pessoas com nota", period_completions: "Conclusões no período", people_completing: "Pessoas que concluíram",
  challenge_attempts: "Participações em desafios", challenge_participants: "Participantes", challenge_average: "Média nos desafios", challenge_score: "Nota no desafio", challenge_participation_rate: "Taxa de participação",
  publications: "Primeiras publicações", comments_made: "Comentários realizados", comments_received: "Comentários recebidos", like_made: "Curtidas realizadas", like_received: "Curtidas recebidas", hype_made: "Hypes realizados", hype_received: "Hypes recebidos",
  like_active_made: "Curtidas ativas realizadas", like_active_received: "Curtidas ativas recebidas", hype_active_made: "Hypes ativos realizados", hype_active_received: "Hypes ativos recebidos",
  xp_period: "XP do período", xp_season: "XP da temporada", xp_history: "XP do histórico disponível",
};
export const metricValue = (row: ReportRow, id: string) => row.metrics.find(metric => metric.id === id)?.value ?? null;
export function formatNumber(value: number) { return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value); }
export function formatMetric(value: number | null, unit: ReportMetric["unit"]): string {
  if (value === null) return "—";
  return `${formatNumber(value)}${unit === "percent" ? "%" : unit === "minutes" ? " min" : unit === "xp" ? " XP" : unit === "days" ? " dias" : ""}`;
}
export function formatReportDate(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Sem registro";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
export function reportKpis(dataset: ReportDataset) {
  const ids = dataset.query.view === "learning" && dataset.query.learningDetail !== "assessments" && dataset.query.learningMode !== "activity" ? ["completed_courses", "completion_rate", "lesson_progress", "overdue_people"] :
    dataset.query.view === "challenges" ? ["challenge_attempts", "challenge_participants", "challenge_average"] : dataset.query.view === "community" ? ["publications", "comments_made", "comments_received", "hype_received"] : undefined;
  return (ids ? ids.flatMap(id => dataset.kpis.filter(metric => metric.id === id)) : dataset.kpis).slice(0, 4);
}
export type ReportColumn = { id: string; label: string; value: (row: ReportRow) => string | number | null; metricId?: string };
const base: ReportColumn[] = [{ id: "name", label: "Colaborador", value: row => row.name }, { id: "department", label: "Departamento", value: row => row.department }];
const column = (id: string): ReportColumn => ({ id, label: metricLabels[id] ?? id, metricId: id, value: row => metricValue(row, id) });
export function reportColumns(dataset: ReportDataset, indicator?: string): ReportColumn[] {
  const type = dataset.query.view;
  if (type === "presence") return [...base, { id: "lastAccessAt", label: "Último acesso conhecido", value: row => row.type === "presence" ? row.lastAccessAt : null }, column("access_days"), column("access_frequency"), column("active_minutes")];
  if (type === "learning") {
    const course: ReportColumn = { id: "course", label: "Curso / versão", value: row => row.type === "course" || row.type === "assessment" ? `${row.courseTitle ?? row.courseId} · v${row.courseVersion ?? "?"}` : null };
    if (dataset.query.learningDetail === "assessments") return [...base, course, { id: "activity", label: "Atividade", value: row => row.type === "assessment" ? row.activityId ?? "Legada" : null }, { id: "submittedAt", label: "Envio", value: row => row.type === "assessment" ? row.submittedAt ?? null : null }, column("score"), { id: "status", label: "Situação", value: row => row.type === "assessment" ? statusLabels[row.status] : null }];
    if (dataset.query.learningMode === "activity") return [...base, course, { id: "completedAt", label: "Conclusão registrada", value: row => row.type === "course" ? row.completedAt ?? null : null }, column("period_completions")];
    return [...base, course, column("lesson_progress"), { id: "status", label: "Situação do curso", value: row => row.type === "course" ? statusLabels[row.status] : null }, { id: "overdue", label: "Atribuição em atraso", value: row => row.type === "course" ? row.assignments?.some(assignment => assignment.overdue) ? "Sim" : row.assignments?.length ? "Não" : "Não se aplica" : null }];
  }
  if (type === "challenges") return [...base, { id: "challenge", label: "Desafio / revisão", value: row => row.type === "challenge" ? `${row.challengeTitle ?? row.challengeId} · ${row.revision ? `r${row.revision}` : "legado"}` : null }, { id: "completedAt", label: "Participação", value: row => row.type === "challenge" ? row.completedAt : null }, column("challenge_score"), { id: "passed", label: "Resultado", value: row => row.type === "challenge" ? row.passed ? "Aprovado" : "Abaixo da nota mínima" : null }, { id: "review", label: "Revisão", value: row => row.type === "challenge" ? row.reviewAvailable ? "Disponível" : "Legado sem revisão" : null }];
  if (type === "community") {
    const ids = indicator?.startsWith("like_") ? ["like_made", "like_received", "like_active_made", "like_active_received"] : indicator?.startsWith("hype_") ? ["hype_made", "hype_received", "hype_active_made", "hype_active_received"] : indicator?.startsWith("comments_") ? ["comments_made", "comments_received"] : ["publications", "comments_made", "comments_received", "hype_received"];
    return [...base, ...ids.map(column)];
  }
  return [...base, ...dataset.kpis.map(metric => column(metric.id))];
}
export function formatCell(row: ReportRow, column: ReportColumn) {
  const value = column.value(row);
  if (column.metricId) {
    const metric = row.metrics.find(metric => metric.id === column.metricId);
    return metric ? formatMetric(metric.value, metric.unit) : "—";
  }
  return ["lastAccessAt", "submittedAt", "completedAt"].includes(column.id) ? formatReportDate(typeof value === "string" ? value : null) : value === null ? "—" : String(value);
}
export function sortReportRows(rows: readonly ReportRow[], columns: readonly ReportColumn[], id: string, direction: "asc" | "desc") {
  const selected = columns.find(column => column.id === id) ?? columns[0];
  return [...rows].sort((a, b) => {
    const av = selected.value(a), bv = selected.value(b);
    if (av === null || bv === null) return av === null && bv === null ? a.id.localeCompare(b.id) : av === null ? 1 : -1;
    return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "pt-BR", { numeric: true })) * (direction === "asc" ? 1 : -1) || a.id.localeCompare(b.id);
  });
}
export type Plot = { id: string; title: string; unit: ReportMetric["unit"]; partition: boolean; semantics: "current" | "period"; points: { id: string; label: string; userId?: string; value: number | null }[] };
export function reportPlots(dataset: ReportDataset): Plot[] {
  const fromSeries = (id: string, title: string, unit: Plot["unit"], partition = false, semantics: Plot["semantics"] = "period"): Plot => ({ id, title, unit, partition, semantics, points: dataset.series.find(series => series.id === id)?.points.map(point => ({ ...point, label: statusLabels[point.id] ?? point.label })) ?? [] });
  const byPerson = (id: string, unit: Plot["unit"]): Plot => ({ id, title: metricLabels[id] ?? id, unit, partition: false, semantics: dataset.kpis.find(metric => metric.id === id)?.coverage.semantics === "current" ? "current" : "period", points: dataset.rows.map(row => ({ id: row.id, userId: row.userId, label: row.name, value: metricValue(row, id) })) });
  if (dataset.query.view === "overview") return [fromSeries("daily_access_people", "Pessoas com acesso por dia", "count"), fromSeries("course_status", "Situação atual dos cursos atribuídos", "count", true, "current")];
  if (dataset.query.view === "presence") return [byPerson("access_days", "days"), byPerson("access_frequency", "percent"), byPerson("active_minutes", "minutes"), fromSeries("daily_access_people", "Acessos registrados por dia", "count"), fromSeries("daily_active_minutes", "Tempo ativo estimado por dia", "minutes")];
  if (dataset.query.view === "learning") {
    if (dataset.query.learningDetail === "assessments") return [fromSeries("person_grades", "Média das notas por pessoa", "percent", false, dataset.meta.period ? "period" : "current")];
    if (dataset.query.learningMode === "activity") return [fromSeries("person_completions", "Conclusões registradas por pessoa", "count")];
    const grouped = new Map<string, { name: string; done: number; total: number }>();
    for (const row of dataset.rows) { const current = grouped.get(row.userId) ?? { name: row.name, done: 0, total: 0 }; current.done += metricValue(row, "completed_lessons") ?? 0; current.total += metricValue(row, "total_lessons") ?? 0; grouped.set(row.userId, current); }
    const plots: Plot[] = [fromSeries("course_status", "Situação atual dos cursos", "count", true, "current"), { id: "person_progress", title: "Progresso das aulas por pessoa", unit: "percent" as const, partition: false, semantics: "current" as const, points: [...grouped].map(([userId, row]) => ({ id: userId, userId, label: row.name, value: row.total ? row.done / row.total * 100 : null })) }];
    const row = dataset.rows.length === 1 ? dataset.rows[0] : undefined;
    if (row?.type === "course" && dataset.query.personId && dataset.query.courseId) {
      const done = metricValue(row, "completed_lessons"), total = metricValue(row, "total_lessons");
      plots.push({ id: "lesson_parts", title: "Aulas concluídas e restantes neste curso", unit: "count", partition: true, semantics: "current", points: [{ id: "done", label: "Concluídas", value: done }, { id: "remaining", label: "Restantes", value: done === null || total === null ? null : total - done }] });
    }
    return plots;
  }
  if (dataset.query.view === "challenges") return [fromSeries("person_challenge_scores", "Média nos desafios por pessoa", "percent")];
  return dataset.kpis.filter(metric => metric.coverage.availability !== "unavailable").map(metric => byPerson(metric.id, metric.unit));
}
