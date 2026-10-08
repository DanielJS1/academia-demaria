"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { useLive } from "../live/live-provider";
import { useQuizSummary } from "../quizzes/quiz-summary-provider";
import { Button } from "../ui/button";
import { highlightsInputSchema, type Highlight } from "@/lib/live-events";
import { liveApi } from "@/lib/live-api";
import { isCourseActive } from "@/lib/model";

const kindLabels = { course: "Curso", lesson: "Aula específica", quiz: "Desafio", article: "Artigo", live: "Encontro ao vivo", announcement: "Comunicado" };
function inputDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(value)).replace(" ", "T") : "";
}
export function AdminHighlights() {
  const { state } = useAcademy();
  const { data, reload } = useLive();
  const { data: quizData } = useQuizSummary();
  const [items, setItems] = useState<Highlight[]>([]);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try { const result = highlightsInputSchema.parse(await liveApi("/highlights")); setItems(result.items); setVersion(result.version); setDirty(false); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar os destaques."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(next: Highlight[]) { setItems(next); setDirty(true); setNotice(""); }
  function update(index: number, values: Partial<Highlight>) { change(items.map((item, i) => i === index ? { ...item, ...values } : item)); }
  function targets(kind: Highlight["kind"]) {
    if (kind === "course" || kind === "lesson") return state.courses.filter(isCourseActive).map(course => ({ id: course.id, title: course.title, description: course.description }));
    if (kind === "article") return state.articles.filter(article => article.status === "published").map(article => ({ id: article.id, title: article.title, description: article.summary || "" }));
    if (kind === "quiz") return (quizData?.available || []).map(quiz => ({ id: quiz.id, title: quiz.title, description: "Teste seus conhecimentos e avance na temporada." }));
    if (kind === "live") return data.events.map(event => ({ id: event.id, title: event.title, description: event.description }));
    return [];
  }
  function reorder(index: number, offset: number) { const next = [...items]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; change(next); }
  async function save() {
    const parsed = highlightsInputSchema.safeParse({ version, items });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Confira os destaques."); return; }
    setBusy(true); setError("");
    try { const result = highlightsInputSchema.parse(await liveApi("/highlights", "PUT", parsed.data)); setItems(result.items); setVersion(result.version); setDirty(false); setNotice("Destaques publicados na página inicial."); reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  return <section className="admin-highlights">
    <div className="live-admin-intro"><div><span className="eyebrow">A PRIMEIRA DESCOBERTA DO DIA</span><h2>Destaques da página inicial</h2><p>Escolha até oito conteúdos e organize a ordem em que aparecem.</p></div><span className="live-highlight-count">{items.length}<small>/ 8</small></span></div>
    <div className="live-highlight-note"><Sparkles size={20} aria-hidden="true" /><p><strong>A live tem prioridade automática.</strong> Durante uma transmissão, ela ocupa a primeira posição. Os demais destaques seguem sua ordem, até o limite de oito. Vagas livres recebem sugestões da Academia.</p></div>
    {error && <div className="live-form-error" role="alert">{error}<button type="button" onClick={() => void load()}>Recarregar</button></div>}
    {notice && <p className="live-form-success" role="status"><CheckCircle2 size={16} aria-hidden="true" />{notice}</p>}
    {loading ? <p role="status">Carregando os destaques…</p> : <form onSubmit={e => { e.preventDefault(); void save(); }}>
      <fieldset disabled={busy} className="live-highlights-fields"><legend className="sr-only">Conteúdos em destaque</legend>
      {items.map((item, index) => <article className="panel live-highlight-editor" key={item.id}>
        <div className="live-highlight-editor-head"><span><strong>{String(index + 1).padStart(2, "0")}</strong>{item.title || "Novo destaque"}</span><div>
          <button type="button" disabled={index === 0} onClick={() => reorder(index, -1)} aria-label={`Mover destaque ${index + 1} para cima`}><ArrowUp size={16} aria-hidden="true" /></button>
          <button type="button" disabled={index === items.length - 1} onClick={() => reorder(index, 1)} aria-label={`Mover destaque ${index + 1} para baixo`}><ArrowDown size={16} aria-hidden="true" /></button>
          <button type="button" onClick={() => change(items.filter((_, i) => i !== index))} aria-label={`Remover destaque ${index + 1}`}><Trash2 size={16} aria-hidden="true" /></button></div></div>
        <div className="live-editor-fields">
          <label>Tipo de conteúdo<select value={item.kind} onChange={e => update(index, { kind: e.target.value as Highlight["kind"], targetId: "", lessonId: "", href: "" })}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {item.kind !== "announcement" ? <label>Conteúdo<select required value={item.targetId} onChange={e => { const target = targets(item.kind).find(target => target.id === e.target.value); update(index, { targetId: e.target.value, title: target?.title || "", description: target?.description.slice(0, 400) || "", lessonId: "" }); }}><option value="">Selecione um conteúdo</option>{targets(item.kind).map(target => <option key={target.id} value={target.id}>{target.title}</option>)}{item.targetId && !targets(item.kind).some(target => target.id === item.targetId) && <option value={item.targetId}>Conteúdo indisponível · substitua este destaque</option>}</select></label> : <label>Destino na Academia<input required value={item.href} onChange={e => update(index, { href: e.target.value })} placeholder="/aprender" /></label>}
          {item.kind === "lesson" && <label className="live-field-wide">Aula<select required value={item.lessonId} onChange={e => { const lesson = state.courses.find(course => course.id === item.targetId)?.lessons.find(lesson => lesson.id === e.target.value); update(index, { lessonId: e.target.value, title: lesson?.title || item.title }); }}><option value="">Selecione uma aula</option>{state.courses.find(course => course.id === item.targetId)?.lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select></label>}
          <label className="live-field-wide">Título no hero<input required minLength={3} maxLength={120} value={item.title} onChange={e => update(index, { title: e.target.value })} /></label>
          <label className="live-field-wide">Texto do convite<textarea maxLength={400} rows={2} value={item.description} onChange={e => update(index, { description: e.target.value })} /></label>
          <label>Público<select value={item.audience} onChange={e => update(index, { audience: e.target.value as Highlight["audience"] })}><option value="both">Colaboradores e clientes</option><option value="internal">Colaboradores</option><option value="client">Clientes / cartórios</option></select></label>
          <label>Exibir a partir de · Brasília<input type="datetime-local" value={inputDate(item.startsAt)} onChange={e => update(index, { startsAt: e.target.value ? new Date(e.target.value + ":00-03:00").toISOString() : null })} /></label>
          <label>Exibir até · Brasília<input type="datetime-local" value={inputDate(item.endsAt)} onChange={e => update(index, { endsAt: e.target.value ? new Date(e.target.value + ":00-03:00").toISOString() : null })} /><small>Datas vazias mantêm o destaque disponível.</small></label>
        </div></article>)}
      </fieldset>
      {!items.length && <div className="panel live-admin-empty"><Sparkles size={30} aria-hidden="true" /><h3>Sua vitrine, do seu jeito.</h3><p>Sem destaques manuais, a Academia seleciona sugestões automaticamente.</p></div>}
      <div className="live-editor-actions"><Button type="button" variant="secondary" disabled={busy || items.length >= 8} onClick={() => change([...items, { id: crypto.randomUUID(), kind: "course", targetId: "", lessonId: "", title: "", description: "", href: "", audience: "both", startsAt: null, endsAt: null }])}><Plus size={16} aria-hidden="true" />Adicionar destaque</Button>
        <Button type="submit" disabled={busy || !dirty}><Save size={16} aria-hidden="true" />{busy ? "Publicando…" : "Publicar destaques"}</Button><span className="live-muted">{dirty ? "Você tem alterações para publicar." : "Tudo atualizado."}</span></div>
    </form>}
  </section>;
}
