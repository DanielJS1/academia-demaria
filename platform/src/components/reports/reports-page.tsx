"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, BookOpen, Clock3, MessageSquare, Sparkles, Trophy } from "lucide-react";
import { managedPeople } from "@/lib/team-scope";
import { isCourseActive } from "@/lib/model";
import type { ReportQuery } from "@/lib/reports/contracts";
import { metricLabels, viewLabels, reportColumns, reportKpis, reportPlots, sortReportRows, formatMetric, formatReportDate } from "@/lib/reports/presentation";
import { defaultReportLocation, changeReportView, normalizeReportQuery, reportLocationParams, type ReportLocation } from "@/lib/reports/navigation";
import { useAcademy } from "../academy-provider";
import { useQuizSummary } from "../quizzes/quiz-summary-provider";
import { PageHeading } from "../layout/page-heading";
import { MetricCard } from "../layout/metric-card";
import { DataState } from "../layout/data-state";
import { Button } from "../ui/button";
import { ReportFilters, ReportSelect } from "./report-filters";
import { ReportChart } from "./report-chart";
import { ReportTable } from "./report-table";
import { ReportExports } from "./report-exports";
import { AssessmentDialog } from "./assessment-dialog";
import { QuestionAttention } from "./question-attention";
import { useReportNavigation } from "./use-report-navigation";
import { useReportData } from "./use-report-data";
const icons = { overview: BarChart3, presence: Clock3, learning: BookOpen, challenges: Trophy, community: MessageSquare, xp: Sparkles };
export function ReportsPage() {
  const { state, me, isClientEnvironment } = useAcademy();
  const quizSummary = useQuizSummary();
  const navigation = useReportNavigation();
  const location = navigation.location;
  const people = managedPeople(state.people, me);
  const courses = state.courses.filter(course => isCourseActive(course) && course.audience !== "client");
  const departments = new Set(people.map(person => person.department.trim().toLowerCase()));
  const query = location?.query;
  const selectedPerson = people.find(person => person.id === query?.personId);
  const actorStatus = state.people.find(person => person.id === me.id)?.status;
  const forbidden = isClientEnvironment || me.audience === "client" || (actorStatus !== undefined && actorStatus !== "active") || me.role === "student";
  const invalidScope = query?.personId && !selectedPerson ? "Colaborador fora da equipe ativa disponível." : query?.department && !departments.has(query.department.trim().toLowerCase()) ? "Departamento fora da equipe ativa disponível." :
    selectedPerson && query?.department && selectedPerson.department.trim().toLowerCase() !== query.department.trim().toLowerCase() ? "Colaborador não pertence ao departamento selecionado." : undefined;
  const scopeKey = JSON.stringify([me.id, me.role, actorStatus, me.audience, me.department, isClientEnvironment, people.map(person => person.id).sort()]);
  const data = useReportData(query, me.id, scopeKey, !forbidden && !invalidScope && !!location);
  const dataset = data.data;
  const plots = dataset ? reportPlots(dataset) : [];
  const plot = plots.find(plot => plot.id === location?.metric) ?? plots[0];
  const incompatiblePlot = !!dataset && !!location?.metric && !plots.some(plot => plot.id === location.metric);
  const columns = dataset ? reportColumns(dataset, plot?.id) : [];
  const incompatibleOrder = !!dataset && !!location && !columns.some(column => column.id === location.order);
  const ready = !!dataset && !incompatiblePlot && !incompatibleOrder;
  const rows = ready && location ? sortReportRows(dataset.rows, columns, location.order, location.direction) : [];
  const [attemptId, setAttemptId] = useState<string | null>(null);
  useEffect(() => setAttemptId(null), [data.key]);
  const assessment = dataset?.rows.find(row => row.id === attemptId && row.type === "assessment");
  const change = (next: ReportLocation) => navigation.change(next);
  const patch = (values: Partial<ReportQuery>) => { if (location) change({ ...location, page: 1, metric: location.metric === "lesson_parts" && !values.personId ? undefined : location.metric, query: normalizeReportQuery({ ...location.query, ...values }) }); };
  const challenges = [...new Map([...(quizSummary.data?.available ?? []).map(quiz => ({ id: quiz.id, title: quiz.title })), ...(quizSummary.data?.completed ?? []).map(quiz => ({ id: quiz.id, title: quiz.title })), ...(dataset?.rows ?? []).flatMap(row => row.type === "challenge" ? [{ id: row.challengeId, title: row.challengeTitle ?? "Desafio" }] : [])].map(quiz => [quiz.id, quiz])).values()];
  if (forbidden) return <DataState state="error" title="Acesso restrito" description="Relatórios são exclusivos para gestores internos ativos." />;
  return <div className="page-enter reports-page">
    <PageHeading variant="compact" title="Relatórios" description="Entenda a participação e a evolução da sua equipe."><ReportExports data={ready ? dataset : undefined} columns={columns} rows={rows} requestKey={data.key} location={location} plots={query?.view === "overview" ? plots.slice(0, 2) : plot ? [plot] : []} /></PageHeading>
    <nav className="reports-views report-controls" aria-label="Visões dos relatórios">{(Object.keys(viewLabels) as ReportQuery["view"][]).map(view => { const Icon = icons[view]; const next = changeReportView(location ?? defaultReportLocation(), view); return <a key={view} href={`/equipe/relatorios?${reportLocationParams(next)}`} aria-current={query?.view === view ? "page" : undefined} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); change(next); } }}><Icon size={19} aria-hidden="true" />{viewLabels[view]}</a>; })}</nav>
    {!location ? <><DataState state="error" title="Filtros inválidos" description={navigation.error ?? "Revise os filtros."} /><Button type="button" variant="secondary" onClick={() => change(defaultReportLocation())}>Restaurar filtros padrão</Button></> : <>
      <ReportFilters key={`${query!.view}:${JSON.stringify(query!.period)}`} location={location} people={people} courses={courses} challenges={challenges} onChange={change} />
      {query?.personId && selectedPerson && <section className="reports-individual panel" aria-label="Análise individual"><div><h2>{selectedPerson.name}</h2><p>{selectedPerson.department.trim()} · análise individual</p></div><div className="reports-individual-actions"><Button type="button" variant="secondary" onClick={() => patch({ personId: undefined })}>Todos os colaboradores</Button><Button asChild variant="secondary"><Link href={`/equipe?pessoa=${encodeURIComponent(selectedPerson.id)}&acao=pdi&retorno=${encodeURIComponent(`/equipe/relatorios?${reportLocationParams(location)}`)}`}>Gerir colaborador</Link></Button></div></section>}
      {invalidScope ? <DataState state="error" description={invalidScope} /> : data.loading ? <DataState state="loading" title="Carregando relatório…" description="Consultando os dados com os filtros selecionados." /> : data.error ? <DataState state="error" description={data.error} onRetry={data.retry} /> : incompatiblePlot || incompatibleOrder ? <><DataState state="error" title="Visualização incompatível" description="O indicador ou a ordenação não pertence a esta visão. Os filtros de acesso foram preservados." /><Button type="button" variant="secondary" onClick={() => change({ ...location, metric: undefined, order: "name", format: "bars", page: 1 })}>Restaurar visualização</Button></> : ready && dataset && <>
        <p className="reports-generated">{dataset.meta.period ? `De ${dataset.meta.period.startDate.split("-").reverse().join("/")} a ${dataset.meta.period.endDate.split("-").reverse().join("/")}` : "Situação atual"} · atualizado em {formatReportDate(dataset.meta.generatedAt)} (Brasília)</p>
        <div className="reports-kpis">{reportKpis(dataset).map(metric => { const value = metric.value === null ? null : formatMetric(metric.value, metric.unit); const context = `${metric.coverage.semantics === "current" ? "Situação atual" : metric.coverage.semantics === "latest_known" ? "Último registro conhecido" : "No recorte selecionado"}${metric.denominator !== undefined ? ` · base: ${metric.denominator ?? "não disponível"}` : ""}`; return <MetricCard key={metric.id} label={metricLabels[metric.id] ?? metric.id} context={context} {...(metric.coverage.availability === "unavailable" ? { state: "unavailable" as const, reason: metric.coverage.reason! } : metric.coverage.availability === "partial" ? { state: "partial" as const, value, reason: "Cobertura parcial. Consulte os detalhes abaixo." } : { value })} />; })}</div>
        {Object.values(dataset.meta.coverage).some(coverage => coverage.reason || coverage.availability !== "available") && <details className="reports-coverage"><summary>Como interpretar os dados e a cobertura</summary><ul>{[...new Set(Object.values(dataset.meta.coverage).flatMap(coverage => coverage.reason ? [coverage.reason] : []))].map(reason => <li key={reason}>{reason}</li>)}</ul></details>}
        {!dataset.rows.length ? <DataState state="empty" title={query?.view === "learning" && query.learningScope === "assigned" && query.learningMode === "current" ? "Sem cursos atribuídos neste conjunto" : "Sem registros para estes filtros"} description="Ausência de registros não significa nota zero nem falta de participação obrigatória. Confira o período e a cobertura." /> : <>
          {query?.view !== "overview" && plots.length > 1 && <div className="reports-indicator report-controls"><ReportSelect label="Indicador" value={plot?.id ?? ""} onChange={metric => { const nextPlot = plots.find(plot => plot.id === metric); change({ ...location, metric, page: 1, order: "name", format: location.format === "donut" && !nextPlot?.partition ? "bars" : location.format }); }}>{plots.map(plot => <option key={plot.id} value={plot.id}>{plot.title}</option>)}</ReportSelect></div>}
          <div className={query?.view === "overview" ? "reports-charts reports-charts-summary" : "reports-charts"}>{(query?.view === "overview" ? plots.slice(0, 2) : plot ? [plot] : []).map((plot, index) => <ReportChart key={plot.id} plot={plot} location={location} onChange={change} onPerson={id => patch({ personId: id })} secondary={query?.view === "overview" && index === 1} />)}</div>
          <ReportTable dataset={dataset} rows={rows} columns={columns} location={location} onChange={change} onPerson={id => patch({ personId: id })} onAssessment={setAttemptId} />
          {query?.learningDetail === "assessments" && <QuestionAttention data={dataset} />}
        </>}
      </>}
    </>}
    {ready && assessment?.type === "assessment" && <AssessmentDialog key={assessment.id} row={assessment} onClose={() => setAttemptId(null)} />}
  </div>;
}
