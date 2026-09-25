"use client";
import { isCourseComplete } from "@/lib/rewards";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Award, BookOpen, Check, ChevronRight, Flame, GraduationCap, Sparkles, Target, Trophy, Zap } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { Button } from "./ui/button";
import { CourseArt, EmptyState, PageHeading, SectionHeading } from "./shared";
import { experience, DEMO_SEASON } from "@/lib/gamification";
import { courseProgress } from "@/lib/model";
import { ClientDashboard } from "./client-dashboard";
import { initials, number } from "@/lib/utils";
import { HeroCarousel } from "./hero-carousel";
export function Dashboard() {
  const { state, me, isClientEnvironment, activeCartorio, avatar } = useAcademy();
  if (isClientEnvironment && activeCartorio) {
    return <ClientDashboard cartorio={activeCartorio} />;
  }
  const courses = state.courses.filter(course => course.status === "published" && course.audience !== "client");
  const continuing = courses.filter(course => !isCourseComplete(course, state, me.id)).map(course => {
    const completed = state.completed[course.id] || [];
    const paused = Object.entries(state.videoProgress[course.id] || {}).filter(([id, progress]) => progress.position > 0 && !completed.includes(id) && course.lessons.some(lesson => lesson.id === id));
    paused.sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt));
    const lesson = paused.length ? course.lessons.find(item => item.id === paused[0][0]) : course.lessons.find(item => !completed.includes(item.id));
    return { course, lesson, position: paused[0]?.[1].position || 0, updatedAt: paused[0]?.[1].updatedAt || "", started: paused.length > 0 || completed.length > 0 };
  }).filter(item => item.started && item.lesson).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);
  const formatPosition = (seconds: number) => { const value = Math.floor(seconds); const minutes = Math.floor(value / 60); return `${String(minutes).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; };
  const active = courses.filter(course => ((state.completed[course.id] || []).length > 0 || Object.values(state.videoProgress[course.id] || {}).some(item => item.position > 0)) && !isCourseComplete(course, state, me.id));
  const progress = active.length ? Math.round(active.reduce((sum, course) => sum + courseProgress(course, state.completed[course.id] || []), 0) / active.length) : 0;
  const evolution = experience(state); const xp = evolution.total; const approved = courses.filter(course => isCourseComplete(course, state, me.id));
  const journeyProgress = courses.length ? Math.round(approved.length / courses.length * 100) : 0;
  const people = state.people.filter(person => person.status === "active" && person.audience !== "client").map(person => person.id === me.id ? { ...person, xp: evolution.annual } : person).sort((a, b) => b.xp - a.xp);
  const nextUp = continuing[0];
  const heroResume = nextUp?.lesson ? { title: nextUp.course.title, lesson: nextUp.lesson.title, minutes: nextUp.lesson.minutes, position: nextUp.position,
    href: `/aprender/${encodeURIComponent(nextUp.course.id)}/aula?aula=${encodeURIComponent(nextUp.lesson.id)}${nextUp.position > 0 ? `&t=${Math.floor(nextUp.position)}` : ""}` } : undefined;
  const recentCourse = courses.find(course => course.version === 1 && !(state.completed[course.id] || []).length);
  const featuredCourse = recentCourse ? { title: recentCourse.title, description: recentCourse.description.slice(0, 145), href: `/aprender/${encodeURIComponent(recentCourse.id)}` } : undefined;
  const rank = people.findIndex(person => person.id === me.id) + 1;
  const heroRanking = { season: DEMO_SEASON, rank, xp: evolution.annual, gap: Math.max(0, (people[4]?.xp ?? 0) - evolution.annual + 1) };
  const topArticle = [...state.articles].filter(article => article.status === "published" && article.community).sort((a, b) =>
    (b.likeCount ?? 0) - (a.likeCount ?? 0) || b.updatedAt.localeCompare(a.updatedAt))[0];
  const featuredArticle = topArticle ? { title: topArticle.title, description: topArticle.summary || topArticle.category,
    href: `/conhecimento/${encodeURIComponent(topArticle.id)}` } : undefined;
  return <div className="page-enter"><PageHeading title={`Bom te ver por aqui, ${me.name.split(" ")[0]}`} description="Cada aprendizado é um passo para ir além."><span className="season-pill"><span/> Temporada {DEMO_SEASON} <Sparkles size={14}/></span></PageHeading>
    <div className="welcome-grid"><HeroCarousel resume={heroResume} newCourse={featuredCourse} ranking={heroRanking} article={featuredArticle}/>
    <section className="journey-card panel"><div className="section-title"><h3>Sua jornada</h3><span className="icon-muted"><Target size={18}/></span></div><div className="journey-ring"><svg viewBox="0 0 140 140" aria-hidden="true"><circle className="ring-track" cx="70" cy="70" r="58"/><circle className="ring-fill" cx="70" cy="70" r="58" strokeDasharray={`${journeyProgress * 3.644} 364.4`} transform="rotate(-90 70 70)"/></svg><div><strong>{journeyProgress}<small>%</small></strong><span>cursos feitos</span></div></div><div className="journey-stats"><div className="journey-stat-row"><div className="journey-stat-info"><span className="mini-icon violet"><BookOpen size={16}/></span><span>Em andamento</span></div><strong>{active.length}</strong></div><div className="journey-stat-row"><div className="journey-stat-info"><span className="mini-icon mint"><Award size={16}/></span><span>{approved.length === 1 ? "Curso concluído" : "Cursos concluídos"}</span></div><strong>{approved.length}</strong></div><div className="journey-stat-row"><div className="journey-stat-info"><span className="mini-icon violet"><GraduationCap size={16}/></span><span>Cursos restantes</span></div><strong>{Math.max(0, courses.length - approved.length)}</strong></div></div><Link href="/conquistas" className="journey-link">Ver minha evolução <ArrowUpRight size={16}/></Link></section></div>
    <div className="metric-strip"><div><span className="metric-icon"><Zap size={20}/></span><span><small>Experiência acumulada</small><strong>{number(xp)} <em>XP</em></strong></span><span className="metric-tag">Sua trajetória</span></div><div><span className="metric-icon"><GraduationCap size={22}/></span><span><small>Aprender, a cada passo</small><strong>Nível {evolution.level} <em>· Explorador</em></strong></span></div><div><span className="metric-icon"><Trophy size={20}/></span><span><small>Conquista da temporada</small><strong>{evolution.tier.name} <em>· {DEMO_SEASON}</em></strong></span><Link href="/conquistas" aria-label="Conhecer metas da temporada"><ChevronRight size={20}/></Link></div></div>
    <section className="dashboard-courses"><SectionHeading title="Continue de onde parou" description="Seu próximo aprendizado está logo aqui." href="/aprender" link="Explorar catálogo"/>{continuing.length ? <div className="course-grid">{continuing.map(({course,lesson,position}) => <article className="course-card" key={course.id}><Link className="course-card-main" href={`/aprender/${course.id}/aula?aula=${encodeURIComponent(lesson!.id)}${position>0?`&t=${Math.floor(position)}`:""}`}><CourseArt course={course}/><div className="course-card-body"><span className="progress-label">Em andamento</span><h3>{course.title}</h3><p className="resume-lesson">{lesson!.title}</p><div className="card-start"><span>{position>0?`Retomar em ${formatPosition(position)}`:"Continuar aula"}</span><ArrowRight size={16}/></div></div></Link></article>)}</div> : <EmptyState title="Sua jornada começa aqui" description="Você ainda não iniciou nenhuma aula. Explore o catálogo para encontrar seu primeiro curso."><Button asChild variant="secondary"><Link href="/aprender">Explorar cursos <ArrowRight size={15}/></Link></Button></EmptyState>}</section>
    <div className="dashboard-bottom"><section className="knowledge-callout"><div className="knowledge-symbol"><Sparkles size={26}/></div><span className="eyebrow">CONHECIMENTO AO SEU ALCANCE</span><h2>Uma dúvida. Novas possibilidades.</h2><p>Encontre os guias e materiais que ajudam você<br className="desktop-only"/> a seguir em frente, no seu ritmo.</p><Button asChild variant="secondary"><Link href="/conhecimento">Explorar conhecimento <ArrowRight size={16}/></Link></Button><div className="knowledge-lines" aria-hidden="true"><i/><i/><i/></div><span className="coming-label">Consulta com IA em preparação</span></section><section className="ranking-card panel"><SectionHeading title="Quem está indo além" href="/conquistas#ranking" link="Ver ranking completo"/><div className="ranking-subtitle"><Trophy size={14}/> Top 5 da temporada <span>XP de aprendizado</span></div>{people.slice(0, 5).map((person, index) => { const personAvatar = person.avatar || (person.id === me.id ? avatar : undefined); return <div className="ranking-row" key={person.id}><span className={`rank-position rank-${index + 1}`}>{index === 0 ? <Trophy size={15}/> : String(index + 1).padStart(2, "0")}</span><span className={`avatar avatar-${index}`} style={{ overflow: "hidden", padding: 0 }}>{personAvatar ? <img src={personAvatar} alt={person.name} className="avatar-img" /> : initials(person.name)}</span><span className="ranking-name"><strong>{person.name}</strong><small>{person.department}</small></span><span className="ranking-xp">{number(person.xp)} <small>XP</small></span></div>; })}</section></div>
    <div className="bottom-note"><span><Check size={16}/> Seu aprendizado, no seu ritmo.</span><p>As pequenas descobertas de hoje constroem as grandes conquistas de amanhã.</p><Flame size={18}/></div>
  </div>;
}


