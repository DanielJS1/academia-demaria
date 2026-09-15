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
          {question.type === "text" && <label className="checkbox-field">
            <input type="checkbox" disabled={!pending} checked={correctTextIds.includes(question.id)} onChange={event => setCorrectTextIds(current => event.target.checked ? [...current, question.id] : current.filter(id => id !== question.id))}/>
            Resposta correta · +8 XP (uma vez por pergunta)
          </label>}
        </div>
      ))}

      <form
        onSubmit={async event => {
          event.preventDefault();
          const success = await mutate({type:"review",id:attempt.id,score:Number(score),feedback:feedback.trim(),correctTextIds});
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
            Acertos: objetiva +5 XP; dissertativa marcada como correta +8 XP. Aprovação: +30 XP na primeira tentativa ou +10 XP após reprovação. Acertos não geram XP repetido.
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
