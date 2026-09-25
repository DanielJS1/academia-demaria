"use client";

import { useEffect, useMemo, useState, type TouchEvent } from "react";
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Clock3, Pause, Play, Sparkles, Trophy, Zap } from "lucide-react";
import { browserAuth } from "@/lib/supabase-browser";
import { AnimatedButton } from "./ui/animated-button";
import { SonarGrid } from "./ui/sonar-grid";

type Resume = { title: string; lesson: string; minutes: number; position: number; href: string };
type Featured = { title: string; description: string; href: string };
type Ranking = { season: string; rank: number; gap: number; xp: number };
type Quiz = { id: string; title: string; xp_reward: number; expires_at: string | null; period_type: string; is_featured: boolean };
type Slide = { id: string; tone: string; eyebrow: string; title: string; description: string; href: string; action: string; meta: string; icon: typeof BookOpen; badge?: string };

const ROTATION_MS = 6500;

export function HeroCarousel({ resume, newCourse, ranking, article }: {
  resume?: Resume; newCourse?: Featured; ranking: Ranking; article?: Featured;
}) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadQuiz() {
      try {
        const session = await browserAuth()?.auth.getSession();
        const token = session?.data.session?.access_token;
        if (!token || controller.signal.aborted) return;
        const response = await fetch("/api/quizzes/active", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json() as { quizzes?: Quiz[] };
        setQuiz(data.quizzes?.find(item => item.is_featured) ?? data.quizzes?.find(item => item.period_type === "weekly") ?? data.quizzes?.[0] ?? null);
      } catch { /* O carrossel permanece útil quando os desafios estão indisponíveis. */ }
    }
    void loadQuiz();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(media.matches);
    const syncVisibility = () => setHidden(document.hidden);
    syncMotion(); syncVisibility();
    media.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => { media.removeEventListener("change", syncMotion); document.removeEventListener("visibilitychange", syncVisibility); };
  }, []);

  const slides = useMemo(() => {
    const items: Slide[] = [];
    if (resume) items.push({ id: "resume", tone: "mint", eyebrow: "CONTINUE SUA JORNADA", title: resume.title,
      description: `Sua próxima aula: ${resume.lesson}.`, href: resume.href, action: "Abrir aula", icon: BookOpen,
      meta: resume.position > 0 ? `Retomar em ${Math.floor(resume.position / 60).toString().padStart(2, "0")}:${Math.floor(resume.position % 60).toString().padStart(2, "0")} · Aula de ${resume.minutes} min` : `Aula de ${resume.minutes} min` });
    else items.push({ id: "start", tone: "mint", eyebrow: "CONTINUE SUA JORNADA", title: "Conhecimento que transforma você.",
      description: "Explore uma trilha e comece sua próxima conquista.", href: "/aprender", action: "Explorar cursos", icon: BookOpen, meta: "Seu próximo passo começa aqui" });
    if (quiz) {
      const remaining = quiz.expires_at ? new Date(quiz.expires_at).getTime() - Date.now() : null;
      const deadline = remaining === null ? "Disponível agora" : remaining <= 0 ? "Encerra em breve" : remaining < 86400000 ? `Restam ${Math.max(1, Math.ceil(remaining / 3600000))} h` : `Restam ${Math.ceil(remaining / 86400000)} dias`;
      const quizSlide: Slide = { id: "quiz", tone: "violet", eyebrow: quiz.period_type === "weekly" ? "DESAFIO DA SEMANA" : "DESAFIO EM DESTAQUE", title: quiz.title,
        description: "Teste seus conhecimentos e avance na temporada.", href: `/desafios/${quiz.id}`, action: "Encarar desafio", icon: Zap,
        meta: deadline, badge: `+${quiz.xp_reward} XP` };
      if (quiz.is_featured) items.unshift(quizSlide); else items.push(quizSlide);
    }
    if (newCourse) items.push({ id: "course", tone: "blue", eyebrow: "NOVO CURSO", title: newCourse.title,
      description: newCourse.description, href: newCourse.href, action: "Conhecer curso", icon: Sparkles, meta: "Disponível no catálogo", badge: "Novo" });
    items.push({ id: "season", tone: "amber", eyebrow: `TEMPORADA ${ranking.season}`, title: ranking.rank > 0 && ranking.rank <= 5 ? "Você está no Top 5!" : "Seu lugar no Top 5 espera por você.",
      description: ranking.rank > 5 ? `Faltam ${ranking.gap} XP para alcançar o quinto lugar.` : "Continue aprendendo para manter sua posição na temporada.",
      href: "/conquistas#ranking", action: "Ver ranking", icon: Trophy, meta: ranking.rank ? `${ranking.rank}º lugar · ${ranking.xp} XP` : `${ranking.xp} XP na temporada` });
    if (article) items.push({ id: "article", tone: "rose", eyebrow: "BIBLIOTECA EM ALTA", title: article.title,
      description: article.description, href: article.href, action: "Ler artigo", icon: BookOpen, meta: "Da nossa equipe técnica" });
    return items.slice(0, 5);
  }, [resume, quiz, newCourse, ranking, article]);

  const selected = slides[active % slides.length];
  const paused = hovered || focused || stopped || hidden || reducedMotion;

  useEffect(() => { setActive(index => Math.min(index, slides.length - 1)); }, [slides.length]);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const timer = window.setTimeout(() => setActive(index => (index + 1) % slides.length), ROTATION_MS);
    return () => window.clearTimeout(timer);
  }, [active, paused, slides.length]);

  function navigate(index: number) {
    const next = (index + slides.length) % slides.length;
    setActive(next);
    setAnnouncement(`Destaque ${next + 1} de ${slides.length}: ${slides[next].title}`);
  }

  function endTouch(event: TouchEvent<HTMLDivElement>) {
    if (!touchStart) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) navigate(active + (dx < 0 ? 1 : -1));
    setTouchStart(null);
  }

  return <SonarGrid className={`hero hero-carousel hero-carousel--${selected.tone}`} color="#818cf8" baseOpacity={0.22} spacing={26} dotRadius={1.4} speed={240} ringWidth={85} amplitude={2.2} pingEvery={3.5} interactive={true}
    role="region" aria-roledescription="carrossel" aria-label="Destaques da página inicial"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
    onTouchStart={event => setTouchStart({ x: event.touches[0].clientX, y: event.touches[0].clientY })} onTouchEnd={endTouch}>
    <div className="hero-slide" key={selected.id} role="group" aria-roledescription="slide" aria-label={`${active + 1} de ${slides.length}`}>
      <div className="hero-slide-copy">
        <div className="hero-slide-eyebrow"><span className="hero-slide-spark" aria-hidden="true"/> {selected.eyebrow}</div>
        <h2>{selected.title}</h2>
        <p>{selected.description}</p>
        <div className="hero-slide-actions"><AnimatedButton href={selected.href}>{selected.action} <ArrowRight size={17} aria-hidden="true"/></AnimatedButton><span className="hero-slide-meta"><Clock3 size={15} aria-hidden="true"/>{selected.meta}</span></div>
      </div>
      <div className="hero-slide-art" aria-hidden="true"><div className="hero-slide-orbit"><selected.icon size={62} strokeWidth={1.5}/></div>{selected.badge && <span className="hero-slide-badge">{selected.badge}</span>}</div>
    </div>
    {slides.length > 1 && <div className="hero-carousel-controls">
      <div className="hero-carousel-dots" role="group" aria-label="Escolher destaque">{slides.map((slide, index) => <button key={slide.id} type="button"
        className={`hero-carousel-dot${index === active ? " is-active" : ""}`} onClick={() => navigate(index)}
        aria-label={`Mostrar destaque ${index + 1}: ${slide.eyebrow}`} aria-current={index === active ? "true" : undefined}><span className="hero-carousel-dot-fill" style={{ animationDuration: `${ROTATION_MS}ms`, animationPlayState: paused ? "paused" : "running" }}/></button>)}</div>
      <div className="hero-carousel-buttons"><button type="button" onClick={() => setStopped(value => !value)} aria-label={stopped ? "Retomar rotação automática" : "Pausar rotação automática"}>{stopped ? <Play size={16} aria-hidden="true"/> : <Pause size={16} aria-hidden="true"/>}</button>
        <button type="button" onClick={() => navigate(active - 1)} aria-label="Destaque anterior"><ChevronLeft size={18} aria-hidden="true"/></button>
        <button type="button" onClick={() => navigate(active + 1)} aria-label="Próximo destaque"><ChevronRight size={18} aria-hidden="true"/></button></div>
    </div>}
    <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
  </SonarGrid>;
}
