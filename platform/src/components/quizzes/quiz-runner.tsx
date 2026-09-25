"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, CircleHelp, Sparkles, Trophy, X } from "lucide-react";
import { browserAuth } from "@/lib/supabase-browser";
import { useAcademy } from "@/components/academy-provider";
import { Button } from "@/components/ui/button";

type Option = { id: string; text: string };
type Question = { id: string; prompt: string; options: Option[]; image_url?: string | null; image_alt?: string | null };
type Quiz = { id: string; title: string; description: string; category: string; xp_reward: number; passing_score: number; questions: Question[] };
type AnswerReview = { questionId: string; selectedOptionId: string; correctOptionId: string; correct: boolean; explanation: string };
type Result = { passed: boolean; scorePercentage: number; xpGranted: number; correctCount: number; questionCount: number; results: AnswerReview[] };

const categoryNames: Record<string, string> = { legislacao: "Legislação", sistema: "Sistema", suporte: "Suporte", pro: "PRO", fiscal: "Fiscal" };

function RichText({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`)/g).map((part, index) => part.startsWith("`") && part.endsWith("`")
    ? <code key={index}>{part.slice(1, -1)}</code> : <span key={index}>{part}</span>)}</>;
}

export function QuizRunner({ id }: { id: string }) {
  const router = useRouter();
  const { refresh } = useAcademy();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const questionRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const session = await browserAuth()?.auth.getSession();
        const token = session?.data.session?.access_token;
        if (controller.signal.aborted) return;
        if (!token) throw new Error("Entre na sua conta para continuar.");
        const response = await fetch("/api/quizzes/active", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Não foi possível carregar o desafio.");
        const data = await response.json() as { quizzes: Quiz[] };
        const found = data.quizzes.find(item => item.id === id);
        if (!found || !found.questions.length) throw new Error("Este desafio não está disponível no momento.");
        if (!controller.signal.aborted) setQuiz(found);
      } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Não foi possível carregar o desafio."); }
    }
    void load();
    return () => controller.abort();
  }, [id]);

  useEffect(() => { if (quiz && !result) questionRef.current?.focus(); }, [quiz, index, result]);
  useEffect(() => { if (result) resultRef.current?.focus(); }, [result]);

  const current = quiz?.questions[index];
  useEffect(() => {
    if (!current || result || busy) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("textarea, select, [contenteditable='true']") || (target instanceof HTMLInputElement && target.type !== "radio")) return;
      const choice = /^[1-4]$/.test(event.key) ? Number(event.key) - 1 : /^[a-d]$/i.test(event.key) ? event.key.toLowerCase().charCodeAt(0) - 97 : -1;
      const option = current?.options[choice];
      if (!option) return;
      event.preventDefault();
      setAnswers(previous => ({ ...previous, [current.id]: option.id }));
      setMessage("");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, result, busy]);

  function leave() {
    if (quiz && !result && Object.keys(answers).length && !window.confirm("Você tem respostas em andamento. Deseja sair do desafio?")) return;
    router.push("/");
  }

  async function submit() {
    if (!quiz || busy) return;
    if (quiz.questions.some(question => !answers[question.id])) { setMessage("Responda todas as questões antes de finalizar."); return; }
    setBusy(true); setMessage("");
    try {
      const session = await browserAuth()?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token) throw new Error("Entre na sua conta para continuar.");
      const response = await fetch(`/api/quizzes/${encodeURIComponent(id)}/submit`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ answers }), cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar as respostas.");
      setResult(data as Result);
      void refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível enviar as respostas."); }
    finally { setBusy(false); }
  }

  function advance() {
    if (!current || !answers[current.id] || busy) return;
    setMessage("");
    if (quiz && index === quiz.questions.length - 1) void submit();
    else setIndex(value => value + 1);
  }

  if (!quiz) return <main className="challenge-page"><Button variant="ghost" onClick={leave}><ArrowLeft size={16} aria-hidden="true"/> Voltar</Button>
    <section className="challenge-card panel" role="status"><h1>Desafio periódico</h1><p>{message || "Carregando desafio…"}</p></section></main>;

  return <main className="challenge-page page-enter">
    {!result ? <>
      <header className="challenge-header">
        <Button variant="ghost" onClick={leave}><ArrowLeft size={17} aria-hidden="true"/> Sair do desafio</Button>
        <div className="challenge-header-badges"><span>{categoryNames[quiz.category] || quiz.category}</span><strong><Sparkles size={15} aria-hidden="true"/> +{quiz.xp_reward} XP</strong></div>
      </header>
      <div className="challenge-progress-text"><span>Questão {index + 1} de {quiz.questions.length}</span><span>{Math.round((index + 1) / quiz.questions.length * 100)}%</span></div>
      <div className="challenge-progress-track" role="progressbar" aria-label="Progresso do desafio" aria-valuemin={0} aria-valuemax={quiz.questions.length} aria-valuenow={index + 1}>
        <span style={{ width: `${(index + 1) / quiz.questions.length * 100}%` }}/>
      </div>
      <section className="challenge-card panel" aria-labelledby="challenge-question">
        <p className="challenge-kicker">{quiz.title}</p>
        <h1 id="challenge-question" ref={questionRef} tabIndex={-1}><RichText text={current!.prompt}/></h1>
        {current!.image_url && <img className="challenge-question-image" src={current!.image_url} alt={current!.image_alt || "Imagem de apoio à questão"}/>}
        <fieldset className="challenge-options"><legend>Selecione uma alternativa</legend>
          {current!.options.map((option, optionIndex) => <label key={option.id} className={`challenge-option${answers[current!.id] === option.id ? " is-selected" : ""}`}>
            <input type="radio" name={current!.id} value={option.id} checked={answers[current!.id] === option.id}
              onChange={() => { setAnswers(previous => ({ ...previous, [current!.id]: option.id })); setMessage(""); }}/>
            <span className="challenge-option-key" aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span>
            <span className="challenge-option-text"><RichText text={option.text}/></span>
            <span className="challenge-option-check" aria-hidden="true"><Check size={17}/></span>
          </label>)}
        </fieldset>
        <p className="challenge-shortcut">Dica: use as teclas 1–4 ou A–D para selecionar.</p>
        {message && <p className="challenge-error" role="alert">{message}</p>}
        <div className="challenge-actions">
          <Button variant="secondary" type="button" disabled={index === 0 || busy} onClick={() => setIndex(value => value - 1)}>Questão anterior</Button>
          <Button type="button" disabled={!answers[current!.id] || busy} onClick={advance}>{busy ? "Enviando…" : index === quiz.questions.length - 1 ? "Finalizar desafio" : "Próxima questão"}<ArrowRight size={17} aria-hidden="true"/></Button>
        </div>
      </section>
    </> : <section className="challenge-result panel" aria-labelledby="challenge-result-title">
      {result.passed && <div className="challenge-confetti" aria-hidden="true">{Array.from({ length: 16 }, (_, piece) => <i key={piece} style={{ "--x": `${(piece - 8) * 31}px`, "--r": `${piece * 71}deg`, "--d": `${piece % 5 * 55}ms` } as CSSProperties}/>)}</div>}
      <span className="challenge-result-icon" aria-hidden="true">{result.passed ? <Trophy size={30}/> : <CircleHelp size={30}/>}</span>
      <p className="challenge-result-kicker">DESAFIO CONCLUÍDO</p>
      <h1 id="challenge-result-title" ref={resultRef} tabIndex={-1}>{result.passed ? "Você conquistou mais uma vitória!" : "Cada resposta é um passo adiante."}</h1>
      <p className="challenge-result-intro">{result.passed ? "Seu conhecimento rendeu uma nova conquista nesta temporada." : "Revise os tópicos abaixo e siga aprendendo. Seu progresso continua."}</p>
      <div className="challenge-score-grid"><div className="challenge-score-ring" aria-label={`${result.scorePercentage}% de aproveitamento`}>
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52"/><circle cx="60" cy="60" r="52" pathLength="100" strokeDasharray={`${result.scorePercentage} 100`} transform="rotate(-90 60 60)"/></svg><strong>{result.scorePercentage}%</strong>
      </div><div className="challenge-score-copy"><strong>{result.correctCount}/{result.questionCount} acertos</strong><span>Nota mínima: {quiz.passing_score}%</span>{result.passed && <p className="challenge-xp-credit"><Sparkles size={20} aria-hidden="true"/> +{result.xpGranted} XP adicionados à sua temporada!</p>}</div></div>
      <details className="challenge-review"><summary>Revisão do gabarito <ChevronDown size={18} aria-hidden="true"/></summary>
        <div className="challenge-review-list">{quiz.questions.map((question, reviewIndex) => {
          const feedback = result.results.find(item => item.questionId === question.id);
          const chosen = question.options.find(option => option.id === feedback?.selectedOptionId)?.text || "Sem resposta";
          const correct = question.options.find(option => option.id === feedback?.correctOptionId)?.text || "Resposta indisponível";
          return <article key={question.id} className="challenge-review-item"><div className="challenge-review-heading"><span>{feedback?.correct ? <CheckCircle2 size={18} aria-hidden="true"/> : <X size={18} aria-hidden="true"/>} Questão {reviewIndex + 1}</span><strong>{feedback?.correct ? "Acertou" : "Revisar"}</strong></div>
            <h2><RichText text={question.prompt}/></h2><p><b>Sua resposta:</b> {chosen}</p><p><b>Resposta correta:</b> {correct}</p><div className="challenge-explanation"><b>Por quê?</b> {feedback?.explanation || "Justificativa ainda não cadastrada."}</div></article>;
        })}</div>
      </details>
      <Button asChild><Link href="/conquistas">Ver minha evolução <ArrowRight size={17} aria-hidden="true"/></Link></Button>
    </section>}
  </main>;
}
