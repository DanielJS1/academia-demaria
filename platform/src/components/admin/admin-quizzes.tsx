"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Clock3, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { browserAuth } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { PeriodicQuizQuestions } from "./periodic-quiz-questions";
import type { PeriodicQuizQuestion as Question } from "@/lib/periodic-quiz-studio";

type Option = { id: string; text: string };
type Draft = { id?: string; title: string; slug: string; description: string; category: string; xpReward: number; passingScore: number;
  periodType: string; targetAudience: string; isActive: boolean; isFeatured: boolean; availableFrom: string; expiresAt: string; questions: Question[] };
type QuizRow = { id: string; title: string; slug: string; description: string; category: string; xp_reward: number; passing_score: number;
  period_type: string; target_audience: string; is_active: boolean; is_featured: boolean; available_from: string; expires_at: string | null;
  questions: { prompt: string; options: Option[]; correct_option_id: string; explanation: string; image_url: string | null; image_alt: string | null }[] };

const categories = [["legislacao", "Legislação"], ["sistema", "Sistema"], ["suporte", "Suporte"], ["pro", "PRO"], ["fiscal", "Fiscal"]];
const periods = [["weekly", "Semanal"], ["biweekly", "Quinzenal"], ["monthly", "Mensal"]];
const letters = "abcdef";
const newQuestion = (): Question => ({ prompt: "", options: letters.slice(0, 4).split("").map(id => ({ id, text: "" })), correctOptionId: "a", explanation: "", imageUrl: "", imageAlt: "" });
function localDate(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function blankDraft(): Draft {
  const now = Date.now();
  return { title: "", slug: "", description: "", category: "sistema", xpReward: 70, passingScore: 70,
    periodType: "weekly", targetAudience: "internal", isActive: false, isFeatured: false,
    availableFrom: localDate(new Date(now).toISOString()), expiresAt: localDate(new Date(now + 7 * 86400000).toISOString()),
    questions: [newQuestion(), newQuestion()] };
}
function toDraft(quiz: QuizRow): Draft {
  return { id: quiz.id, title: quiz.title, slug: quiz.slug, description: quiz.description, category: quiz.category,
    xpReward: quiz.xp_reward, passingScore: quiz.passing_score, periodType: quiz.period_type,
    targetAudience: quiz.target_audience, isActive: quiz.is_active, isFeatured: quiz.is_featured,
    availableFrom: localDate(quiz.available_from), expiresAt: quiz.expires_at ? localDate(quiz.expires_at) : "",
    questions: quiz.questions.map(question => ({ prompt: question.prompt, options: question.options,
      correctOptionId: question.correct_option_id, explanation: question.explanation,
      imageUrl: question.image_url ?? "", imageAlt: question.image_alt ?? "" })) };
}
function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function AdminQuizzes() {
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!draft) return;
    const frame = requestAnimationFrame(() => formRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    }));
    return () => cancelAnimationFrame(frame);
  }, [draft?.id, !!draft]);

  const api = useCallback(async (method: "GET" | "POST" | "PATCH" | "DELETE", payload?: unknown) => {
    const session = await browserAuth()?.auth.getSession();
    const token = session?.data.session?.access_token;
    if (!token) throw new Error("Entre na sua conta para continuar.");
    const response = await fetch("/api/quizzes/manage", { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível acessar os desafios.");
    return data;
  }, []);
  const load = useCallback(async () => {
    try { const data = await api("GET") as { quizzes: QuizRow[] }; setQuizzes(data.quizzes); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar os desafios."); }
    finally { setLoading(false); }
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api("POST", { ...draft, availableFrom: new Date(draft.availableFrom).toISOString(),
        expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null });
      setDraft(null); setNotice("Desafio salvo. Ele aparece na visão geral quando estiver ativo e dentro do período de liberação.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar o desafio."); }
    finally { setBusy(false); }
  }
  async function toggle(quiz: QuizRow) {
    setBusy(true); setError(""); setNotice("");
    try { await api("PATCH", { id: quiz.id, active: !quiz.is_active }); await load(); setNotice(quiz.is_active ? "Desafio pausado." : "Desafio ativado."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível alterar o desafio."); }
    finally { setBusy(false); }
  }
  async function remove(quiz: QuizRow) {
    if (busy || !window.confirm(`Excluir “${quiz.title}”? O desafio sairá do painel e da Visão geral. Tentativas e XP já registrados serão preservados.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api("DELETE", { id: quiz.id });
      if (draft?.id === quiz.id) setDraft(null);
      await load();
      setNotice("Desafio excluído.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível excluir o desafio."); }
    finally { setBusy(false); }
  }

  return <section className="admin-quizzes" aria-labelledby="admin-quizzes-title">
    <div className="admin-quizzes-intro"><div><span className="eyebrow">DESAFIOS PERIÓDICOS</span><h2 id="admin-quizzes-title">Perguntas que movimentam a jornada</h2>
      <p>Cadastre perguntas, gabarito, XP e período de exibição. Os desafios ativos aparecem no carrossel da Visão geral.</p></div>
      <Button type="button" onClick={() => { setDraft(blankDraft()); setError(""); setNotice(""); }}><Plus size={16} aria-hidden="true"/> Criar desafio</Button></div>
    {error && !draft && <p className="admin-quizzes-error" role="alert">{error}</p>}
    {notice && <p className="admin-quizzes-notice" role="status"><Check size={16} aria-hidden="true"/> {notice}</p>}
    {loading ? <p role="status">Carregando desafios…</p> : <div className="admin-quizzes-list">{quizzes.map(quiz => {
      const now = Date.now();
      const expired = !!quiz.expires_at && Date.parse(quiz.expires_at) <= now;
      const status = !quiz.is_active ? "Rascunho / pausado" : expired ? "Prazo encerrado" : Date.parse(quiz.available_from) > now ? "Agendado" : "No ar";
      return <article className="panel admin-quiz-row" key={quiz.id}><div><div className="admin-quiz-row-top"><span className={`admin-quiz-status${status === "No ar" ? " is-live" : ""}`}>{status}</span>{quiz.is_featured && <span className="admin-quiz-featured"><Sparkles size={14} aria-hidden="true"/> Primeiro no banner</span>}</div>
        <h3>{quiz.title}</h3><p>{quiz.questions.length} questões · {quiz.xp_reward} XP · {categories.find(([value]) => value === quiz.category)?.[1] || quiz.category}</p></div>
        <div className="admin-quiz-row-actions"><Button variant="secondary" size="sm" type="button" onClick={() => { setDraft(toDraft(quiz)); setError(""); setNotice(""); }}><Pencil size={15} aria-hidden="true"/> Editar</Button>
          <Button variant="ghost" size="sm" type="button" disabled={busy || (!quiz.is_active && expired)} onClick={() => void toggle(quiz)}>{quiz.is_active ? "Pausar" : "Ativar"}</Button>
          <Button className="admin-quiz-delete" variant="ghost" size="sm" type="button" disabled={busy} onClick={() => void remove(quiz)} aria-label={`Excluir desafio ${quiz.title}`}><Trash2 size={15} aria-hidden="true"/> Excluir</Button></div></article>;
    })}{!quizzes.length && <div className="panel admin-quiz-empty">Nenhum desafio cadastrado. Crie o primeiro para começar.</div>}</div>}

    {draft && <form ref={formRef} className="panel admin-quiz-form" onSubmit={event => void save(event)}>
      <div className="admin-quiz-form-head"><div><span className="eyebrow">{draft.id ? "EDITAR DESAFIO" : "NOVO DESAFIO"}</span><h3>Configuração e perguntas</h3></div>
        <Button type="button" variant="ghost" size="icon" aria-label="Fechar edição" onClick={() => setDraft(null)}><X size={18} aria-hidden="true"/></Button></div>
      <div className="admin-quiz-fields">
        <label className="admin-quiz-field admin-quiz-wide">Título <input required maxLength={200} value={draft.title} onChange={event => setDraft(previous => previous && ({ ...previous, title: event.target.value, slug: previous.id ? previous.slug : slugify(event.target.value) }))}/></label>
        <label className="admin-quiz-field">Identificador na URL <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} value={draft.slug} onChange={event => setDraft(previous => previous && ({ ...previous, slug: event.target.value }))}/></label>
        <label className="admin-quiz-field">Categoria <select value={draft.category} onChange={event => setDraft(previous => previous && ({ ...previous, category: event.target.value }))}>{categories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="admin-quiz-field admin-quiz-wide">Descrição <textarea rows={2} maxLength={2000} value={draft.description} onChange={event => setDraft(previous => previous && ({ ...previous, description: event.target.value }))}/></label>
        <label className="admin-quiz-field">Prêmio em XP <input type="number" min={0} max={500} required value={draft.xpReward} onChange={event => setDraft(previous => previous && ({ ...previous, xpReward: Number(event.target.value) }))}/></label>
        <label className="admin-quiz-field">Nota mínima (%) <input type="number" min={0} max={100} required value={draft.passingScore} onChange={event => setDraft(previous => previous && ({ ...previous, passingScore: Number(event.target.value) }))}/></label>
        <label className="admin-quiz-field">Periodicidade <select value={draft.periodType} onChange={event => setDraft(previous => previous && ({ ...previous, periodType: event.target.value }))}>{periods.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="admin-quiz-field">Público <select value={draft.targetAudience} onChange={event => setDraft(previous => previous && ({ ...previous, targetAudience: event.target.value }))}><option value="internal">Equipe interna</option><option value="client">Clientes</option></select></label>
        <label className="admin-quiz-field">Liberar em <input type="datetime-local" required value={draft.availableFrom} onChange={event => setDraft(previous => previous && ({ ...previous, availableFrom: event.target.value }))}/></label>
        <label className="admin-quiz-field">Encerrar em (opcional) <input type="datetime-local" value={draft.expiresAt} onChange={event => setDraft(previous => previous && ({ ...previous, expiresAt: event.target.value }))}/></label>
      </div>
      <div className="admin-quiz-flags"><label><input type="checkbox" checked={draft.isActive} onChange={event => setDraft(previous => previous && ({ ...previous, isActive: event.target.checked }))}/><span><strong>Ativar desafio</strong><small>Aparece quando chegar a data de liberação.</small></span></label>
        <label><input type="checkbox" checked={draft.isFeatured} onChange={event => setDraft(previous => previous && ({ ...previous, isFeatured: event.target.checked }))}/><span><strong>Mostrar primeiro no banner</strong><small>Prioriza este desafio na Visão geral quando estiver disponível.</small></span></label></div>
      <PeriodicQuizQuestions title={draft.title} questions={draft.questions}
        onChange={questions => setDraft(previous => previous && ({ ...previous, questions }))}/>
      {error && <p className="admin-quizzes-error" role="alert">{error}</p>}
      <div className="admin-quiz-form-actions"><span><Clock3 size={15} aria-hidden="true"/> O prazo segue o horário do seu navegador.</span><Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar desafio"}</Button></div>
    </form>}
  </section>;
}
