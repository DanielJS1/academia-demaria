"use client";

import { useState } from "react";
import { CheckCircle2, HelpCircle, ListChecks, Plus, Radio, SlidersHorizontal } from "lucide-react";
import { Button } from "../ui/button";
import type { Course } from "@/lib/model";
import { QuestionStudioModal } from "./question-studio-modal";
import { isCorrectAnswerValid } from "@/lib/course-activities";

export function ActivityQuestions({
  questions,
  onChange,
  title = "Avaliação da Aula",
}: {
  questions: Course["questions"];
  onChange: (value: Course["questions"]) => void;
  title?: string;
}) {
  const [studioOpen, setStudioOpen] = useState(false);

  const choiceCount = questions.filter(q => q.type === "choice").length;
  const textCount = questions.filter(q => q.type === "text").length;
  const invalidCount = questions.filter(q => !isCorrectAnswerValid(q) || !q.prompt.trim() ||
    (q.type === "choice" && (q.options.length < 2 || q.options.some(o => !o.trim()) || new Set(q.options).size !== q.options.length))).length;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 18px",
        backgroundColor: "var(--card-bg, #fbfbfd)",
        margin: "12px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--primary, #6366f1)",
              }}
            >
              <ListChecks size={15} />
              {questions.length === 1 ? "1 Questão Cadastrada" : `${questions.length} Questões Cadastradas`}
            </span>

            {invalidCount > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#b45309",
                  backgroundColor: "rgba(245, 158, 11, 0.12)",
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                {invalidCount === 1 ? "1 pendência" : `${invalidCount} pendências`}
              </span>
            )}
          </div>

          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            {questions.length === 0
              ? "Esta avaliação ainda não possui perguntas configuradas."
              : `${choiceCount} de múltipla escolha · ${textCount} discursiva`}
          </p>
        </div>

        <Button
          type="button"
          variant={questions.length === 0 ? "default" : "secondary"}
          size="sm"
          onClick={() => setStudioOpen(true)}
          style={{ gap: 6 }}
        >
          <SlidersHorizontal size={14} />
          {questions.length === 0 ? "Configurar Perguntas" : "Abrir Question Studio"}
        </Button>
      </div>

      {/* Mini question chips preview if has questions */}
      {questions.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px dashed var(--border)",
          }}
        >
          {questions.map((q, idx) => {
            const valid = isCorrectAnswerValid(q) && !!q.prompt.trim() &&
              (q.type !== "choice" || (q.options.length >= 2 && q.options.every(o => o.trim()) && new Set(q.options).size === q.options.length));
            const previewText = q.prompt.trim()
              ? q.prompt.length > 30
                ? `${q.prompt.slice(0, 30)}…`
                : q.prompt
              : "Sem enunciado";

            return (
              <button
                key={q.id || idx}
                type="button"
                onClick={() => setStudioOpen(true)}
                title={`Clique para editar a questão ${idx + 1}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  background: "var(--surface, #fff)",
                  border: valid ? "1px solid var(--border)" : "1px solid #f59e0b",
                  color: "var(--foreground)",
                  cursor: "pointer",
                }}
              >
                <strong>Q{idx + 1}:</strong>
                <span>{previewText}</span>
                {valid ? (
                  <CheckCircle2 size={12} style={{ color: "#10b981" }} />
                ) : (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: "#f59e0b",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Studio Modal */}
      {studioOpen && (
        <QuestionStudioModal
          title={title}
          questions={questions}
          onChange={onChange}
          onClose={() => setStudioOpen(false)}
        />
      )}
    </div>
  );
}
