"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Award, BookOpen, CheckCircle2, Clock3, FileText, PlayCircle, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { CourseArt, EmptyState, CheckLabel } from "./shared";
import { AnimatedButton } from "./ui/animated-button";
import { minutes, courseProgress } from "@/lib/model";
import { QuizRunner } from "./quiz-runner";
import { Button } from "./ui/button";

export function CourseDetail({ id }: { id: string }) {
  const { state, me, ready } = useAcademy();
  const [showProficiency, setShowProficiency] = useState(false);

  const course = state.courses.find(item => item.id === id && item.status === "published");
  if (!ready) return <div className="empty-state">Preparando sua jornada…</div>;
  if (!course) return <EmptyState title="Este curso ainda não está disponível" description="Explore os cursos publicados no catálogo." />;

  const completed = state.completed[id] || [];
  const progress = courseProgress(course, completed);
  const isComplete = progress === 100;
  const nextLesson = course.lessons.find(item => !completed.includes(item.id));

  // Perguntas para a prova de proficiência
  const proficiencyQuestions = (course.proficiencyQuestions && course.proficiencyQuestions.length > 0)
    ? course.proficiencyQuestions
    : course.lessons.flatMap(l => l.questions || []);

  if (showProficiency) {
    return (
      <div className="page-enter" style={{ maxWidth: 860, margin: "0 auto", paddingTop: 10 }}>
        <Button variant="ghost" size="sm" onClick={() => setShowProficiency(false)} style={{ marginBottom: 16 }}>
          <ArrowLeft size={15} /> Voltar aos detalhes do curso
        </Button>
        <QuizRunner
          course={course}
          questions={proficiencyQuestions}
          isProficiency={true}
          passingScore={course.proficiencyScore || 85}
          onCancel={() => setShowProficiency(false)}
        />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <Link className="back-link" href="/aprender">
        <ArrowLeft size={15} /> Voltar ao catálogo
      </Link>

      <section className="course-detail-hero panel">
        <div className="course-detail-art"><CourseArt course={course} large /></div>
        <div className="course-detail-intro">
          <div>
            <span className="pill">{course.category}</span>
            <h1>{course.title}</h1>
            <div className="detail-metrics">
              <span><Clock3 size={15} />{minutes(course)} min</span>
              <span><BookOpen size={15} />{course.lessons.length} atividades</span>
              <span><Zap size={15} />Até {course.xp} XP</span>
              <span><Award size={15} />{course.department || course.author}</span>
            </div>
          </div>
          <div className="course-detail-actions">
            <AnimatedButton href={`/aprender/${course.id}/aula${nextLesson ? `?aula=${nextLesson.id}` : ""}`}>
              {completed.length ? "Continuar aprendendo" : "Começar minha jornada"}<ArrowRight size={17} />
            </AnimatedButton>
            {course.hasProficiencyTest && !isComplete && (
              <Button
                variant="secondary"
                onClick={() => setShowProficiency(true)}
                title="Fazer prova de proficiência e liberar todas as aulas de imediato"
              >
                <Sparkles size={15} /> Prova de Proficiência
              </Button>
            )}
          </div>

        {course.hasProficiencyTest && !isComplete && (
          <div className="info-note" style={{ marginTop: 16, background: "var(--lavender)", borderColor: "var(--primary)" }}>
            <Sparkles size={15} style={{ color: "var(--primary)", verticalAlign: "middle", marginRight: 6 }} />
            <strong>Já domina este conteúdo?</strong> Faça a <strong>Prova de Proficiência</strong> (acerto &ge; {course.proficiencyScore || 85}%). Você dispensa as aulas e recebe todo o XP acumulado e o bônus de conclusão imediatamente.
          </div>
        )}
        </div>
      </section>

      {/* 3. Bloco intermediário: Descrição do curso lado a lado com 'Aprender e evoluir' */}
      <div className="detail-grid" style={{ marginBottom: 24 }}>
        <section className="detail-section panel" style={{ marginTop: 0 }}>
          <h2>Sobre o curso</h2>
          <p className="prose" style={{ lineHeight: 1.8, fontSize: 13 }}>{course.description}</p>
          <div className="info-note" style={{ marginTop: 22 }}>
            Conteúdo publicado pela DeMaria. Seu progresso e suas avaliações ficam salvos na sua conta.
          </div>
        </section>

        <section className="detail-section panel" style={{ marginTop: 0 }}>
          <h2>Aprender e evoluir</h2>
          <CheckLabel>Acesso livre ao conteúdo interno publicado</CheckLabel>
          <CheckLabel>Retomada da sequência de atividades</CheckLabel>
          <CheckLabel>
            {course.lessons.some(l => l.type === "quiz") ? "Avaliação com feedback do administrador" : "Curso sem avaliação"}
          </CheckLabel>
          <CheckLabel>XP por aula e +30 XP pela conclusão</CheckLabel>
          <div className="info-note">
            <ShieldCheck size={17} /><strong> Cada etapa conta.</strong><br />
            {course.lessons.some(l => l.type === "quiz")
              ? `Nota mínima: ${course.passingScore}%. Acertos valem 5 XP (objetiva) ou 8 XP (dissertativa). Aprovação: +30 XP na primeira tentativa, +10 XP após reprovação.`
              : "Conclua todas as aulas para finalizar o curso e receber o bônus de 30 XP."}
          </div>
        </section>
      </div>

      {/* 4. Base: Seu caminho neste curso em largura total abaixo da descrição */}
      <section className="detail-section panel" style={{ marginTop: 0 }}>
        <h2>Seu caminho neste curso</h2>
        <div className="course-program">
          {course.lessons.map((lesson, position) => (
            <div key={lesson.id}>
              {lesson.module && course.lessons[position - 1]?.module !== lesson.module && (
                <h3 className="module-title">{lesson.module}</h3>
              )}
              <Link className="program-row" href={`/aprender/${id}/aula?aula=${lesson.id}`} key={lesson.id}>
                {completed.includes(lesson.id) ? (
                  <CheckCircle2 size={17} />
                ) : lesson.type === "video" ? (
                  <PlayCircle size={17} />
                ) : (
                  <FileText size={17} />
                )}
                <span>{lesson.title}</span>
                <span>{lesson.minutes} min</span>
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
