"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  HelpCircle,
  ListChecks,
  MessageSquare,
  Radio,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "./ui/button";
import { useAcademy } from "./academy-provider";
import { completeActivity, type Course, type Question } from "@/lib/model";

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
  const { update, mutate, notify, busy } = useAcademy();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittedResult, setSubmittedResult] = useState<{
    passed: boolean;
    score: number;
    feedback?: string;
  } | null>(null);

  if (!questions || questions.length === 0) {
    return (
      <div className="panel" style={{ padding: 30, textAlign: "center" }}>
        <HelpCircle size={32} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
        <h3>Nenhuma pergunta cadastrada</h3>
        <p style={{ color: "var(--muted)", fontSize: 12 }}>
          Esta avaliação ainda não possui questões configuradas.
        </p>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} style={{ marginTop: 16 }}>
            Voltar
          </Button>
        )}
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const currentAnswer = answers[currentQ?.id] || "";
  const currentComment = answers[`${currentQ?.id}__comment`] || "";

  // Helper: check if a question is answered
  const isQuestionAnswered = (q: Question) => {
    const ans = answers[q.id];
    if (!ans || !ans.trim()) return false;
    if (q.type === "choice" && q.multiple) {
      try {
        const parsed = JSON.parse(ans);
        return Array.isArray(parsed) && parsed.length > 0;
      } catch {
        return false;
      }
    }
    return ans.trim().length > 0;
  };

  const answeredCount = questions.filter(isQuestionAnswered).length;
  const unansweredQuestions = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => !isQuestionAnswered(q));
  const allAnswered = unansweredQuestions.length === 0;
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  // Single choice answer
  const handleSelectChoice = (option: string) => {
    setAnswers(prev => ({ ...prev, [currentQ.id]: option }));
  };

  // Multiple choice answer (checkboxes)
  const getSelectedMultiple = (qId: string): string[] => {
    const raw = answers[qId];
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return [];
  };

  const handleToggleMultipleChoice = (option: string) => {
    const currentList = getSelectedMultiple(currentQ.id);
    let nextList: string[];
    if (currentList.includes(option)) {
      nextList = currentList.filter(o => o !== option);
    } else {
      nextList = [...currentList, option];
    }
    setAnswers(prev => ({ ...prev, [currentQ.id]: JSON.stringify(nextList.sort()) }));
  };

  const handleTextAnswer = (text: string) => {
    setAnswers(prev => ({ ...prev, [currentQ.id]: text }));
  };

  const handleComment = (comment: string) => {
    setAnswers(prev => ({ ...prev, [`${currentQ.id}__comment`]: comment }));
  };

  const goToQuestion = (index: number) => {
    setIsReviewMode(false);
    setCurrentIndex(index);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsReviewMode(true);
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (preview) {
      notify("Prévia: envio testado com sucesso (nenhum XP ou progresso registrado).");
      if (onComplete) onComplete({ passed: true, score: 100 });
      return;
    }

    if (isProficiency) {
      // Prova de Proficiência: correção imediata
      const totalQuestions = questions.length;
      let correctCount = 0;

      for (const q of questions) {
        if (q.type === "choice") {
          if (answers[q.id] === q.correct) correctCount++;
        } else if (q.type === "text" && answers[q.id]?.trim().length >= 10) {
          correctCount++;
        }
      }

      const score = Math.round((correctCount / totalQuestions) * 100);
      const passed = score >= passingScore;

      if (passed) {
        await update(current => {
          let updatedState = current;
          for (const l of course.lessons) {
            if (l.type !== "quiz") {
              updatedState = completeActivity(updatedState, course.id, l.id);
            }
          }
          return updatedState;
        });

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
          feedback: `Você obteve ${score}% de acertos. Para obter a dispensa por proficiência, é necessário atingir no mínimo ${passingScore}%. Você pode realizar o curso assistindo às aulas na sequência normal.`,
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
      <section
        className="panel quiz-runner-result"
        style={{ padding: 32, textAlign: "center", maxWidth: 640, margin: "0 auto" }}
      >
        <div
          style={{
            display: "inline-flex",
            padding: 18,
            borderRadius: "50%",
            background: submittedResult.passed ? "var(--lavender)" : "#fff5f5",
            marginBottom: 16,
          }}
        >
          {submittedResult.passed ? (
            <Sparkles size={40} style={{ color: "var(--primary)" }} />
          ) : (
            <AlertCircle size={40} style={{ color: "#e53e3e" }} />
          )}
        </div>
        <span className={`pill ${submittedResult.passed ? "green" : ""}`}>
          {submittedResult.passed ? "PROFICIÊNCIA CONQUISTADA" : "TENTATIVA DE PROFICIÊNCIA"}
        </span>
        <h2 style={{ fontSize: 24, margin: "16px 0 8px" }}>
          {submittedResult.passed ? "Domínio Comprovado!" : "Quase lá!"}
        </h2>
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            margin: "12px 0",
            color: submittedResult.passed ? "var(--primary)" : "#e53e3e",
          }}
        >
          {submittedResult.score}%
          <small style={{ fontSize: 16, color: "var(--muted)", fontWeight: 400 }}> / 100%</small>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8, maxWidth: 500, margin: "0 auto 24px" }}>
          {submittedResult.feedback}
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          {onCancel && (
            <Button variant={submittedResult.passed ? "default" : "secondary"} onClick={onCancel}>
              {submittedResult.passed ? "Continuar jornada" : "Voltar e assistir aulas"}
            </Button>
          )}
        </div>
      </section>
    );
  }

  // TELA DE REVISÃO PRÉ-ENVIO
  if (isReviewMode) {
    return (
      <div className="quiz-runner-container">
        {/* Stepper Navigation */}
        <div className="quiz-runner-header" style={{ marginBottom: 16 }}>
          <div className="quiz-runner-title-meta">
            <span className="pill">{isProficiency ? "PROVA DE PROFICIÊNCIA" : "AVALIAÇÃO DE APRENDIZADO"}</span>
            <span className="quiz-counter">
              <strong>{answeredCount}</strong> de {questions.length} respondidas ({progressPercent}%)
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            {questions.map((q, idx) => {
              const answered = isQuestionAnswered(q);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => goToQuestion(idx)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "1px solid var(--border)",
                    backgroundColor: answered ? "rgba(16, 185, 129, 0.1)" : "var(--surface)",
                    color: answered ? "#059669" : "var(--muted)",
                  }}
                >
                  <span>Q{idx + 1}</span>
                  {answered ? <CheckCircle2 size={13} /> : <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--muted)" }} />}
                </button>
              );
            })}

            <button
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                border: "2px solid var(--primary, #6366f1)",
                backgroundColor: "var(--lavender, rgba(99, 102, 241, 0.12))",
                color: "var(--primary, #6366f1)",
              }}
            >
              <Eye size={14} /> Revisão
            </button>
          </div>
        </div>

        {/* Painel de Alerta / Sucesso */}
        <section className="quiz-card panel" style={{ padding: 28 }}>
          <div style={{ marginBottom: 24 }}>
            {!allAnswered ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "16px 20px",
                  borderRadius: 12,
                  backgroundColor: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  color: "#92400e",
                  marginBottom: 20,
                }}
              >
                <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: 2, color: "#d97706" }} />
                <div>
                  <strong style={{ fontSize: 15, display: "block", marginBottom: 4 }}>
                    Atenção: Você possui {unansweredQuestions.length}{" "}
                    {unansweredQuestions.length === 1 ? "questão não preenchida" : "questões não preenchidas"}
                  </strong>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
                    Questões deixadas em branco serão consideradas incorretas no resultado. Clique nas
                    questões abaixo para respondê-las antes de finalizar:
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {unansweredQuestions.map(({ idx }) => (
                      <Button
                        key={idx}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => goToQuestion(idx)}
                        style={{ fontSize: 12, gap: 4, backgroundColor: "#fff" }}
                      >
                        Responder Questão {idx + 1} →
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 18px",
                  borderRadius: 12,
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  color: "#065f46",
                  marginBottom: 20,
                }}
              >
                <CheckCircle2 size={22} style={{ color: "#10b981", flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  Excelente! Todas as {questions.length} questões foram respondidas. Confira suas respostas
                  abaixo antes de enviar.
                </span>
              </div>
            )}

            <h3 style={{ fontSize: 16, marginBottom: 14 }}>Resumo das Questões</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {questions.map((q, idx) => {
                const answered = isQuestionAnswered(q);
                let answerDisplay = "Não respondida";
                if (answered) {
                  if (q.type === "choice" && q.multiple) {
                    const selected = getSelectedMultiple(q.id);
                    answerDisplay = `${selected.length} opção(ões) marcada(s)`;
                  } else if (q.type === "choice") {
                    answerDisplay = answers[q.id];
                  } else {
                    answerDisplay = answers[q.id]?.slice(0, 70) + (answers[q.id]?.length > 70 ? "…" : "");
                  }
                }

                return (
                  <div
                    key={q.id}
                    onClick={() => goToQuestion(idx)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      borderRadius: 10,
                      backgroundColor: "var(--surface)",
                      border: answered ? "1px solid var(--border)" : "1.5px dashed #f59e0b",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          backgroundColor: answered ? "#10b981" : "var(--muted)",
                          color: "#fff",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                          {q.prompt.length > 60 ? `${q.prompt.slice(0, 60)}…` : q.prompt}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: answered ? "var(--muted)" : "#d97706",
                            marginTop: 2,
                          }}
                        >
                          Resposta: <strong>{answerDisplay}</strong>
                        </div>
                      </div>
                    </div>

                    <Button type="button" variant="ghost" size="sm" style={{ fontSize: 11 }}>
                      Alterar →
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botões da Revisão */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 18,
              borderTop: "1px solid var(--border)",
            }}
          >
            <Button type="button" variant="secondary" onClick={() => goToQuestion(questions.length - 1)}>
              <ChevronLeft size={16} /> Voltar à última pergunta
            </Button>

            <Button
              type="button"
              variant="default"
              disabled={busy}
              onClick={() => handleSubmit()}
              style={{ gap: 8, padding: "10px 24px", fontSize: 14 }}
            >
              <Send size={16} />
              {isProficiency ? "Confirmar e Finalizar Proficiência" : "Confirmar e Enviar Avaliação"}
            </Button>
          </div>
        </section>
      </div>
    );
  }

  // TELA DA PERGUNTA ATUAL
  const selectedMultiple = getSelectedMultiple(currentQ.id);

  return (
    <div className="quiz-runner-container">
      {/* Header com Stepper e Progresso */}
      <div className="quiz-runner-header">
        <div className="quiz-runner-title-meta">
          <span className="pill">{isProficiency ? "PROVA DE PROFICIÊNCIA" : "AVALIAÇÃO DE APRENDIZADO"}</span>
          <span className="quiz-counter">
            Questão <strong>{currentIndex + 1}</strong> de {questions.length}
          </span>
        </div>

        {/* Stepper Buttons Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            margin: "12px 0 8px",
            overflowX: "auto",
            paddingBottom: 4,
          }}
        >
          {questions.map((q, idx) => {
            const isCurrent = idx === currentIndex;
            const answered = isQuestionAnswered(q);

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => goToQuestion(idx)}
                title={`Ir para questão ${idx + 1}${answered ? " (Respondida)" : " (Em branco)"}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 36,
                  height: 32,
                  padding: "0 8px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: isCurrent ? 700 : 500,
                  cursor: "pointer",
                  border: isCurrent ? "2px solid var(--primary, #6366f1)" : "1px solid var(--border)",
                  backgroundColor: isCurrent
                    ? "var(--lavender, rgba(99, 102, 241, 0.12))"
                    : answered
                    ? "rgba(16, 185, 129, 0.1)"
                    : "var(--surface)",
                  color: isCurrent ? "var(--primary, #6366f1)" : answered ? "#059669" : "var(--muted)",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{idx + 1}</span>
                {answered && <Check size={11} style={{ marginLeft: 3, strokeWidth: 3 }} />}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setIsReviewMode(true)}
            title="Ir para a revisão antes de enviar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 32,
              padding: "0 10px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px dashed var(--border)",
              backgroundColor: "transparent",
              color: "var(--muted)",
              whiteSpace: "nowrap",
            }}
          >
            <Eye size={12} /> Revisão
          </button>
        </div>

        <div
          className="quiz-runner-progressbar"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="quiz-runner-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Pergunta atual */}
      <form onSubmit={e => { e.preventDefault(); nextQuestion(); }} className="quiz-card panel">
        <div className="quiz-question-body">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="quiz-question-number-badge">Questão {currentIndex + 1} de {questions.length}</div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--muted)",
                backgroundColor: "var(--surface)",
                padding: "3px 10px",
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            >
              {currentQ.type === "choice"
                ? currentQ.multiple
                  ? "Múltipla Escolha (1 ou mais opções)"
                  : "Escolha Única"
                : "Dissertativa"}
            </span>
          </div>

          <h2 className="quiz-question-prompt">{currentQ.prompt}</h2>

          {/* Dica para Múltipla Escolha */}
          {currentQ.type === "choice" && currentQ.multiple && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                backgroundColor: "var(--lavender, rgba(99, 102, 241, 0.08))",
                color: "var(--primary, #6366f1)",
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 16,
              }}
            >
              <ListChecks size={14} /> Selecione uma ou mais opções corretas abaixo.
            </div>
          )}

          {/* Área de Resposta */}
          <div className="quiz-options-area">
            {currentQ.type === "choice" ? (
              <div className="quiz-choices-grid">
                {currentQ.options.map((option: string) => {
                  const isSelected = currentQ.multiple
                    ? selectedMultiple.includes(option)
                    : currentAnswer === option;

                  return (
                    <label
                      key={option}
                      className={`choice-card ${isSelected ? "is-selected" : ""}`}
                      onClick={() => {
                        if (currentQ.multiple) {
                          handleToggleMultipleChoice(option);
                        } else {
                          handleSelectChoice(option);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <input
                        type={currentQ.multiple ? "checkbox" : "radio"}
                        name={currentQ.id}
                        value={option}
                        checked={isSelected}
                        onChange={() => {
                          if (currentQ.multiple) {
                            handleToggleMultipleChoice(option);
                          } else {
                            handleSelectChoice(option);
                          }
                        }}
                        aria-label={option}
                        style={{ accentColor: "var(--primary, #6366f1)", width: 16, height: 16 }}
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsReviewMode(true)}
              style={{ gap: 6 }}
            >
              <Eye size={14} /> Revisar respostas
            </Button>

            {currentIndex < questions.length - 1 ? (
              <Button type="button" variant="default" onClick={nextQuestion}>
                Próxima pergunta <ChevronRight size={16} />
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                onClick={() => setIsReviewMode(true)}
                style={{ gap: 6 }}
              >
                Revisar e Finalizar <ArrowRight size={16} />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
