"use client";
import { useId, useState, type ReactNode } from "react";
import type { Course, Person } from "@/lib/model";
import { reportDay, resolveReportPeriod } from "@/lib/reports/periods";
import { normalizeReportQuery, type ReportLocation } from "@/lib/reports/navigation";
import type { ReportQuery } from "@/lib/reports/contracts";
import { statusLabels, viewLabels } from "@/lib/reports/presentation";
import { FilterBar, AppliedFilters, type AppliedFilter } from "../layout/filter-bar";
import { Field, FieldLabel, FieldDescription } from "../ui/field";
import { Button } from "../ui/button";
export function ReportSelect({ label, value, children, onChange, disabled = false }: { label: string; value: string; children: ReactNode; onChange: (value: string) => void; disabled?: boolean }) {
  const id = useId();
  return <Field data-disabled={disabled || undefined}><FieldLabel htmlFor={id}>{label}</FieldLabel><select id={id} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>{children}</select></Field>;
}
export function ReportFilters({ location, people, courses, challenges, onChange }: { location: ReportLocation; people: Person[]; courses: Course[]; challenges: { id: string; title: string }[]; onChange: (location: ReportLocation) => void }) {
  const q = location.query;
  const current = q.view === "learning" && q.learningMode === "current";
  const resolved = resolveReportPeriod(q.period);
  const [draft, setDraft] = useState({ start: resolved.startDate, end: resolved.endDate, error: "" });
  const startId = useId(), endId = useId(), errorId = useId();
  const update = (patch: Partial<ReportQuery>) => onChange({ ...location, query: normalizeReportQuery({ ...q, ...patch }), page: 1, order: "name", metric: undefined });
  const departments = [...new Map(people.map(person => [person.department.trim().toLowerCase(), person.department.trim()])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const filteredPeople = q.department ? people.filter(person => person.department.trim().toLowerCase() === q.department!.trim().toLowerCase()) : people;
  const chips: AppliedFilter[] = [
    { id: "view", label: "Visão", value: viewLabels[q.view] },
    { id: "period", label: "Recorte", value: current ? "Situação atual" : `${resolved.startDate.split("-").reverse().join("/")} a ${resolved.endDate.split("-").reverse().join("/")}` },
    ...(q.department ? [{ id: "department", label: "Departamento", value: departments.find(([key]) => key === q.department?.trim().toLowerCase())?.[1] ?? q.department, onRemove: () => update({ department: undefined, personId: undefined }) }] : []),
    ...(q.personId ? [{ id: "person", label: "Colaborador", value: people.find(person => person.id === q.personId)?.name ?? q.personId, onRemove: () => update({ personId: undefined }) }] : []),
    ...(q.courseId ? [{ id: "course", label: "Curso", value: courses.find(course => course.id === q.courseId)?.title ?? q.courseId, onRemove: () => update({ courseId: undefined }) }] : []),
    ...(q.challengeId ? [{ id: "challenge", label: "Desafio", value: challenges.find(challenge => challenge.id === q.challengeId)?.title ?? "Selecionado", onRemove: () => update({ challengeId: undefined }) }] : []),
    ...(q.status ? [{ id: "status", label: "Situação", value: statusLabels[q.status], onRemove: () => update({ status: undefined }) }] : []),
  ];
  return <div className="reports-filters report-controls">
    <FilterBar advanced={q.view === "learning" ? <>
      <ReportSelect label="Curso" value={q.courseId ?? "all"} onChange={value => update({ courseId: value === "all" ? undefined : value })}><option value="all">Todos os cursos</option>{courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</ReportSelect>
      <ReportSelect label="Situação" value={q.status ?? "all"} onChange={value => update({ status: value === "all" ? undefined : value as ReportQuery["status"] })}><option value="all">Todas as situações</option>{(q.learningDetail === "assessments" ? ["pending", "approved", "retry"] : q.learningMode === "activity" ? ["completed"] : ["not_started", "in_progress", "awaiting_assessment", "completed"]).map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</ReportSelect>
      {q.learningDetail === "assessments" && <ReportSelect label="Tentativas corrigidas" value={q.attemptPolicy ?? "latest"} onChange={value => update({ attemptPolicy: value as ReportQuery["attemptPolicy"] })}><option value="latest">Última por atividade e versão</option><option value="best">Melhor por atividade e versão</option><option value="all">Todas no recorte</option></ReportSelect>}
    </> : undefined}>
      <ReportSelect label="Período" disabled={current} value={q.period.kind} onChange={kind => { setDraft({ start: resolved.startDate, end: resolved.endDate, error: "" }); update({ period: kind === "custom" ? { kind, startDate: resolved.startDate, endDate: resolved.endDate } : { kind: kind as "last7" | "last30" } }); }}><option value="last7">Últimos 7 dias</option><option value="last30">Últimos 30 dias</option><option value="custom">Personalizado</option></ReportSelect>
      {departments.length === 1 ? <Field><FieldLabel>Departamento</FieldLabel><p className="reports-department-context">{departments[0][1]}</p></Field> : <ReportSelect label="Departamento" value={q.department?.trim().toLowerCase() ?? "all"} onChange={value => update({ department: value === "all" ? undefined : value, personId: undefined })}><option value="all">Todos os departamentos</option>{departments.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</ReportSelect>}
      <ReportSelect label="Colaborador" value={q.personId ?? "all"} onChange={value => update({ personId: value === "all" ? undefined : value })}><option value="all">Toda a equipe ativa</option>{filteredPeople.map(person => <option key={person.id} value={person.id}>{person.name} · {person.department.trim()}</option>)}</ReportSelect>
      {q.view === "learning" && <>
      <ReportSelect label="Análise" value={q.learningDetail ?? "courses"} onChange={detail => update({ learningDetail: detail as ReportQuery["learningDetail"], learningMode: detail === "assessments" ? "activity" : "current", learningScope: detail === "assessments" ? "catalog" : "assigned", attemptPolicy: detail === "assessments" ? "latest" : undefined, status: undefined })}><option value="courses">Cursos</option><option value="assessments">Avaliações</option></ReportSelect>
      <ReportSelect label="Modo de aprendizagem" value={q.learningMode ?? "current"} onChange={mode => update({ learningMode: mode as ReportQuery["learningMode"], status: undefined })}><option value="current">Situação atual</option><option value="activity">Atividade no período</option></ReportSelect>
      <ReportSelect label="Conjunto de cursos" value={q.learningScope ?? "assigned"} onChange={scope => update({ learningScope: scope as ReportQuery["learningScope"], courseId: undefined })}><option value="assigned">Cursos atribuídos</option><option value="catalog">Catálogo disponível</option></ReportSelect>
      </>}
      {q.view === "challenges" && <ReportSelect label="Desafio" value={q.challengeId ?? "all"} onChange={value => update({ challengeId: value === "all" ? undefined : value })}><option value="all">Todas as edições</option>{q.challengeId && !challenges.some(challenge => challenge.id === q.challengeId) && <option value={q.challengeId}>Desafio selecionado</option>}{challenges.map(challenge => <option key={challenge.id} value={challenge.id}>{challenge.title}</option>)}</ReportSelect>}
    </FilterBar>
    {current && <p className="reports-help">A data não filtra progresso acumulado. Selecione “Atividade no período” para consultar eventos com data registrada.</p>}
    {q.view === "learning" && <p className="reports-help">{q.learningScope === "assigned" ? "Atribuídos: cursos das trilhas ativas, sem duplicar o mesmo curso para uma pessoa." : "Catálogo: cursos disponíveis; disponibilidade não representa uma obrigação."}{q.learningDetail === "assessments" ? " Nota pendente fica fora da média; a política considera pessoa, atividade e versão." : q.learningMode === "current" ? " 100% das aulas não substitui a aprovação nas avaliações." : " Baseline antigo sem data não é contado como conclusão no período."}</p>}
    {q.period.kind === "custom" && !current && <form className="reports-custom-period" onSubmit={event => { event.preventDefault(); try { const period = { kind: "custom" as const, startDate: draft.start, endDate: draft.end }; resolveReportPeriod(period); setDraft({ ...draft, error: "" }); update({ period }); } catch { setDraft({ ...draft, error: "Selecione datas válidas, sem futuro, entre 1 e 366 dias." }); } }}>
      <Field data-invalid={!!draft.error || undefined}><FieldLabel htmlFor={startId}>Início</FieldLabel><input id={startId} type="date" max={reportDay()} value={draft.start} aria-invalid={!!draft.error} aria-describedby={draft.error ? errorId : undefined} onChange={event => setDraft({ ...draft, start: event.target.value })} /></Field>
      <Field data-invalid={!!draft.error || undefined}><FieldLabel htmlFor={endId}>Fim</FieldLabel><input id={endId} type="date" max={reportDay()} value={draft.end} aria-invalid={!!draft.error} aria-describedby={draft.error ? errorId : undefined} onChange={event => setDraft({ ...draft, end: event.target.value })} /></Field><Button type="submit" variant="secondary">Aplicar datas</Button>
      {draft.error && <FieldDescription id={errorId} role="alert">{draft.error}</FieldDescription>}
    </form>}
    <AppliedFilters filters={chips} onClear={() => update({ period: { kind: "last30" }, department: undefined, personId: undefined, courseId: undefined, challengeId: undefined, status: undefined })} />
  </div>;
}
