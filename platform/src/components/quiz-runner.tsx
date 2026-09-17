"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Award, Check, CheckCircle2, ChevronLeft, ChevronRight, HelpCircle, MessageSquare, Send, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { useAcademy } from "./academy-provider";
import { completeActivity, type Course, type Question } from "@/lib/model";
import { lessonXp, COURSE_BONUS, APPROVAL_BONUS } from "@/lib/rewards";

export function QuizRunner({
  course,
  questions,
  quizId,
  isProficiency = false,
  passingScore = 85,
  preview = false,
  onComplete,
  onCancel,
}: {
  course: Course;
  questions: Question[];
  quizId?: string;
  isProficiency?: boolean;
  passingScore?: number;
  preview?: boolean;
  onComplete?: (result: { passed: boolean; score: number }) => void;
  onCancel?: () => void;
}) {
  const { me, update, mutate, notify, busy } = useAcademy();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittedResult, setSubmittedResult] = useState<{ passed: boolean; score: number; feedback?: string } | null>(null);

  if (!questions || questions.length === 0) {
    return (
      <div className="panel" style={{ padding: 30, textAlign: "center" }}>
        <HelpCircle size={32} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
        <h3>Nenhuma pergunta cadastrada</h3>
        <p style={{ color: "var(--muted)", fontSize: 12 }}>Esta avaliação ainda não possui questões configuradas.</p>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} style={{ marginTop: 16 }}>
            Voltar
          </Button>
        )}
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const currentAnswer = answers[currentQ.id] || "";
  const currentComment = answers[`${currentQ.id}__comment`] || "";
  const isCurrentAnswered = !!currentAnswer.trim();
  const allAnswered = questions.every(q => answers[q.id] && answers[q.id].trim().length > 0);
  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);

  const handleSelectChoice = (option: string) => {
    setAnswers(prev => ({ ...prev, [currentQ.id]: option }));
  };

  const handleTextAnswer = (text: string) => {
    setAnswers(prev => ({ ...prev, [currentQ.id]: text }));
  };

  const handleComment = (comment: string) => {
    setAnswers(prev => ({ ...prev, [`${currentQ.id}__comment`]: comment }));
  };

  const nextQuestion = () => {
    if (!isCurrentAnswered) {
      notify("Por favor, responda a pergunta antes de avançar.");
      return;
    }
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allAnswered) {
      notify("Responda todas as perguntas antes de finalizar.");
      return;
    }

    if (preview) {
      notify("Prévia: envio testado com sucesso (nenhum XP ou progresso registrado).");
      if (onComplete) onComplete({ passed: true, score: 100 });
      return;
    }

    if (isProficiency) {
      // Prova de Proficiência: correção imediata das questões com gabarito
      let totalQuestions = questions.length;
      let correctCount = 0;

      for (const q of questions) {
        if (q.type === "choice" && answers[q.id] === q.correct) {
          correctCount++;
        } else if (q.type === "text" && answers[q.id]?.trim().length >= 10) {
          // Na proficiência rápida, dissertativas com resposta substantiva contam como acerto provisório
          correctCount++;
        }
      }

      const score = Math.round((correctCount / totalQuestions) * 100);
      const passed = score >= passingScore;

      if (passed) {
        // Marca todas as aulas do curso como concluídas!
        await update(current => {
          let updatedState = current;
          for (const l of course.lessons) {
            if (l.type !== "quiz") {
              updatedState = completeActivity(updatedState, course.id, l.id);
            }
          }
          return updatedState;
        });

        // Submete a tentativa de avaliação para registrar aprovação formal
        await mutate({
          type: "submit",
          courseId: course.id,
          version: course.version,
          quizId: quizId || course.lessons.find(l => l.type === "quiz")?.id || "proficiency",
          answers: { ...answers },
        });

        setSubmittedResult({
          passed: true,
          score,
          feedback: `Parabéns! Você alcançou ${score}% de aproveitamento (mínimo ${passingScore}%), comprovando proficiência integral neste curso. Todas as aulas foram concluídas e seu XP foi liberado!`,
        });
        notify(`Proficiência aprovada com ${score}%! Todo o XP do curso foi desbloqueado.`);
      } else {
        setSubmittedResult({
          passed: false,
          score,
          feedback: `Você obteve ${score}% de acertos. Para obter a dispensa por proficiência, é necessário atingir no mínimo ${passingScore}%. Você pode realizar o curso assistindo às aulas na sequência normal, sem nenhum prejuízo ao seu aprendizado.`,
        });
        notify(`Resultado: ${score}%. O mínimo para proficiência é ${passingScore}%.`);
      }

      if (onComplete) onComplete({ passed, score });
      return;
    }

    // Avaliação regular da sala de aula
    const success = await mutate({
      type: "submit",
      courseId: course.id,
      version: course.version,
      quizId: quizId || "quiz",
      answers: { ...answers },
    });

    if (success) {
      notify("Avaliação enviada com sucesso para correção!");
      if (onComplete) onComplete({ passed: true, score: 0 });
    }
  };

  // Se já concluiu a proficiência na tela atual
  if (submittedResult) {
    return (
      <section className="panel quiz-runner-result" style={{ padding: 32, textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "inline-flex", padding: 18, borderRadius: "50%", background: submittedResult.passed ? "var(--lavender)" : "#fff5f5", marginBottom: 16 }}>
          {submittedResult.passed ? <Sparkles size={40} style={{ color: "var(--primary)" }} /> : <AlertCircle size={40} style={{ color: "#e53e3e" }} />}
        </div>
        <span className={`pill ${submittedResult.passed ? "green" : ""}`}>
          {submittedResult.passed ? "PROFICIÊNCIA CONQUISTADA" : "TENTATIVA DE PROFICIÊNCIA"}
        </span>
        <h2 style={{ fontSize: 24, margin: "16px 0 8px" }}>
          {submittedResult.passed ? "Domínio Comprovado!" : "Quase lá!"}
        </h2>
        <div style={{ fontSize: 44, fontWeight: 700, margin: "12px 0", color: submittedResult.passed ? "var(--primary)" : "#e53e3e" }}>
          {submittedResult.score}%
          <small style={{ fontSize: 16, color: "var(--muted)", fontWeight: 400 }}> / 100%</small>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8, maxWidth: 500, margin: "0 auto 24px" }}>
          {submittedResult.feedback}
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          {onCancel && (
            <Button variant={submittedResult.passed ? "primary" : "secondary"} onClick={onCancel}>
              {submittedResult.passed ? "Continuar jornada" : "Voltar e assistir aulas"}
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="quiz-runner-container">
      {/* Header com Progresso */}
      <div className="quiz-runner-header">
        <div className="quiz-runner-title-meta">
          <span className="pill">{isProficiency ? "PROVA DE PROFICIÊNCIA" : "AVALIAÇÃO DE APRENDIZADO"}</span>
          <span className="quiz-counter">
            Questão <strong>{currentIndex + 1}</strong> de {questions.length}
          </span>
        </div>
        <div className="quiz-runner-progressbar" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
          <div className="quiz-runner-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Pergunta atual */}
      <form onSubmit={handleSubmit} className="quiz-card panel">
        <div className="quiz-question-body">
          <div className="quiz-question-number-badge">Questão {currentIndex + 1}</div>
          <h2 className="quiz-question-prompt">{currentQ.prompt}</h2>

          {/* Área de Resposta */}
          <div className="quiz-options-area">
            {currentQ.type === "choice" ? (
              <div className="quiz-choices-grid">
                {currentQ.options.map(option => {
                  const isSelected = currentAnswer === option;
                  return (
                    <label
                      key={option}
                      className={`choice-card ${isSelected ? "is-selected" : ""}`}
                      onClick={() => handleSelectChoice(option)}
                    >
                      <input
                        type="radio"
                        name={currentQ.id}
                        value={option}
                        checked={isSelected}
                        onChange={() => handleSelectChoice(option)}
                      />
                      <span className="choice-text">{option}</span>
                      {isSelected && <Check size={16} className="choice-check-icon" />}
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="quiz-text-answer">
                <label className="field">
                  <span>Sua resposta dissertativa:</span>
                  <textarea
                    rows={5}
                    className="input"
                    placeholder="Escreva sua resposta detalhada para esta questão..."
                    value={currentAnswer}
                    onChange={e => handleTextAnswer(e.target.value)}
                    maxLength={5000}
                    required
                  />
                </label>
              </div>
            )}
          </div>

          {/* Campo de Justificativa / Comentário Opcional */}
          <div className="quiz-comment-area">
            <label className="quiz-comment-label">
              <span className="quiz-comment-label-text">
                <MessageSquare size={13} /> Justificativa ou observação ao professor (opcional):
              </span>
              <textarea
                rows={2}
                className="quiz-comment-input"
                placeholder="Explique o motivo da sua resposta ou aponte se teve alguma dúvida..."
                value={currentComment}
                onChange={e => handleComment(e.target.value)}
                maxLength={2000}
              />
            </label>
          </div>
        </div>

        {/* Rodapé de Navegação */}
        <div className="quiz-runner-nav">
          <div>
            {currentIndex > 0 ? (
              <Button type="button" variant="secondary" onClick={prevQuestion}>
                <ChevronLeft size={16} /> Pergunta anterior
              </Button>
            ) : onCancel ? (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancelar avaliação
              </Button>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {currentIndex < questions.length - 1 ? (
              <Button
                type="button"
                variant="primary"
                disabled={!isCurrentAnswered}
                onClick={nextQuestion}
                title={!isCurrentAnswered ? "Selecione ou escreva uma resposta para avançar" : "Avançar"}
              >
                Próxima pergunta <ChevronRight size={16} />
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                disabled={busy || !allAnswered}
                title={!allAnswered ? "Responda todas as perguntas para concluir" : "Concluir"}
              >
                <Send size={16} /> {isProficiency ? "Finalizar Prova de Proficiência" : "Enviar para Correção"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
