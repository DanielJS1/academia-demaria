"use client";
import Link from "next/link";
import { Route, CalendarDays, CheckCircle2, ArrowRight } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { useTrails } from "./trails-provider";
import { EmptyState, PageHeading } from "../shared";
import { Button } from "../ui/button";
import { daysUntil, formatTrailDate } from "@/lib/trails";
import { isCourseComplete } from "@/lib/rewards";
import { DiscordConnection } from "./discord-connection";
export function MyTrails() {
  const { state, me, isClientEnvironment } = useAcademy(); const { data, loading, error, refresh } = useTrails();
  if (isClientEnvironment) return <EmptyState title="Trilhas internas" description="Este espaço é destinado aos colaboradores DeMaria."/>;
  const assignments = data?.assignments.filter(a => a.userId === me.id && a.active).sort((a, b) => Number(a.complete) - Number(b.complete) || a.dueDate.localeCompare(b.dueDate)) ?? [];
  return <div className="page-enter trails-page my-trails-page"><PageHeading variant="compact" eyebrow="APRENDER COM DIREÇÃO" title="Minhas trilhas" description="Seus cursos, metas e prazos em um só lugar."><Button asChild variant="secondary"><Link href="/aprender">Todos os cursos</Link></Button></PageHeading>
    {loading && <p role="status">Carregando trilhas…</p>}{error && <section className="panel"><p role="alert">{error}</p><Button onClick={() => void refresh()}>Tentar novamente</Button></section>}
    {data && !assignments.length && <EmptyState title="Seu próximo caminho" description="Quando uma trilha for atribuída a você, ela aparecerá aqui."/>}
    <div className="trail-grid">{assignments.map(a => <section className="panel trail-card" key={a.id}>
      <div className="trail-card-heading"><Route aria-hidden="true" size={22}/><span className={`trail-status ${!a.complete && daysUntil(a.dueDate) < 0 ? "late" : ""}`}>{a.complete ? "Concluída" : daysUntil(a.dueDate) < 0 ? "Prazo vencido" : "Em andamento"}</span></div>
      <h2>{a.title}</h2><p><CalendarDays size={16} aria-hidden="true"/> Até {formatTrailDate(a.dueDate)}</p>
      <progress value={a.progress} max={100} aria-label={`Progresso de ${a.title}`}/><p>{a.completedCourses} de {a.totalCourses} cursos concluídos · {a.progress}%</p>
      <ol className="trail-course-list">{a.courseIds.map(id => {
        const course = state.courses.find(c => c.id === id), complete = course && isCourseComplete(course, state, me.id);
        return <li key={id}><span>{course?.title ?? "Curso indisponível — fale com seu gestor"}</span>{complete ? <CheckCircle2 size={18} aria-label="Concluído"/> : course && <Link href={`/aprender/${encodeURIComponent(id)}/aula`} aria-label={`Estudar ${course.title}`}><ArrowRight size={18}/></Link>}</li>;
      })}</ol>
    </section>)}</div>
    <DiscordConnection key={me.id}/>
  </div>;
}
