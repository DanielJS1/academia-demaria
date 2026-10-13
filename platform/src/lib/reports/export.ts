import { csvCell } from "../utils";
import type { ReportDataset, ReportRow } from "./contracts";
import { formatCell, reportColumns, reportPlots, statusLabels, viewLabels, type ReportColumn } from "./presentation";
import type { ReportLocation } from "./navigation";

export function reportContext(data: ReportDataset, location: ReportLocation): [string, string][] {
  const q = data.query;
  const course = data.rows.find(row => (row.type === "course" || row.type === "assessment") && row.courseId === q.courseId);
  const challenge = data.rows.find(row => row.type === "challenge" && row.challengeId === q.challengeId);
  return [
    ["Visão", viewLabels[q.view]],
    ["Recorte", data.meta.period ? `${data.meta.period.startDate.split("-").reverse().join("/")} a ${data.meta.period.endDate.split("-").reverse().join("/")}` : "Situação atual (sem filtro temporal)"],
    ["Departamento", q.department ?? "Todos os departamentos autorizados"],
    ["Colaborador", q.personId ? data.rows.find(row => row.userId === q.personId)?.name ?? q.personId : "Equipe ativa autorizada"],
    ...(q.courseId ? [["Curso", course && "courseTitle" in course ? course.courseTitle ?? q.courseId : q.courseId] as [string, string]] : []),
    ...(q.challengeId ? [["Desafio", challenge?.type === "challenge" ? challenge.challengeTitle ?? q.challengeId : q.challengeId] as [string, string]] : []),
    ...(q.view === "learning" ? [["Análise", q.learningDetail === "assessments" ? "Avaliações" : "Cursos"], ["Modo", q.learningMode === "current" ? "Situação atual" : "Atividade no período"], ["Cursos", q.learningScope === "assigned" ? "Atribuídos" : "Catálogo disponível"]] as [string, string][] : []),
    ...(q.attemptPolicy ? [["Tentativas corrigidas", { latest: "Última por atividade e versão", best: "Melhor por atividade e versão", all: "Todas no recorte" }[q.attemptPolicy]]] as [string, string][] : []),
    ...(q.status ? [["Situação", statusLabels[q.status]]] as [string, string][] : []),
    ["Ordenação", `${reportColumns(data, location.metric).find(column => column.id === location.order)?.label ?? location.order} · ${location.direction === "asc" ? "crescente" : "decrescente"}`],
  ];
}

/** One header + rectangular data rows; numeric metrics have no unit/grouping suffix. */
export function reportCsv(data: ReportDataset, columns: ReportColumn[], rows: readonly ReportRow[], location: ReportLocation): string {
  if (!data.meta.complete || !rows.length || rows.length !== data.rows.length) throw new Error("Não há um conjunto completo de registros para exportar.");
  const identity = new Set(data.rows.map(row => row.id));
  if (new Set(rows.map(row => row.id)).size !== rows.length || rows.some(row => !identity.has(row.id))) throw new Error("Registros incompatíveis com o relatório carregado.");
  const q = data.query;
  const context = {
    relatorio_schema: data.schema, visao: q.view, analise: q.learningDetail ?? "", modo_aprendizagem: q.learningMode ?? "", escopo_cursos: q.learningScope ?? "", politica_tentativas: q.attemptPolicy ?? "",
    periodo_inicio: data.meta.period?.startDate ?? "", periodo_fim: data.meta.period?.endDate ?? "", gerado_em: data.meta.generatedAt, fuso: data.meta.timeZone,
    populacao: q.population, base_departamento: data.meta.departmentBasis, filtro_departamento: q.department ?? "", filtro_colaborador: q.personId ?? "", filtro_curso: q.courseId ?? "", filtro_desafio: q.challengeId ?? "", filtro_situacao: q.status ?? "",
    indicador: location.metric ?? reportPlots(data)[0]?.id ?? "sem_indicador", visualizacao: location.format, ranking: location.rank, ordenar_por: location.order, direcao: location.direction,
    total_registros: rows.length, total_pessoas: data.meta.personIds.length, coletado_desde: data.meta.collectedSince ?? "", cobertura_fontes: JSON.stringify(data.meta.coverage),
  };
  const headers = [...Object.keys(context), "registro_id", "colaborador_id", ...columns.flatMap(column => [column.id, ...(column.metricId ? [`${column.id}_unidade`, `${column.id}_disponibilidade`, `${column.id}_semantica`, `${column.id}_estimado`, `${column.id}_motivo`] : [])])];
  const cell = (value: string | number) => typeof value === "number" ? csvCell(value).replace(".", ",") : csvCell(value);
  return "\uFEFF" + [headers, ...rows.map(row => [
    ...Object.values(context), row.id, row.userId,
    ...columns.flatMap(column => {
      if (!column.metricId) return [column.value(row) === null ? "" : formatCell(row, column)];
      const metric = row.metrics.find(metric => metric.id === column.metricId);
      return [metric?.value ?? "", metric?.unit ?? "", metric?.coverage.availability ?? "unavailable", metric?.coverage.semantics ?? "", metric?.estimated ? "sim" : "nao", metric?.coverage.reason ?? (metric?.value == null ? "Sem registros válidos ou denominador" : "")];
    }),
  ])].map(row => row.map(cell).join(";")).join("\r\n");
}
