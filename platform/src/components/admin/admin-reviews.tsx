"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { EmptyState } from "../shared";
import { type Attempt } from "@/lib/model";

export function AdminReviews() {
  const { state } = useAcademy();
  const [selected, setSelected] = useState("");
  const attempt = state.attempts.find(item => item.id === selected);

  if (attempt) {
    return <ReviewForm key={attempt.id} attempt={attempt} close={() => setSelected("")} />;
  }

  if (!state.attempts.length) {
    return (
      <EmptyState
        icon={<ClipboardCheck size={30} />}
        title="Cada evolução merece um bom feedback."
        description="As avaliações enviadas na sala de aula aparecerão aqui para correção."
      >
        <Button asChild variant="secondary">
          <Link href="/aprender">
            Explorar cursos <ArrowRight size={15} />
          </Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>AVALIAÇÃO</th>
            <th>ALUNO</th>
            <th>SITUAÇÃO</th>
            <th>RESULTADO</th>
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {[...state.attempts].reverse().map(item => (
            <tr key={item.id}>
              <td>
                <strong>{item.courseTitle}</strong>
                <small>
                  Versão {item.courseVersion} · {new Date(item.submittedAt).toLocaleDateString("pt-BR")}
                </small>
              </td>
              <td>{state.people.find(person => person.id === item.userId)?.name || "Colaborador"}</td>
              <td>
                <span className={`pill ${item.status === "approved" ? "green" : "amber"}`}>
                  {item.status === "pending"
                    ? "Aguardando correção"
                    : item.status === "approved"
                    ? "Aprovado"
                    : "Nova tentativa"}
                </span>
              </td>
              <td>{item.score ?? "—"}</td>
              <td>
                <Button size="sm" variant="secondary" onClick={() => setSelected(item.id)}>
                  {item.status === "pending" ? "Corrigir" : "Ver resultado"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewForm({ attempt, close }: { attempt: Attempt; close: () => void }) {
  const { state, update, mutate, notify, busy } = useAcademy();
  const [correctTextIds, setCorrectTextIds] = useState<string[]>(attempt.correctTextIds || []);
  const [partialTextIds, setPartialTextIds] = useState<string[]>(attempt.partialTextIds || []);
  const [score, setScore] = useState(attempt.score?.toString() || "");
  const [feedback, setFeedback] = useState(attempt.feedback);
  const pending = attempt.status === "pending";

  const studentName = state.people.find(person => person.id === attempt.userId)?.name || "Colaborador";

  // Cálculo de pontuação sugerida
  const calculateSuggestedScore = (nextCorrect: string[], nextPartial: string[]) => {
    let earned = 0;
    const total = attempt.questions.length;
    if (total === 0) return 0;
    for (const q of attempt.questions) {
      if (q.type === "choice") {
        if (attempt.answers[q.id] === q.correct) earned += 1;
      } else {
        if (nextCorrect.includes(q.id)) earned += 1;
        else if (nextPartial.includes(q.id)) earned += 0.5;
      }
    }
    return Math.round((earned / total) * 100);
  };

  const handleGradeChange = (questionId: string, grade: "correct" | "partial" | "wrong") => {
    let nextCorrect = correctTextIds.filter(id => id !== questionId);
    let nextPartial = partialTextIds.filter(id => id !== questionId);

    if (grade === "correct") nextCorrect.push(questionId);
    else if (grade === "partial") nextPartial.push(questionId);

    setCorrectTextIds(nextCorrect);
    setPartialTextIds(nextPartial);

    const suggested = calculateSuggestedScore(nextCorrect, nextPartial);
    setScore(String(suggested));
  };

  return (
    <section className="panel form-panel">
      <Button variant="ghost" size="sm" onClick={close}>
        ← Voltar às correções
      </Button>
      <h2 style={{ marginTop: 19 }}>{attempt.courseTitle}</h2>
      <p>{studentName} · nota mínima para aprovação: {attempt.passingScore}%</p>

      {attempt.questions.map((question, index) => {
        const studentAnswer = attempt.answers[question.id] || "—";
        const studentComment = attempt.answers[`${question.id}__comment`];
        const isChoice = question.type === "choice";
        const isCorrectChoice = isChoice && studentAnswer === question.correct;
        const formatChoiceDisplay = (raw: string) => {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.join(" · ");
          } catch {}
          return raw;
        };
        const currentGrade = correctTextIds.includes(question.id)
          ? "correct"
          : partialTextIds.includes(question.id)
          ? "partial"
          : "wrong";

        return (
          <div className="feedback" key={question.id} style={{ borderLeft: isChoice ? (isCorrectChoice ? "4px solid #48bb78" : "4px solid #e53e3e") : "4px solid var(--primary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <strong>
                {index + 1}. {question.prompt}
              </strong>
              {isChoice ? (
                <span className={`pill ${isCorrectChoice ? "green" : ""}`}>
                  {isCorrectChoice ? "Correta (+5 XP automático)" : "Incorreta (0 XP)"}
                </span>
              ) : (
                <span className="pill">Dissertativa</span>
              )}
            </div>

            <p style={{ margin: "8px 0", background: "var(--surface)", padding: 10, borderRadius: 6, border: "1px solid var(--line)" }}>
              <strong style={{ color: "var(--muted)", fontSize: 11, display: "block" }}>Resposta do aluno:</strong>
              {formatChoiceDisplay(studentAnswer)}
            </p>

            {studentComment && (
              <div style={{ margin: "8px 0", padding: "8px 12px", background: "var(--lavender)", borderRadius: 6, fontSize: 11, color: "var(--ink)" }}>
                <strong>Comentário / Justificativa do aluno:</strong> {studentComment}
              </div>
            )}

            {isChoice && (
              <small style={{ display: "block", color: "var(--muted)" }}>
                Gabarito oficial: <strong>{formatChoiceDisplay(question.correct)}</strong>
              </small>
            )}

            {!isChoice && pending && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--line)" }}>
                <span style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 8 }}>
                  Avaliação da resposta dissertativa:
                </span>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <label className="choice-option" style={{ margin: 0, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name={`grade_${question.id}`}
                      checked={currentGrade === "correct"}
                      onChange={() => handleGradeChange(question.id, "correct")}
                    />
                    Correta (+8 XP)
                  </label>
                  <label className="choice-option" style={{ margin: 0, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name={`grade_${question.id}`}
                      checked={currentGrade === "partial"}
                      onChange={() => handleGradeChange(question.id, "partial")}
                    />
                    Parcialmente correta (+4 XP)
                  </label>
                  <label className="choice-option" style={{ margin: 0, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name={`grade_${question.id}`}
                      checked={currentGrade === "wrong"}
                      onChange={() => handleGradeChange(question.id, "wrong")}
                    />
                    Incorreta (0 XP)
                  </label>
                </div>
              </div>
            )}

            {!isChoice && !pending && (
              <div style={{ marginTop: 8 }}>
                <span className={`pill ${currentGrade === "correct" ? "green" : currentGrade === "partial" ? "amber" : ""}`}>
                  {currentGrade === "correct" ? "Avaliada como Correta (+8 XP)" : currentGrade === "partial" ? "Avaliada como Parcialmente Correta (+4 XP)" : "Avaliada como Incorreta (0 XP)"}
                </span>
              </div>
            )}
          </div>
        );
      })}

      <form
        onSubmit={async event => {
          event.preventDefault();
          const success = await mutate({type:"review",id:attempt.id,score:Number(score),feedback:feedback.trim(),correctTextIds,partialTextIds});
          if (success) {
            notify("Resultado publicado.");
            close();
          }
        }}
      >
        <div className="form-grid">
          <label className="field">
            <span>Nota final calculada (0 a 100)</span>
            <input
              type="number"
              min={0}
              max={100}
              required
              step={1}
              value={score}
              disabled={!pending}
              onChange={event => setScore(event.target.value)}
            />
          </label>
          <div className="info-note" style={{ alignSelf: "start" }}>
            Critérios: Objetiva +5 XP; Dissertativa Correta +8 XP; Dissertativa Parcial +4 XP. Aprovação (+30 XP) exige nota &ge; {attempt.passingScore}%.
          </div>
        </div>
        <label className="field">
          <span>Feedback para o aluno</span>
          <textarea
            rows={4}
            required
            value={feedback}
            disabled={!pending}
            onChange={event => setFeedback(event.target.value)}
            maxLength={5000}
          />
        </label>
        {pending && (
          <Button disabled={busy} type="submit">
            <CheckCircle2 size={16} /> Publicar resultado
          </Button>
        )}
      </form>

      {attempt.status === "retry" && attempt.retryPolicy === "admin" && !attempt.retryAllowed && (
        <Button
          disabled={busy}
          style={{ marginTop: 15 }}
          onClick={async () => {
            const success = await update(current => ({
              ...current,
              attempts: current.attempts.map(item => (item.id === attempt.id ? { ...item, retryAllowed: true } : item)),
            }));
            if (success) notify("Nova tentativa liberada.");
          }}
        >
          Liberar nova tentativa
        </Button>
      )}
    </section>
  );
}
