"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { EmptyState } from "../shared";
import { publishReview, type Attempt } from "@/lib/model";

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
  const { state, update, notify, busy } = useAcademy();
  const [score, setScore] = useState(attempt.score?.toString() || "");
  const [feedback, setFeedback] = useState(attempt.feedback);
  const pending = attempt.status === "pending";

  const studentName = state.people.find(person => person.id === attempt.userId)?.name || "Colaborador";

  return (
    <section className="panel form-panel">
      <Button variant="ghost" size="sm" onClick={close}>
        ← Voltar às correções
      </Button>
      <h2 style={{ marginTop: 19 }}>{attempt.courseTitle}</h2>
      <p>{studentName} · nota mínima {attempt.passingScore}%</p>

      {attempt.questions.map((question, index) => (
        <div className="feedback" key={question.id}>
          <strong>
            {index + 1}. {question.prompt}
          </strong>
          <p style={{ margin: "9px 0" }}>Resposta: {attempt.answers[question.id]}</p>
          {question.type === "choice" && <small>Gabarito da versão enviada: {question.correct}</small>}
        </div>
      ))}

      <form
        onSubmit={async event => {
          event.preventDefault();
          const success = await update(current => publishReview(current, attempt.id, Number(score), feedback.trim()));
          if (success) {
            notify("Resultado publicado.");
            close();
          }
        }}
      >
        <div className="form-grid">
          <label className="field">
            <span>Nota final (0 a 100)</span>
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
            Aprovação libera o XP uma única vez. A nota final é publicada pelo avaliador.
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
