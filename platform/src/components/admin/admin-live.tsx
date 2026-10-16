"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, ExternalLink, Play, Plus, Radio, Save, Video, X } from "lucide-react";
import { Button } from "../ui/button";
import { LiveBadge } from "../live/live-badge";
import { YouTubeLivePlayer } from "../live/youtube-live-player";
import { useLive } from "../live/live-provider";
import { liveApi } from "@/lib/live-api";
import { liveDate, liveEventInputSchema, liveHref, liveStatusLabels, type LiveEvent, type LiveEventInput, type LiveStatus } from "@/lib/live-events";

function localDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(value)).replace(" ", "T");
}
function freshEvent(): LiveEventInput {
  return { title: "", description: "", host: "", youtubeUrl: "", recordingUrl: "", scheduledAt: new Date(Date.now() + 86400000).toISOString(), status: "draft", audience: "both", chatEnabled: true, version: 0 };
}
const audiences = { internal: "Colaboradores", client: "Clientes / cartórios", both: "Colaboradores e clientes" };
export function AdminLive() {
  const { reload } = useLive();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<LiveEventInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verified, setVerified] = useState(false);
  const [savedDraft, setSavedDraft] = useState("");
  const dirty = !!draft && JSON.stringify(draft) !== savedDraft;
  const load = useCallback(async () => {
    try { setEvents((await liveApi<{ events: LiveEvent[] }>("/manage")).events); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar as aulas."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function edit(event: LiveEventInput) { setDraft(event); setSavedDraft(JSON.stringify(event)); setVerified(false); setError(""); setNotice(""); }
  async function save(status: LiveStatus = draft!.status) {
    if (!draft || busy) return;
    const parsed = liveEventInputSchema.safeParse({ ...draft, status });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Confira os campos."); return; }
    if (status === "live" && draft.status !== "live" && !verified) { setError("Confira o sinal no YouTube e marque a confirmação para colocar a aula no ar."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await liveApi<{ event: LiveEvent }>("/manage", "POST", parsed.data);
      setEvents(current => [result.event, ...current.filter(event => event.id !== result.event.id)]);
      setDraft(result.event); setSavedDraft(JSON.stringify(result.event)); setVerified(false); reload();
      setNotice(status === "live" ? "Aula no ar! O convite já aparece no hero e em Aprender." : status === "processing" ? "Aula encerrada. Confira a gravação no YouTube antes de publicá-la." : status === "recorded" ? "Gravação publicada na mesma página da aula." : "Aula salva com sucesso.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar. Tente novamente."); }
    finally { setBusy(false); }
  }
  const stages = ["scheduled", "live", "processing", "recorded"];
  const stage = draft ? stages.indexOf(draft.status) : -1;
  return <section className="admin-live">
    <div className="live-admin-intro"><div><span className="eyebrow">ENCONTROS QUE CONECTAM</span><h2>Aulas ao vivo</h2><p>Do primeiro convite à gravação: tudo em um só lugar.</p></div>
      {!draft && <Button onClick={() => edit(freshEvent())}><Plus size={17} aria-hidden="true" />Criar aula ao vivo</Button>}</div>
    <details className="live-setup-guide"><summary><Video size={18} aria-hidden="true" />Como transmitir com YouTube e OBS</summary>
      <ol><li>No YouTube Studio, habilite as transmissões ao vivo com antecedência e crie uma live <strong>não listada</strong>, com incorporação permitida.</li>
        <li>Conecte o OBS ao YouTube. Prepare câmera, microfone e compartilhamento de tela. A chave de transmissão fica somente no OBS.</li>
        <li>Cadastre aqui o link do vídeo, a data e o público. Use <strong>Agendar e publicar</strong> para convidar a turma.</li>
        <li>Inicie a transmissão no OBS e no YouTube. Confira vídeo e áudio; então use <strong>Colocar aula no ar</strong> aqui.</li>
        <li>Ao terminar, encerre no YouTube e no OBS e use <strong>Encerrar aula</strong>. Quando o replay estiver pronto, confira o vídeo e use <strong>Publicar gravação</strong>.</li></ol>
      <p>O chat usa o perfil da Academia. O vídeo fica hospedado no YouTube; quem tiver o link não listado também poderá assisti-lo fora da plataforma.</p>
      <a href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer">Abrir YouTube Studio<ExternalLink size={14} aria-hidden="true" /></a>
    </details>
    {error && <div className="live-form-error" role="alert">{error}{!draft && <button type="button" onClick={() => void load()}>Tentar novamente</button>}</div>}
    {notice && <p className="live-form-success" role="status"><CheckCircle2 size={17} aria-hidden="true" />{notice}</p>}
    {draft ? <form className="panel live-event-editor" onSubmit={(e: FormEvent) => { e.preventDefault(); void save(); }}>
      <div className="live-editor-top"><div><span className="live-status">{liveStatusLabels[draft.status]}</span><h3>{draft.id ? "Cuidar deste encontro" : "Um novo encontro começa aqui."}</h3></div><Button type="button" variant="ghost" disabled={busy} onClick={() => setDraft(null)}><X size={16} aria-hidden="true" />Fechar editor</Button></div>
      <ol className="live-stage-track" aria-label="Etapas da aula">{stages.map((status, index) => <li key={status} className={index <= stage ? "is-done" : ""}><span>{index < stage ? <CheckCircle2 size={14} aria-hidden="true" /> : index + 1}</span>{liveStatusLabels[status as LiveStatus]}</li>)}</ol>
      <fieldset disabled={busy} className="live-editor-fields"><legend className="sr-only">Dados da aula</legend>
        <label className="live-field-wide">Título da aula<input required minLength={3} maxLength={120} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Ex.: Novidades do sistema e dúvidas da turma" autoFocus /></label>
        <label>Quem vai conduzir?<input required minLength={2} maxLength={100} value={draft.host} onChange={e => setDraft({ ...draft, host: e.target.value })} placeholder="Nome do professor ou da equipe" /></label>
        <label>Data e hora · Brasília<input required type="datetime-local" value={localDate(draft.scheduledAt)} onChange={e => { if (e.target.value) setDraft({ ...draft, scheduledAt: new Date(e.target.value + ":00-03:00").toISOString() }); }} /></label>
        <label className="live-field-wide">Link da transmissão no YouTube<input required type="url" value={draft.youtubeUrl} disabled={draft.status === "live"} onChange={e => setDraft({ ...draft, youtubeUrl: e.target.value.trim() })} placeholder="https://www.youtube.com/watch?v=…" /><small>Cole o link do vídeo. A chave do OBS não é necessária aqui.</small></label>
        <label className="live-field-wide">Sobre a aula<textarea maxLength={3000} rows={3} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="O que vamos aprender? Para quem é este encontro?" /></label>
        <label>Público<select value={draft.audience} onChange={e => setDraft({ ...draft, audience: e.target.value as LiveEventInput["audience"] })}>{Object.entries(audiences).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Chat da Academia<select value={String(draft.chatEnabled)} onChange={e => setDraft({ ...draft, chatEnabled: e.target.value === "true" })}><option value="true">Habilitado durante a live</option><option value="false">Pausado</option></select></label>
        {["processing", "recorded"].includes(draft.status) && <label className="live-field-wide">Link da gravação · opcional<input type="url" value={draft.recordingUrl} onChange={e => setDraft({ ...draft, recordingUrl: e.target.value.trim() })} placeholder="Deixe vazio para usar o mesmo vídeo da transmissão" /><small>Use outro link se você editou ou publicou uma nova versão do vídeo.</small></label>}
      </fieldset>
      {draft.youtubeUrl && <details className="live-editor-preview"><summary>Conferir prévia do vídeo</summary><YouTubeLivePlayer url={["processing", "recorded"].includes(draft.status) ? draft.recordingUrl || draft.youtubeUrl : draft.youtubeUrl} title="Prévia administrativa da aula" /></details>}
      {["scheduled", "processing"].includes(draft.status) && <label className="live-check"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} />{draft.status === "scheduled" ? "Conferi o vídeo e o áudio: a transmissão já está no ar no YouTube." : "Conferi o replay no YouTube: a gravação está pronta para assistir."}</label>}
      <div className="live-editor-actions"><Button type="submit" variant="secondary" disabled={busy}><Save size={16} aria-hidden="true" />{busy ? "Salvando…" : "Salvar alterações"}</Button>
        {["draft", "cancelled"].includes(draft.status) && <Button type="button" disabled={busy} onClick={() => void save("scheduled")}><CalendarDays size={16} aria-hidden="true" />Agendar e publicar</Button>}
        {draft.status === "scheduled" && <Button type="button" disabled={busy || !verified} onClick={() => void save("live")}><Radio size={16} aria-hidden="true" />Colocar aula no ar</Button>}
        {draft.status === "live" && <Button type="button" disabled={busy} onClick={() => void save("processing")}>Encerrar aula<ArrowRight size={16} aria-hidden="true" /></Button>}
        {draft.status === "processing" && <><Button type="button" disabled={busy || !verified} onClick={() => void save("recorded")}><Play size={16} aria-hidden="true" />Publicar gravação</Button><Button type="button" variant="ghost" disabled={busy || !verified} onClick={() => void save("live")}>Retomar transmissão</Button></>}
        {draft.id && <Button asChild variant="ghost"><Link href={liveHref(draft.id)}>Abrir página da aula<ExternalLink size={15} aria-hidden="true" /></Link></Button>}
        {["draft", "scheduled"].includes(draft.status) && <Button type="button" variant="ghost" disabled={busy} onClick={() => void save("cancelled")}>Cancelar encontro</Button>}
      </div>
    </form> : loading ? <p role="status">Carregando seus encontros…</p> : events.length ? <div className="live-admin-list">{[...events].sort((a, b) => Number(b.status === "live") - Number(a.status === "live") || b.scheduledAt.localeCompare(a.scheduledAt)).map(event =>
      <article className="panel live-admin-row" key={event.id}><div>{event.status === "live" ? <LiveBadge /> : <span className="live-status">{liveStatusLabels[event.status]}</span>}<h3>{event.title}</h3><p>{liveDate(event.scheduledAt)} · {event.host} · {audiences[event.audience]}</p></div><div><Button variant="secondary" onClick={() => edit(event)}>Gerenciar</Button><Button asChild variant="ghost"><Link href={liveHref(event.id)}>Ver aula<ArrowRight size={15} aria-hidden="true" /></Link></Button></div></article>
    )}</div> : <div className="panel live-admin-empty"><Radio size={34} aria-hidden="true" /><h3>Seu primeiro encontro está por vir.</h3><p>Crie uma aula, convide a turma e transforme conhecimento em conversa.</p><Button onClick={() => edit(freshEvent())}>Criar primeira aula<Plus size={16} aria-hidden="true" /></Button></div>}
  </section>;
}
