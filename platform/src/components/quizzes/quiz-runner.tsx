"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, CircleHelp, Sparkles, Trophy, X } from "lucide-react";
import { browserAuth } from "@/lib/supabase-browser";
import { useAcademy } from "@/components/academy-provider";
import { Button } from "@/components/ui/button";

import { periodicQuizDetailSchema, periodicQuizResultSchema, requiredCorrect, type PeriodicQuiz as Quiz, type PeriodicQuizResult as Result } from "@/lib/periodic-quizzes";

import { QuizSimulationNotice, quizCategoryNames as categoryNames } from "./quiz-center";
import { useQuizSummary } from "./quiz-summary-provider";

function RichText({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`)/g).map((part, index) => part.startsWith("`") && part.endsWith("`")
    ? <code key={index}>{part.slice(1, -1)}</code> : <span key={index}>{part}</span>)}</>;
}

export function QuizRunner({ id }: { id: string }) {
  const { simulatedCartorioId, me } = useAcademy();
  if (simulatedCartorioId) return <div className="challenge-page"><Button asChild variant="ghost"><Link href="/desafios"><ArrowLeft size={16} aria-hidden="true"/> Voltar aos desafios</Link></Button><QuizSimulationNotice/></div>;
  return <PersonalQuizRunner key={`${me.id}:${id}`} id={id}/>;
}

function PersonalQuizRunner({ id }: { id: string }) {
  const router = useRouter();
  const { refresh, me } = useAcademy();
  const { reload: reloadSummary } = useQuizSummary();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [stale, setStale] = useState(false);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const session = await browserAuth()?.auth.getSession();
        const token = session?.data.session?.access_token;
        if (controller.signal.aborted) return;
        if (!token || session?.data.session?.user.id !== me.id) throw new Error("Entre na sua conta para continuar.");
        const response = await fetch(`/api/quizzes/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível carregar o desafio.");
        const detail = periodicQuizDetailSchema.parse(data);
        if (!detail.result && !detail.quiz?.questions.length) throw new Error("Este desafio não está disponível no momento.");
        if (!controller.signal.aborted) { setQuiz(detail.quiz); setResult(detail.result); setMessage(""); setStale(false); }

      } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Não foi possível carregar o desafio."); }
    }
    void load();
    return () => controller.abort();
  }, [id, reload, me.id]);

  useEffect(() => {
    if (!quiz || result) return;
    questionRef.current?.focus({ preventScroll: true });
    questionRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [quiz, index, result]);
  useEffect(() => { if (result) resultRef.current?.focus(); }, [result]);

  const current = quiz?.questions[index];
  function onQuestionKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!current || result || busy || stale || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
    const target = event.target as HTMLElement;
    if (target !== questionRef.current && !target.closest(".challenge-options")) return;
    if (target.closest("textarea, select, [contenteditable='true']") || (target instanceof HTMLInputElement && target.type !== "radio")) return;
    const choice = /^[1-6]$/.test(event.key) ? Number(event.key) - 1 : /^[a-f]$/i.test(event.key) ? event.key.toLowerCase().charCodeAt(0) - 97 : -1;
    const option = current.options[choice];
    if (!option) return;
    event.preventDefault();
    setAnswers(previous => ({ ...previous, [current.id]: option.id }));
    setMessage("");
  }

  function leave() {
    if (quiz && !result && Object.keys(answers).length && !window.confirm("Você tem respostas em andamento. Deseja sair do desafio?")) return;
    router.push("/desafios");
  }

  async function submit() {
    if (!quiz || busy || stale) return;
    if (quiz.questions.some(question => !answers[question.id])) { setMessage("Responda todas as questões antes de finalizar."); return; }
    setBusy(true); setMessage("");
    try {
      const session = await browserAuth()?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token || session?.data.session?.user.id !== me.id) throw new Error("Sua conta mudou. Reabra o desafio na conta atual.");
      const response = await fetch(`/api/quizzes/${encodeURIComponent(id)}/submit`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ answers, expectedRevision: quiz.revision }), cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "QUIZ_REVISION_CONFLICT") setStale(true);
        throw new Error(data.error || "Não foi possível enviar as respostas.");
      }
      const outcome = periodicQuizResultSchema.parse(data);
      if (outcome.replayed) {
        const recovered = await fetch(`/api/quizzes/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
        });
        if (!recovered.ok) throw new Error("O resultado foi salvo. Reabra o desafio para recuperar sua revisão.");
        setQuiz(periodicQuizDetailSchema.parse(await recovered.json()).quiz);
      }
      setResult(outcome);
      reloadSummary();
      void refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível enviar as respostas."); }
    finally { setBusy(false); }
  }

  function advance() {
    if (!current || !answers[current.id] || busy || stale) return;
    setMessage("");
    if (quiz && index === quiz.questions.length - 1) void submit();
    else setIndex(value => value + 1);
  }

  if (!quiz && !result) return <div className="challenge-page"><Button variant="ghost" onClick={leave}><ArrowLeft size={16} aria-hidden="true"/> Voltar</Button>
    <section className="challenge-card panel" role={message ? "alert" : "status"}><h1>Desafio periódico</h1><p>{message || "Carregando desafio…"}</p>
      {message && <Button type="button" variant="secondary" onClick={() => { setMessage(""); setReload(value => value + 1); }}>Tentar novamente</Button>}</section></div>;

  return <div className="challenge-page page-enter" onKeyDown={onQuestionKeyDown}>
    {!result && quiz ? <>
      <header className="challenge-header">
        <Button variant="ghost" onClick={leave}><ArrowLeft size={17} aria-hidden="true"/> Voltar aos desafios</Button>
        <div className="challenge-header-badges"><span>{categoryNames[quiz.category] || quiz.category}</span><strong><Sparkles size={15} aria-hidden="true"/> +{quiz.xp_reward} XP</strong></div>
      </header>
      <h1 className="challenge-title" id="challenge-title">{quiz.title}</h1>
      <div className="challenge-progress-text"><h2 id="challenge-context" ref={questionRef} tabIndex={-1} aria-describedby="challenge-title challenge-question">Questão {index + 1} de {quiz.questions.length}</h2><span aria-hidden="true">{Math.round((index + 1) / quiz.questions.length * 100)}%</span></div>
      <div className="challenge-progress-track" role="progressbar" aria-label="Progresso do desafio" aria-valuemin={0} aria-valuemax={quiz.questions.length} aria-valuenow={index + 1}>
        <span style={{ width: `${(index + 1) / quiz.questions.length * 100}%` }}/>
      </div>
      <p className="challenge-rules">Nota mínima: {quiz.passing_score}% · exige {requiredCorrect(quiz.questions.length, quiz.passing_score)} de {quiz.questions.length} acertos.
        Aprovado recebe {quiz.xp_reward} XP; reprovado recebe 2 XP por acerto, até {quiz.xp_reward} XP. Uma tentativa oficial por edição. As respostas não são salvas após recarregar.</p>
      <section className="challenge-card panel" aria-labelledby="challenge-context">
        <p className="challenge-kicker">ENUNCIADO</p>
        <p id="challenge-question" className="challenge-prompt"><RichText text={current!.prompt}/></p>
        {current!.image_url && <img className="challenge-question-image" src={current!.image_url} alt={current!.image_alt || "Imagem de apoio à questão"}/>}
        <fieldset className="challenge-options" aria-describedby="challenge-question" disabled={busy || stale}><legend>Selecione uma alternativa</legend>
          {current!.options.map((option, optionIndex) => <label key={option.id} className={`challenge-option${answers[current!.id] === option.id ? " is-selected" : ""}`}>
            <input type="radio" name={current!.id} value={option.id} checked={answers[current!.id] === option.id}
              onChange={() => { setAnswers(previous => ({ ...previous, [current!.id]: option.id })); setMessage(""); }}/>
            <span className="challenge-option-key" aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span>
            <span className="challenge-option-text"><RichText text={option.text}/></span>
            <span className="challenge-option-check" aria-hidden="true"><Check size={17}/></span>
          </label>)}
        </fieldset>
        <p className="challenge-shortcut">Dica: com foco nas alternativas ou no número da questão, use 1–{current!.options.length} ou A–{String.fromCharCode(64 + current!.options.length)} para selecionar. Tab e setas também funcionam.</p>
        {message && <p className="challenge-error" role="alert">{message}</p>}
        {stale && <Button type="button" variant="secondary" onClick={() => { setQuiz(null); setAnswers({}); setIndex(0); setReload(value => value + 1); }}>Atualizar desafio e conferir as regras</Button>}
        <div className="challenge-actions">
          <Button variant="secondary" type="button" disabled={index === 0 || busy} onClick={() => setIndex(value => value - 1)}>Questão anterior</Button>
          <Button type="button" disabled={!answers[current!.id] || busy || stale} onClick={advance}>{busy ? "Enviando…" : index === quiz.questions.length - 1 ? "Finalizar desafio" : "Próxima questão"}<ArrowRight size={17} aria-hidden="true"/></Button>
        </div>
      </section>
    </> : result && <section className="challenge-result panel" aria-labelledby="challenge-result-title">
      {result.passed && !result.replayed && <div className="challenge-confetti" aria-hidden="true">{Array.from({ length: 16 }, (_, piece) => <i key={piece} style={{ "--x": `${(piece - 8) * 31}px`, "--r": `${piece * 71}deg`, "--d": `${piece % 5 * 55}ms` } as CSSProperties}/>)}</div>}
      <span className="challenge-result-icon" aria-hidden="true">{result.passed ? <Trophy size={30}/> : <CircleHelp size={30}/>}</span>
      <p className="challenge-result-kicker">DESAFIO CONCLUÍDO</p>
      <h1 id="challenge-result-title" ref={resultRef} tabIndex={-1}>{result.passed ? "Você conquistou mais uma vitória!" : "Cada resposta é um passo adiante."}</h1>
      <p className="challenge-result-intro">{result.passed ? "Seu conhecimento rendeu uma nova conquista nesta temporada." : "Revise os tópicos abaixo e siga aprendendo. Seu progresso continua."}</p>
      <div className="challenge-score-grid"><div className="challenge-score-ring" aria-label={`${result.scorePercentage}% de aproveitamento`}>
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52"/><circle cx="60" cy="60" r="52" pathLength="100" strokeDasharray={`${result.scorePercentage} 100`} transform="rotate(-90 60 60)"/></svg><strong>{result.scorePercentage}%</strong>
      </div><div className="challenge-score-copy"><strong>{result.correctCount ?? "—"}/{result.questionCount ?? "—"} acertos</strong><span>Nota mínima utilizada: {result.passingScore === null ? "Indisponível no histórico" : `${result.passingScore}%`}</span><p className="challenge-xp-credit"><Sparkles size={20} aria-hidden="true"/> {result.newlyGrantedXp > 0 ? `+${result.newlyGrantedXp} XP adicionados à sua temporada!` : `${result.xpGranted} XP registrados nesta tentativa.`}</p></div></div>
      {!result.reviewAvailable && <p>A revisão histórica desta tentativa não está disponível. Seu resultado e XP originais foram preservados.</p>}
      {result.reviewAvailable && <details className="challenge-review"><summary>Revisão do gabarito <ChevronDown size={18} aria-hidden="true"/></summary>
        <div className="challenge-review-list">{(quiz?.questions ?? []).map((question, reviewIndex) => {
          const feedback = result.results.find(item => item.questionId === question.id);
          const chosen = question.options.find(option => option.id === feedback?.selectedOptionId)?.text || "Sem resposta";
          const correct = question.options.find(option => option.id === feedback?.correctOptionId)?.text || "Resposta indisponível";
          return <article key={question.id} className="challenge-review-item"><div className="challenge-review-heading"><span>{feedback?.correct ? <CheckCircle2 size={18} aria-hidden="true"/> : <X size={18} aria-hidden="true"/>} Questão {reviewIndex + 1}</span><strong>{feedback?.correct ? "Acertou" : "Revisar"}</strong></div>
            <h2><RichText text={question.prompt}/></h2>{question.image_url && <img className="challenge-question-image" src={question.image_url} alt={question.image_alt || "Imagem de apoio à questão"}/>}
            <p><b>Sua resposta:</b> {chosen}</p><p><b>Resposta correta:</b> {correct}</p><div className="challenge-explanation"><b>Por quê?</b> {feedback?.explanation || "Justificativa ainda não cadastrada."}</div></article>;
        })}</div>
      </details>}
      <div className="challenge-result-actions"><Button asChild><Link href="/desafios">Voltar aos desafios <ArrowRight size={17} aria-hidden="true"/></Link></Button>
        {me.audience !== "client" && <Button asChild variant="secondary"><Link href="/conquistas">Ver minha evolução</Link></Button>}</div>
    </section>}
  </div>;
}
