"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  ListChecks,
  Plus,
  Radio,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import type { Question } from "@/lib/model";
import { isCorrectAnswerValid } from "@/lib/course-activities";

export type StudioQuestion = Question & { explanation?: string; imageUrl?: string; imageAlt?: string };

export function QuestionStudioModal({
  title = "Avaliação",
  questions,
  onChange,
  onClose,
  variant = "course",
  initialIndex = 0,
}: {
  title?: string;
  questions: StudioQuestion[];
  onChange: (questions: StudioQuestion[]) => void;
  onClose: () => void;
  variant?: "course" | "challenge";
  initialIndex?: number;
}) {
  const challenge = variant === "challenge";
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  const [items, setItems] = useState<StudioQuestion[]>(() =>
    questions.length > 0
      ? structuredClone(questions)
      : [
          {
            id: crypto.randomUUID(),
            prompt: "",
            type: "choice",
            multiple: false,
            options: ["", ""],
            correct: "",
          },
        ]
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const activeIndex = Math.min(currentIndex, Math.max(0, items.length - 1));
  const activeQ: StudioQuestion = items[activeIndex] || {
    id: crypto.randomUUID(),
    prompt: "",
    type: "choice",
    multiple: false,
    options: ["", ""],
    correct: "",
  };

  const updateActive = (patch: Partial<StudioQuestion>) => {
    setError("");
    setItems(current =>
      current.map((item, idx) => (idx === activeIndex ? { ...item, ...patch } : item))
    );
  };

  const addQuestion = () => {
    if (challenge && items.length >= 30) return;
    const newQ: Question = {
      id: crypto.randomUUID(),
      prompt: "",
      type: "choice",
      multiple: false,
      options: ["", ""],
      correct: "",
    };
    setItems(current => [...current, newQ]);
    setCurrentIndex(items.length);
  };

  const removeActive = () => {
    if (items.length <= 1) {
      // Keep at least one empty question
      setItems([
        {
          id: crypto.randomUUID(),
          prompt: "",
          type: "choice",
          multiple: false,
          options: ["", ""],
          correct: "",
        },
      ]);
      setCurrentIndex(0);
      return;
    }
    const nextItems = items.filter((_, idx) => idx !== activeIndex);
    setItems(nextItems);
    setCurrentIndex(Math.max(0, activeIndex - 1));
  };

  // Multiple choice correct answers helper (array of options parsed from JSON)
  const getMultipleCorrectArray = (correct: string): string[] => {
    try {
      const parsed = JSON.parse(correct);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return correct ? [correct] : [];
  };

  const toggleMultipleCorrect = (optionText: string) => {
    const currentArray = getMultipleCorrectArray(activeQ.correct);
    let nextArray: string[];
    if (currentArray.includes(optionText)) {
      nextArray = currentArray.filter(o => o !== optionText);
    } else {
      nextArray = [...currentArray, optionText];
    }
    updateActive({ correct: JSON.stringify(nextArray.sort()) });
  };

  const addOption = () => {
    if (challenge && activeQ.options.length >= 6) return;
    updateActive({ options: [...activeQ.options, ""] });
  };

  const updateOptionText = (optIndex: number, newText: string) => {
    const oldText = activeQ.options[optIndex];
    const newOptions = activeQ.options.map((opt, i) => (i === optIndex ? newText : opt));

    // Update correct answer reference if oldText was selected
    let nextCorrect = activeQ.correct;
    if (activeQ.multiple) {
      const currentArray = getMultipleCorrectArray(activeQ.correct);
      const updatedArray = currentArray.map(ans => (ans === oldText ? newText : ans));
      nextCorrect = JSON.stringify(updatedArray.sort());
    } else if (oldText.trim() && activeQ.correct === oldText) {
      nextCorrect = newText;
    }

    updateActive({ options: newOptions, correct: nextCorrect });
  };

  const removeOption = (optIndex: number) => {
    if (activeQ.options.length <= 2) return;
    const removedText = activeQ.options[optIndex];
    const newOptions = activeQ.options.filter((_, i) => i !== optIndex);

    let nextCorrect = activeQ.correct;
    if (activeQ.multiple) {
      const currentArray = getMultipleCorrectArray(activeQ.correct);
      const updatedArray = currentArray.filter(ans => ans !== removedText);
      nextCorrect = JSON.stringify(updatedArray.sort());
    } else if (activeQ.correct === removedText) {
      nextCorrect = "";
    }

    updateActive({ options: newOptions, correct: nextCorrect });
  };

  const handleSaveAndClose = () => {
    // Clean up empty options before saving
    const cleaned = items.map(q => {
      if (q.type !== "choice") return q;
      const cleanOptions = q.options.map(o => o.trim()).filter(Boolean);
      return {
        ...q,
        options: cleanOptions.length >= 2 ? cleanOptions : q.options,
        correct: q.multiple ? JSON.stringify(getMultipleCorrectArray(q.correct).map(answer => answer.trim()).sort()) : q.correct.trim(),
      };
    });
    if (challenge) {
      const invalid = cleaned.findIndex(q => q.prompt.trim().length < 5 || q.prompt.length > 3000 ||
        q.type !== "choice" || q.multiple || !isCorrectAnswerValid(q) || q.options.length < 2 || q.options.length > 6 ||
        q.options.some(option => !option.trim() || option.length > 500) || new Set(q.options).size !== q.options.length ||
        (q.explanation?.trim().length ?? 0) < 5 || (q.explanation?.length ?? 0) > 3000 ||
        (!!q.imageUrl && (!/^https:\/\//.test(q.imageUrl) || !URL.canParse(q.imageUrl) || !q.imageAlt?.trim())));
      if (items.length < 2 || invalid >= 0) {
        if (invalid >= 0) setCurrentIndex(invalid);
        setError(items.length < 2 ? "Adicione pelo menos duas perguntas." : `Revise a questão ${invalid + 1}: preencha enunciado, alternativas únicas, gabarito e explicação. Imagens precisam de URL HTTPS e descrição.`);
        return;
      }
    }
    onChange(cleaned);
    onClose();
  };

  const isQuestionComplete = (q: StudioQuestion) => {
    if (challenge && (q.explanation?.trim().length ?? 0) < 5) return false;
    if (!q.prompt.trim()) return false;
    if (q.type === "text") return true;
    return isCorrectAnswerValid(q) && q.options.length >= 2 &&
      q.options.every(o => o.trim()) && new Set(q.options).size === q.options.length;
  };

  const multipleSelected = getMultipleCorrectArray(activeQ.correct);

  return createPortal(
    <dialog
      ref={dialogRef}
      className="question-studio"
      onCancel={event => { event.preventDefault(); onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-studio-title"
      style={{
        position: "fixed",
        inset: 0,
        margin: 0,
        width: "100vw",
        height: "100dvh",
        maxWidth: "none",
        maxHeight: "none",
        border: 0,
        color: "var(--foreground)",
        zIndex: 9999,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        className="panel"
        style={{
          width: "100%",
          maxWidth: 840,
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--background, #fff)",
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.3)",
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div className="question-studio-header"
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="pill" style={{ fontSize: 11 }}>
                QUESTION STUDIO
              </span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                Questão <strong>{activeIndex + 1}</strong> de {items.length}
              </span>
            </div>
            <h2 id="question-studio-title" style={{ fontSize: 18, margin: "6px 0 0", fontWeight: 700 }}>
              {title}
            </h2>
          </div>

          <Button type="button" variant="ghost" size="icon" onClick={handleSaveAndClose} aria-label={challenge ? "Aplicar perguntas e fechar" : "Fechar e salvar"}>
            <X size={18} />
          </Button>
        </div>

        {/* Question Stepper Bar */}
        <div className="question-studio-stepper"
          style={{
            padding: "12px 24px",
            background: "var(--card-bg, #fbfbfd)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            overflowX: "auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexGrow: 1, overflowX: "auto" }}>
            {items.map((item, idx) => {
              const active = idx === activeIndex;
              const complete = isQuestionComplete(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Questão ${idx + 1}: ${complete ? "preenchida" : "pendente"}`}
                  aria-current={active ? "step" : undefined}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    border: active ? "2px solid var(--primary, #6366f1)" : "1px solid var(--border)",
                    background: active
                      ? "var(--lavender, rgba(99, 102, 241, 0.12))"
                      : "var(--surface, #fff)",
                    color: active ? "var(--primary, #6366f1)" : "var(--foreground)",
                  }}
                >
                  <span>Q{idx + 1}</span>
                  {complete ? (
                    <CheckCircle2 size={13} style={{ color: "#10b981" }} />
                  ) : (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--muted)",
                        display: "inline-block",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addQuestion}
            disabled={challenge && items.length >= 30}
            style={{ fontSize: 12, gap: 4, whiteSpace: "nowrap" }}
          >
            <Plus size={14} /> Nova pergunta
          </Button>
        </div>

        {/* Main Content Area */}
        <div className="question-studio-body" style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {/* Question Top Controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: "var(--primary, #6366f1)",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {activeIndex + 1}
              </span>
              <strong style={{ fontSize: 16 }}>Configuração da Pergunta</strong>
            </div>

            {items.length > (challenge ? 2 : 1) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeActive}
                style={{ color: "#ef4444", fontSize: 12, gap: 6 }}
                title="Excluir esta questão"
              >
                <Trash2 size={14} /> Excluir questão
              </Button>
            )}
          </div>

          {/* Prompt */}
          <label className="field" style={{ marginBottom: 18 }}>
            <span style={{ fontWeight: 600 }}>Enunciado da Pergunta</span>
            <textarea
              rows={3}
              value={activeQ.prompt}
              placeholder="Ex: Qual o procedimento correto para lavratura de assento de nascimento tardio?"
              onChange={e => updateActive({ prompt: e.target.value })}
              style={{ fontSize: 14, lineHeight: 1.6 }}
            />
          </label>

          {/* Type Selector Tabs */}
          <div style={{ marginBottom: 20 }} hidden={challenge}>
            <span style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
              Modalidade de Resposta
            </span>
            <div className="question-studio-modes" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <button
                type="button"
                onClick={() =>
                  updateActive({
                    type: "choice",
                    multiple: false,
                    correct: activeQ.options[0] || "",
                  })
                }
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border:
                    activeQ.type === "choice" && !activeQ.multiple
                      ? "2px solid var(--primary, #6366f1)"
                      : "1px solid var(--border)",
                  backgroundColor:
                    activeQ.type === "choice" && !activeQ.multiple
                      ? "var(--lavender, rgba(99, 102, 241, 0.08))"
                      : "var(--surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Radio size={16} style={{ color: "var(--primary, #6366f1)" }} />
                  <strong style={{ fontSize: 13 }}>Escolha Única</strong>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                  O aluno marca apenas 1 opção correta.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  updateActive({
                    type: "choice",
                    multiple: true,
                    correct: activeQ.correct
                      ? activeQ.correct.startsWith("[")
                        ? activeQ.correct
                        : JSON.stringify([activeQ.correct])
                      : JSON.stringify([]),
                  })
                }
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border:
                    activeQ.type === "choice" && activeQ.multiple
                      ? "2px solid var(--primary, #6366f1)"
                      : "1px solid var(--border)",
                  backgroundColor:
                    activeQ.type === "choice" && activeQ.multiple
                      ? "var(--lavender, rgba(99, 102, 241, 0.08))"
                      : "var(--surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <ListChecks size={16} style={{ color: "var(--primary, #6366f1)" }} />
                  <strong style={{ fontSize: 13 }}>Múltipla Escolha</strong>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                  Permite selecionar 1 ou mais opções corretas.
                </p>
              </button>

              <button
                type="button"
                onClick={() => updateActive({ type: "text" })}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border:
                    activeQ.type === "text"
                      ? "2px solid var(--primary, #6366f1)"
                      : "1px solid var(--border)",
                  backgroundColor:
                    activeQ.type === "text"
                      ? "var(--lavender, rgba(99, 102, 241, 0.08))"
                      : "var(--surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <HelpCircle size={16} style={{ color: "var(--primary, #6366f1)" }} />
                  <strong style={{ fontSize: 13 }}>Discursiva</strong>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                  Resposta aberta corrigida pelo instrutor.
                </p>
              </button>
            </div>
          </div>

          {/* Options Management Area (if Choice) */}
          {activeQ.type === "choice" ? (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <div>
                  <strong style={{ fontSize: 14 }}>Alternativas & Gabarito</strong>
                  <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>
                    {activeQ.multiple
                      ? "Marque as caixas de seleção das alternativas corretas"
                      : "Marque a opção que representa a resposta correta"}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addOption}
                  disabled={challenge && activeQ.options.length >= 6}
                  style={{ fontSize: 12, gap: 4 }}
                >
                  <Plus size={14} /> Adicionar alternativa
                </Button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activeQ.options.map((option, optIdx) => {
                  const duplicateOf = activeQ.options.findIndex((other, idx) => idx < optIdx && other === option);
                  const isDuplicate = option.trim().length > 0 && duplicateOf !== -1;
                  const isChecked = !isDuplicate && (activeQ.multiple
                    ? multipleSelected.includes(option) && option.trim().length > 0
                    : activeQ.correct === option && option.trim().length > 0);

                  return (
                    <div
                      key={optIdx}
                      className="question-studio-option"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "8px 14px",
                        borderRadius: 10,
                        backgroundColor: isChecked ? "rgba(16, 185, 129, 0.08)" : "var(--surface)",
                        border: isChecked ? "1.5px solid #10b981" : "1px solid var(--border)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {/* Gabarito Selector */}
                      <label
                        title={
                          isDuplicate
                            ? "Alternativa repetida: altere o texto antes de selecionar"
                            : isChecked
                            ? "Resposta marcada como correta no gabarito"
                            : "Clique para marcar como resposta correta"
                        }
                        style={{
                          display: "flex",
                          alignItems: "center",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <input
                          type={activeQ.multiple ? "checkbox" : "radio"}
                          name={`studio-gabarito-${activeQ.id}`}
                          checked={isChecked}
                          aria-label={`Marcar alternativa ${String.fromCharCode(65 + optIdx)} como correta`}
                          disabled={isDuplicate}
                          onChange={() => {
                            if (!option.trim()) return;
                            if (activeQ.multiple) {
                              toggleMultipleCorrect(option);
                            } else {
                              updateActive({ correct: option });
                            }
                          }}
                          style={{
                            width: 18,
                            height: 18,
                            accentColor: "#10b981",
                            cursor: "pointer",
                          }}
                        />
                      </label>

                      {/* Alternative Text */}
                      <input
                        type="text"
                        aria-invalid={isDuplicate}
                        aria-label={`Alternativa ${String.fromCharCode(65 + optIdx)}`}
                        value={option}
                        placeholder={`Alternativa ${String.fromCharCode(65 + optIdx)}`}
                        onChange={e => updateOptionText(optIdx, e.target.value)}
                        style={{
                          flex: 1,
                          fontSize: 13,
                          padding: "6px 10px",
                          border: "none",
                          background: "transparent",
                          outline: "none",
                        }}
                      />

                      {isDuplicate && (
                        <span style={{ fontSize: 11, color: "#b45309" }}>Repetida</span>
                      )}

                      {/* Status Tag */}
                      {isChecked && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#059669",
                            backgroundColor: "rgba(16, 185, 129, 0.15)",
                            padding: "2px 8px",
                            borderRadius: 12,
                          }}
                        >
                          GABARITO
                        </span>
                      )}

                      {/* Remove Option Button */}
                      {activeQ.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(optIdx)}
                          title="Remover alternativa"
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "var(--muted)",
                            cursor: "pointer",
                            padding: 4,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {new Set(activeQ.options.filter(o => o.trim())).size !== activeQ.options.filter(o => o.trim()).length && (
                <div role="alert" style={{ marginTop: 12, color: "#b45309", fontSize: 12 }}>
                  Há alternativas com o mesmo texto. Altere ou remova as repetidas para salvar.
                </div>
              )}

              {/* Validation helper alert */}
              {!isCorrectAnswerValid(activeQ) && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 12,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(245, 158, 11, 0.1)",
                    color: "#b45309",
                    fontSize: 12,
                  }}
                >
                  <AlertCircle size={14} />
                  <span>
                    {activeQ.multiple
                      ? "Marque ao menos uma alternativa correta para o gabarito desta questão."
                      : "Selecione qual alternativa é a correta no gabarito."}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                padding: 24,
                borderRadius: 12,
                backgroundColor: "var(--surface)",
                border: "1px dashed var(--border)",
                textAlign: "center",
              }}
            >
              <HelpCircle size={32} style={{ color: "var(--primary)", margin: "0 auto 10px" }} />
              <h4 style={{ margin: "0 0 6px" }}>Questão Discursiva</h4>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", maxWidth: 460, marginInline: "auto" }}>
                O aluno digitará a resposta livremente. Você poderá ler, corrigir e atribuir nota
                individualmente no painel de correções do administrador.
              </p>
            </div>
          )}
          {challenge && <div className="question-studio-feedback">
            <label className="field"><span>Explicação após a resposta</span>
              <textarea rows={3} minLength={5} maxLength={3000} value={activeQ.explanation ?? ""}
                placeholder="Explique por que a alternativa está correta."
                onChange={event => updateActive({ explanation: event.target.value })}/>
            </label>
            <details><summary>Imagem de apoio (opcional)</summary>
              <label className="field"><span>URL HTTPS da imagem</span><input type="url" value={activeQ.imageUrl ?? ""}
                onChange={event => updateActive({ imageUrl: event.target.value })}/></label>
              <label className="field"><span>Descrição da imagem</span><input maxLength={300} value={activeQ.imageAlt ?? ""}
                onChange={event => updateActive({ imageAlt: event.target.value })}/></label>
            </details>
            <p>Desafios usam escolha única e correção automática. Após aplicar as perguntas, salve o desafio para publicar as alterações.</p>
          </div>}
        </div>

        {error && <p role="alert" className="question-studio-error">{error}</p>}
        {/* Footer Navigation Bar */}
        <div className="question-studio-footer"
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={activeIndex === 0}
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            >
              <ChevronLeft size={16} /> Anterior
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={activeIndex === items.length - 1}
              onClick={() => setCurrentIndex(prev => Math.min(items.length - 1, prev + 1))}
            >
              Próxima <ChevronRight size={16} />
            </Button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>

            <Button type="button" variant="default" size="sm" onClick={handleSaveAndClose}>
              <Check size={16} /> {challenge ? "Aplicar perguntas" : "Salvar e Voltar ao Curso"}
            </Button>
          </div>
        </div>
      </div>
    </dialog>, document.body
  );
}
