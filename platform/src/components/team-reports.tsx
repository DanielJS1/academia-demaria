"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Clock3, Download, FileSpreadsheet, GraduationCap, Printer, Users } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { useTeamEngagement } from "./team-engagement";
import { Button } from "./ui/button";
import { EmptyState, PageHeading } from "./shared";
import { courseProgress } from "@/lib/model";
import { formatActiveTime, formatLastAccess } from "@/lib/engagement";
import { csvCell, normalize } from "@/lib/utils";
import { managedPeople } from "@/lib/team-scope";
import { TeamReportVisual } from "./team-report-visual";

type ReportKind = "overview" | "courses" | "assessments" | "presence";
const choices = [
  { id: "overview", title: "Visão geral", description: "Progresso, aulas, avaliações e XP por pessoa.", icon: Users },
  { id: "courses", title: "Cursos", description: "Andamento de cada colaborador em cada curso.", icon: BookOpen },
  { id: "assessments", title: "Avaliações", description: "Notas, situação e devolutivas das tentativas.", icon: GraduationCap },
  { id: "presence", title: "Presença", description: "Último acesso, frequência e tempo ativo estimado.", icon: Clock3 },
] as const;

export function TeamReports() {
  const { state, me, notify, isClientEnvironment } = useAcademy();
  const engagement = useTeamEngagement(me.id, !isClientEnvironment && me.role !== "student");
  const [kind, setKind] = useState<ReportKind>("overview");
  const [department, setDepartment] = useState("all");
  const [personId, setPersonId] = useState("all");
  const [courseId, setCourseId] = useState("all");
  const [progress, setProgress] = useState("all");
  const [generatedOn, setGeneratedOn] = useState("");

  useEffect(() => { setGeneratedOn(new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })); }, []);

  const people = useMemo(() => managedPeople(state.people, me), [state.people, me]);
  const departments = useMemo(() => [...new Set(people.map(person => person.department).filter(Boolean))].sort(), [people]);
  const courses = useMemo(() => state.courses.filter(course => course.status === "published" && course.audience !== "client"), [state.courses]);
  const selectedPeople = useMemo(() => people.filter(person =>
    (department === "all" || person.department === department) && (personId === "all" || person.id === personId) &&
    (progress === "all" || (progress === "not_started" && person.progress === 0) ||
      (progress === "in_progress" && person.progress > 0 && person.progress < 100) ||
      (progress === "completed" && person.progress === 100))
  ), [people, department, personId, progress]);
  const selectedIds = useMemo(() => new Set(selectedPeople.map(person => person.id)), [selectedPeople]);
  const selectedCourses = useMemo(() => courses.filter(course => courseId === "all" || course.id === courseId), [courses, courseId]);

  const report = useMemo(() => {
    if (kind === "courses") {
      const headers = ["Colaborador", "E-mail", "Departamento", "Curso", "Aulas concluídas", "Total de aulas", "Progresso (%)", "Situação"];
      const rows = selectedPeople.flatMap(person => selectedCourses.map(course => {
        const done = state.teamProgress[person.id]?.[course.id] ?? (person.id === me.id ? state.completed[course.id] : []) ?? [];
        const lessons = course.lessons.filter(lesson => lesson.type !== "quiz");
        const finished = lessons.filter(lesson => done.includes(lesson.id)).length;
        const percent = courseProgress(course, done);
        return [person.name, person.email, person.department, course.title, String(finished), String(lessons.length), String(percent), percent === 100 ? "Concluído" : percent > 0 ? "Em andamento" : "Não iniciado"];
      }));
      return { headers, rows };
    }
    if (kind === "assessments") {
      const headers = ["Colaborador", "E-mail", "Departamento", "Curso", "Envio", "Nota (%)", "Nota mínima (%)", "Situação", "Questões", "Acertos", "Erros", "Feedback"];
      const byId = new Map(selectedPeople.map(person => [person.id, person]));
      const rows = state.attempts.filter(attempt => attempt.userId && selectedIds.has(attempt.userId) && (courseId === "all" || attempt.courseId === courseId))
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map(attempt => {
          const person = byId.get(attempt.userId!);
          const correct = attempt.questions.filter(question => question.type === "text"
            ? attempt.correctTextIds?.includes(question.id)
            : Boolean(question.correct && normalize(attempt.answers[question.id] ?? "") === normalize(question.correct))).length;
          return [person?.name ?? "", person?.email ?? "", person?.department ?? "", attempt.courseTitle,
            new Date(attempt.submittedAt).toLocaleDateString("pt-BR"), attempt.score === null ? "Pendente" : String(attempt.score),
            String(attempt.passingScore), attempt.status === "approved" ? "Aprovado" : attempt.status === "retry" ? "Nova tentativa" : "Aguardando correção",
            String(attempt.questions.length), String(correct), String(attempt.questions.length - correct), attempt.feedback];
        });
      return { headers, rows };
    }
    if (kind === "presence") {
      const headers = ["Colaborador", "E-mail", "Departamento", "Último acesso (Brasília)", `Dias com acesso (${engagement.days} dias)`, "Tempo ativo estimado", "Início da coleta"];
      const rows = selectedPeople.map(person => {
        const member = engagement.members.get(person.id);
        return [person.name, person.email, person.department, formatLastAccess(member?.lastAccessAt), String(member?.activeDays ?? 0), formatActiveTime(member?.activeSeconds ?? 0), formatLastAccess(engagement.data?.collectedSince)];
      });
      return { headers, rows };
    }
    const headers = ["Colaborador", "E-mail", "Departamento", "Situação", "Progresso geral (%)", "Aulas concluídas", "Avaliações", "Média das notas (%)", "XP da temporada"];
    const rows = selectedPeople.map(person => {
      const finished = courses.reduce((sum, course) => sum + course.lessons.filter(lesson => lesson.type !== "quiz" && (state.teamProgress[person.id]?.[course.id] ?? []).includes(lesson.id)).length, 0);
      const attempts = state.attempts.filter(attempt => attempt.userId === person.id && attempt.score !== null);
      const average = attempts.length ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.score ?? 0), 0) / attempts.length) : 0;
      return [person.name, person.email, person.department, person.status === "active" ? "Ativo" : "Pendente", String(person.progress), String(finished), String(attempts.length), attempts.length ? String(average) : "Sem avaliações", String(person.xp)];
    });
    return { headers, rows };
  }, [kind, selectedPeople, selectedCourses, courses, courseId, selectedIds, state.teamProgress, state.completed, state.attempts, me.id, engagement.days, engagement.members, engagement.data]);

  const exportCsv = () => {
    const csv = [report.headers, ...report.rows].map(row => row.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `demaria-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Relatório exportado.");
  };

  const canExport = report.rows.length > 0 && (kind !== "presence" || Boolean(engagement.data));
  const selectedCourseName = courses.find(course => course.id === courseId)?.title;
  const selectedPersonName = people.find(person => person.id === personId)?.name;
  const filterSummary = [
    department === "all" ? "Todos os departamentos da gestão" : department,
    selectedPersonName ?? "Todos os colaboradores",
    (kind === "courses" || kind === "assessments") ? selectedCourseName ?? "Todos os cursos" : null,
    progress === "all" ? "Qualquer progresso" : progress === "completed" ? "Concluído" : progress === "in_progress" ? "Em andamento" : "Não iniciado",
    kind === "presence" ? `Últimos ${engagement.days} dias` : null,
  ].filter(Boolean).join(" · ");

  return <div className="page-enter team-reports">
    <Link href="/equipe" className="team-back-link"><ArrowLeft size={16} /> Voltar para minha gestão</Link>
    <PageHeading eyebrow="MINHA GESTÃO · RELATÓRIOS" title="Gerador de relatórios" description="Escolha o que acompanhar, refine sua equipe e confira os dados antes de exportar." />
    <section className="panel team-report-section" aria-labelledby="report-type-title">
      <div className="section-heading"><div><h2 id="report-type-title">1. Escolha o relatório</h2><p>Os dados abrangem apenas os colaboradores da sua gestão.</p></div></div>
      <div className="team-report-choices">{choices.map(choice => <button key={choice.id} type="button" className={`team-report-choice ${kind === choice.id ? "selected" : ""}`} aria-pressed={kind === choice.id} onClick={() => setKind(choice.id)}><choice.icon size={20} /><strong>{choice.title}</strong><span>{choice.description}</span></button>)}</div>
    </section>
    <section className="panel team-report-section" aria-labelledby="report-filters-title">
      <div className="section-heading"><div><h2 id="report-filters-title">2. Defina os filtros</h2><p>Os filtros também serão aplicados ao arquivo exportado.</p></div></div>
      <div className="team-report-filters">
        <label>Departamento<select value={department} onChange={event => { setDepartment(event.target.value); setPersonId("all"); }}><option value="all">Todos da minha gestão</option>{departments.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Colaborador<select value={personId} onChange={event => setPersonId(event.target.value)}><option value="all">Todos os colaboradores</option>{people.filter(person => department === "all" || person.department === department).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        {(kind === "courses" || kind === "assessments") && <label>Curso<select value={courseId} onChange={event => setCourseId(event.target.value)}><option value="all">Todos os cursos</option>{courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>}
        <label>Progresso geral<select value={progress} onChange={event => setProgress(event.target.value)}><option value="all">Todos</option><option value="not_started">Não iniciado</option><option value="in_progress">Em andamento</option><option value="completed">Concluído</option></select></label>
        {kind === "presence" && <label>Período de presença<select value={engagement.days} onChange={event => engagement.setDays(Number(event.target.value) as 7 | 30)}><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option></select></label>}
      </div>
      {kind === "presence" && <p className="team-report-help">Presença é uma estimativa de uso com a página visível e em foco. Histórico anterior ao início da coleta não está disponível.</p>}
      {kind === "assessments" && <p className="team-report-help">Avaliações incluem todas as tentativas registradas até hoje.</p>}
    </section>
    <section className="panel team-report-section" aria-labelledby="report-preview-title">
      <div className="team-report-preview-heading"><div><h2 id="report-preview-title">3. Analise e exporte</h2><p>{report.rows.length} {report.rows.length === 1 ? "registro encontrado" : "registros encontrados"} · {selectedPeople.length} {selectedPeople.length === 1 ? "colaborador" : "colaboradores"}</p></div>
        <div className="team-report-actions"><Button variant="secondary" onClick={exportCsv} disabled={!canExport}><Download size={16} /> Baixar CSV</Button><Button onClick={() => window.print()} disabled={!canExport}><Printer size={16} /> Salvar em PDF</Button></div>
      </div>
      <p className="team-report-help team-report-pdf-help">“Salvar em PDF” abre a impressão do navegador com o panorama visual e todos os registros.</p>
      {kind === "presence" && (engagement.loading || engagement.error) && <p className="team-report-help" role="status">{engagement.loading ? "Carregando dados de presença…" : engagement.error}</p>}
      {kind === "presence" && !engagement.data ? null : report.rows.length ? <div className="team-report-print">
        <header className="team-report-print-header"><strong>Academia DeMaria</strong><span>Relatório gerado em {generatedOn}</span></header>
        <TeamReportVisual kind={kind} rows={report.rows} peopleCount={selectedPeople.length} days={engagement.days} />
        <p className="team-report-filter-summary"><strong>Filtros:</strong> {filterSummary}</p>
        <div className="team-report-table"><table><thead><tr>{report.headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{report.rows.map((row, index) => <tr className={index >= 20 ? "team-report-extra-row" : undefined} key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell || "—"}</td>)}</tr>)}</tbody></table></div>
        {report.rows.length > 20 && <p className="team-report-help team-report-preview-note">Prévia dos primeiros 20 registros. O PDF e o CSV incluem todos os {report.rows.length} registros.</p>}
      </div> : <EmptyState icon={<FileSpreadsheet size={28} />} title="Nenhum dado para estes filtros" description="Ajuste os filtros para gerar um relatório com registros." />}
    </section>
  </div>;
}
