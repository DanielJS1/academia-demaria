"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Bookmark, BookOpen, Check, Clock3, FileStack, Headphones, Layers3, LockKeyhole, Monitor, Play, ScanLine, Sparkles } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { Button } from "./ui/button";
import { courseProgress, minutes, type Course } from "@/lib/model";
import { isCourseComplete } from "@/lib/rewards";
export function PageHeading({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description: string; children?: ReactNode }) { return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div>{children && <div className="heading-actions">{children}</div>}</div>; }
export function SectionHeading({ title, description, href, link = "Ver todos" }: { title: string; description?: string; href?: string; link?: string }) { return <div className="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{href && <Link className="text-link" href={href}>{link}<ArrowRight size={16}/></Link>}</div>; }
export function Progress({ value, label }: { value: number; label?: string }) { return <div className="progress-track" role="progressbar" aria-label={label || "Progresso"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span style={{ width: `${value}%` }}/></div>; }
export function CourseArt({ course, large = false }: { course: Course; large?: boolean }) {
  const Icon = ({ violet: Monitor, mint: ScanLine, peach: Headphones, blue: FileStack, pink: LockKeyhole, slate: Layers3 })[course.accent];
  return <div className={`course-art art-${course.accent} ${large ? "art-large" : ""}`} aria-hidden="true">{course.banner ? <img src={course.banner} alt="" className="course-banner-image" onError={event => { event.currentTarget.style.display = "none"; }}/>: null}<div className="art-grid"/><span className="art-brand">DOC-<span>Academy</span></span><span className="art-edition">{course.category.toUpperCase()}</span><div className="art-composition"><span className="art-orbit"/>{course.logoUrl ? <img src={course.logoUrl} alt={course.product || course.title} className="art-custom-logo" onError={event => { event.currentTarget.style.display = "none"; }}/> : <><span className="art-sheet sheet-back"/><span className="art-sheet sheet-front"><Icon size={40} strokeWidth={1.3}/><i/><i/></span></>}<span className="art-spark"><Sparkles size={17}/></span><span className="art-dot"/></div><span className="art-product">{course.product}</span><span className="art-corner"><ArrowRight size={18}/></span></div>;
}
export function CourseCard({ course }: { course: Course }) {
  const { state, update, notify, me } = useAcademy();
  const progress = courseProgress(course, state.completed[course.id] || []);
  const saved = state.bookmarks.includes(course.id);
  const completed = isCourseComplete(course, state, me.id);
  return (
    <article className="course-card">
      <Link href={`/aprender/${course.id}`} className="course-card-main">
        <CourseArt course={course}/>
        <div className="course-card-body">
          <div className="course-card-meta">
            <span>{course.level}</span>
            {completed ? (
              <span className="completed-label"><Check size={12}/> Concluído</span>
            ) : course.required ? (
              <span className="required-label">Essencial para você</span>
            ) : progress > 0 ? (
              <span className="progress-label">Em andamento</span>
            ) : null}
          </div>
          <h3>{course.title}</h3>
          <div className="course-duration">
            <span><Clock3 size={13}/>{minutes(course)} min</span>
            <span><BookOpen size={13}/>{course.lessons.length} atividades</span>
          </div>
          {progress > 0 ? (
            <div className="card-progress">
              <div>
                <span>{completed ? "Curso concluído" : progress === 100 ? "Aulas concluídas" : "Em andamento"}</span>
                <strong className={completed ? "completed-percent" : ""}>{progress}%</strong>
              </div>
              <Progress value={progress} label={`Progresso em ${course.title}`}/>
            </div>
          ) : (
            <div className="card-start">
              <span>Começar a jornada</span>
              <ArrowRight size={16}/>
            </div>
          )}
        </div>
      </Link>
      <Button
        className={`bookmark-button ${saved ? "is-saved" : ""}`}
        size="icon"
        variant="secondary"
        aria-label={`${saved ? "Remover dos salvos" : "Salvar curso"}: ${course.title}`}
        aria-pressed={saved}
        onClick={async () => {
          const success = await update(current => ({
            ...current,
            bookmarks: saved ? current.bookmarks.filter(id => id !== course.id) : [...current.bookmarks, course.id]
          }));
          if (success) notify(saved ? "Curso removido dos salvos." : "Curso salvo para estudar depois.");
        }}
      >
        <Bookmark size={16} fill={saved ? "currentColor" : "none"}/>
      </Button>
    </article>
  );
}
export function EmptyState({ icon = <BookOpen size={28}/>, title, description, children }: { icon?: ReactNode; title: string; description: string; children?: ReactNode }) { return <div className="empty-state"><span className="empty-icon">{icon}</span><h2>{title}</h2><p>{description}</p>{children}</div>; }
export function CheckLabel({ children }: { children: ReactNode }) { return <span className="check-label"><Check size={15}/>{children}</span>; }
export function StudyButton({ course, children }: { course: Course; children?: ReactNode }) { const { state } = useAcademy(); const lesson = course.lessons.find(item => !(state.completed[course.id] || []).includes(item.id)); return <Button asChild><Link href={`/aprender/${course.id}/aula${lesson ? `?aula=${lesson.id}` : ""}`}><Play size={16} fill="currentColor"/>{children || "Continuar aprendendo"}</Link></Button>; }
