"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, CalendarDays, Check, MessageCircle, Pin, Radio, RefreshCw, Send, ShieldCheck, Trash2 } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { LiveBadge } from "./live-badge";
import { YouTubeLivePlayer } from "./youtube-live-player";
import { liveApi, LiveApiError } from "@/lib/live-api";
import { browserAuth } from "@/lib/supabase-browser";
import { liveDate, liveEventSchema, liveMessageSchema, livePlaybackUrl, liveStatusLabels, type LiveEvent, type LiveMessage } from "@/lib/live-events";

type RoomData = { event: LiveEvent; messages: LiveMessage[]; hasOlder: boolean; pinned: LiveMessage | null };
function mergeMessages(previous: LiveMessage[], incoming: LiveMessage[]) {
  return [...new Map([...previous, ...incoming].map(message => [message.id, message])).values()].sort((a, b) => a.seq - b.seq);
}
export function LiveRoom({ id }: { id: string }) {
  const { me, simulatedCartorioId } = useAcademy();
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [pinned, setPinned] = useState<LiveMessage | null>(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chatError, setChatError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const requestId = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const loadedEarlier = useRef(false);
  const messageCount = useRef(0);
  const admin = me.role === "admin";
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await liveApi<RoomData>(`/${id}`, "GET", undefined, signal);
      if (signal?.aborted) return;
      setEvent(liveEventSchema.parse(result.event));
      setMessages(current => mergeMessages(current, result.messages.map(message => liveMessageSchema.parse(message))));
      if (!loadedEarlier.current) setHasOlder(result.hasOlder);
      setPinned(result.pinned); setError("");
    } catch (cause) { if (!signal?.aborted) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir esta aula.");
      if (cause instanceof LiveApiError && [401, 403, 404].includes(cause.status)) { setEvent(null); setMessages([]); setPinned(null); }
    } }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [id]);
  useEffect(() => {
    const controller = new AbortController(); request.current = controller;
    if (simulatedCartorioId) { setError("Saia da simulação para participar de uma aula ao vivo."); setLoading(false); return; }
    void load(controller.signal);
    return () => controller.abort();
  }, [load, simulatedCartorioId]);
  useEffect(() => {
    if (simulatedCartorioId) return;
    const client = browserAuth();
    const channel = client?.channel(`academy-live-room-${id}-${me.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "academy_live_messages", filter: `event_id=eq.${id}` }, payload => {
        const parsed = liveMessageSchema.safeParse(payload.new);
        if (!parsed.success) return;
        const message = parsed.data;
        setMessages(current => {
          const next = mergeMessages(current, [message]);
          return stick.current && !loadedEarlier.current ? next.slice(-500) : next;
        });
        if (payload.eventType === "INSERT" && !loadedEarlier.current && messageCount.current >= 500) setHasOlder(true);
        setPinned(current => message.pinned && !message.removed ? message : current?.id === message.id ? null : current);
        if (payload.eventType === "INSERT" && !stick.current) setUnread(value => value + 1);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "academy_live_events", filter: `id=eq.${id}` }, payload => {
        const row = payload.new;
        const parsed = liveEventSchema.safeParse({ ...row.document, id: row.id, version: row.version });
        if (parsed.success) setEvent(parsed.data);
      })
      .subscribe(status => { setConnected(status === "SUBSCRIBED"); if (status === "SUBSCRIBED") void load(request.current?.signal); });
    return () => { if (channel) void client?.removeChannel(channel); };
  }, [id, me.id, load, simulatedCartorioId]);
  useEffect(() => {
    if (simulatedCartorioId) return;
    const refresh = () => { if (!document.hidden) void load(request.current?.signal); };
    const timer = window.setInterval(refresh, connected ? 60000 : 5000);
    window.addEventListener("online", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load, connected, simulatedCartorioId]);
  useEffect(() => {
    messageCount.current = messages.length;
    if (stick.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages]);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true); setChatError("");
    requestId.current ||= crypto.randomUUID();
    try {
      const result = await liveApi<{ message: LiveMessage }>(`/${id}/chat`, "POST", { action: "send", id: requestId.current, content: text.trim() });
      stick.current = true; setMessages(current => mergeMessages(current, [result.message])); setText(""); requestId.current = null;
    } catch (cause) { setChatError(cause instanceof Error ? cause.message : "Sua mensagem não foi enviada. Tente novamente."); }
    finally { setSending(false); }
  }
  async function moderate(message: LiveMessage, action: "pin" | "remove") {
    setChatError("");
    try {
      const result = await liveApi<{ message: LiveMessage }>(`/${id}/chat`, "POST", { action, id: message.id, ...(action === "pin" ? { pinned: !message.pinned } : {}) });
      setMessages(current => mergeMessages(current, [result.message]));
      setPinned(current => result.message.pinned ? result.message : current?.id === message.id ? null : current);
    } catch (cause) { setChatError(cause instanceof Error ? cause.message : "Não foi possível moderar a mensagem."); }
  }
  async function older() {
    if (!messages.length || olderLoading) return;
    setOlderLoading(true); stick.current = false;
    const height = scroll.current?.scrollHeight || 0;
    try {
      const result = await liveApi<RoomData>(`/${id}?before=${messages[0].seq}`);
      loadedEarlier.current = true;
      setMessages(current => mergeMessages(result.messages, current)); setHasOlder(result.hasOlder);
      requestAnimationFrame(() => { if (scroll.current) scroll.current.scrollTop += scroll.current.scrollHeight - height; });
    } catch { setChatError("Não foi possível carregar mensagens anteriores. Tente novamente."); }
    finally { setOlderLoading(false); }
  }
  if (loading) return <div className="live-room-loading" role="status"><Radio size={28} aria-hidden="true" /><p>Abrindo sua aula…</p></div>;
  if (!event || simulatedCartorioId) return <div className="panel live-room-empty"><h1>Vamos encontrar sua aula.</h1><p role="alert">{error}</p><Button onClick={() => void load()}>Tentar novamente</Button><Link href="/aprender">Voltar para Aprender</Link></div>;
  const playable = event.status === "live" || event.status === "recorded";
  const chatOpen = event.status === "live" && event.chatEnabled;
  return <div className="live-room page-enter">
    <Link href="/aprender#aulas-ao-vivo" className="live-back"><ArrowLeft size={16} aria-hidden="true" />Voltar para Aprender</Link>
    <header className="live-room-heading"><div>{event.status === "live" ? <LiveBadge /> : <span className="live-status">{liveStatusLabels[event.status]}</span>}<h1>{event.title}</h1><p>Com {event.host}<span>·</span><CalendarDays size={15} aria-hidden="true" />{liveDate(event.scheduledAt)} · Brasília</p></div>
      {admin && <Button asChild variant="secondary"><Link href="/admin?aba=ao-vivo"><ShieldCheck size={16} aria-hidden="true" />Gerenciar aula</Link></Button>}</header>
    {error && <div className="live-inline-error" role="alert">{error}<button type="button" onClick={() => void load()}>Reconectar</button></div>}
    <div className="live-room-grid"><div className="live-room-content">
      {playable ? <YouTubeLivePlayer url={livePlaybackUrl(event)} title={event.title} /> : <div className="live-waiting">
        <span className="live-waiting-icon">{event.status === "processing" ? <RefreshCw size={34} aria-hidden="true" /> : <CalendarDays size={34} aria-hidden="true" />}</span>
        <h2>{event.status === "processing" ? "Este encontro continua em breve." : event.status === "cancelled" ? "Este encontro foi cancelado." : "Seu próximo encontro está marcado."}</h2>
        <p>{event.status === "processing" ? "Estamos preparando a gravação. Assim que estiver disponível, você poderá assistir aqui." : event.status === "draft" ? "Esta aula ainda é um rascunho. Agende para convidar os participantes." : event.status === "cancelled" ? "Confira os próximos encontros em Aprender." : `Esperamos você em ${liveDate(event.scheduledAt)}. O player será liberado quando a aula começar.`}</p>
      </div>}
      {playable && <p className="live-player-help">{event.status === "live" ? "Ative o som no player e participe pelo chat ao lado." : "A gravação está disponível. Assista no seu ritmo."}</p>}
      <section className="panel live-about"><span className="eyebrow">SOBRE ESTE ENCONTRO</span><h2>Aprender juntos faz a diferença.</h2><p>{event.description || "Um espaço para descobrir, tirar dúvidas e compartilhar conhecimento com a equipe DeMaria."}</p>
        <div className="live-about-note"><Check size={16} aria-hidden="true" /><span>{event.status === "recorded" ? "O histórico do chat preserva a conversa deste encontro." : "Depois da transmissão, a gravação ficará disponível nesta mesma página."}</span></div></section>
    </div><aside className="live-chat panel" aria-label="Chat da aula">
      <div className="live-chat-heading"><span><MessageCircle size={19} aria-hidden="true" /><h2>{chatOpen ? "Converse com a turma" : "Conversa do encontro"}</h2></span><small className={connected ? "is-connected" : ""}>{connected ? "Conectado" : "Atualização automática · Reconectando"}</small></div>
      {pinned && !pinned.removed && <div className="live-chat-pinned"><span><Pin size={14} aria-hidden="true" />Mensagem fixada</span><strong>{pinned.author_name}</strong><p>{pinned.content}</p></div>}
      <div className="live-chat-scroll" ref={scroll} onScroll={() => { if (!scroll.current) return; stick.current = scroll.current.scrollHeight - scroll.current.scrollTop - scroll.current.clientHeight < 70; if (stick.current) setUnread(0); }}>
        {hasOlder && <button className="live-chat-older" type="button" disabled={olderLoading} onClick={() => void older()}>{olderLoading ? "Carregando…" : "Ver mensagens anteriores"}</button>}
        {!messages.length && <div className="live-chat-empty"><MessageCircle size={30} aria-hidden="true" /><strong>{chatOpen ? "A conversa começa com você." : "Tudo pronto para uma boa conversa."}</strong><p>{chatOpen ? "Envie uma pergunta ou compartilhe uma descoberta." : "As mensagens aparecerão aqui durante a transmissão."}</p></div>}
        <div role="log" aria-label="Mensagens da aula" aria-live="off">{messages.map(message => <article key={message.id} className={`live-chat-message${message.author_id === me.id ? " is-own" : ""}`}>
          <div><strong>{message.author_name}</strong>{message.author_role === "admin" && <span className="live-chat-team">Equipe</span>}<time dateTime={message.created_at}>{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(message.created_at))}</time></div>
          <p className={message.removed ? "is-removed" : ""}>{message.removed ? "Mensagem removida pela moderação." : message.content}</p>
          {admin && !message.removed && <div className="live-chat-moderation"><button type="button" onClick={() => void moderate(message, "pin")} aria-label={message.pinned ? "Desfixar mensagem" : "Fixar mensagem"}><Pin size={14} aria-hidden="true" />{message.pinned ? "Desfixar" : "Fixar"}</button><button type="button" onClick={() => void moderate(message, "remove")} aria-label={`Remover mensagem de ${message.author_name}`}><Trash2 size={14} aria-hidden="true" />Remover</button></div>}
        </article>)}</div>
      </div>
      {!!unread && <button className="live-chat-new" type="button" onClick={() => { stick.current = true; setUnread(0); if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }}>{unread} nova(s) mensagem(ns) ↓</button>}
      {chatError && <p className="live-form-error" role="alert">{chatError}</p>}
      {chatOpen ? <form className="live-chat-form" onSubmit={send}><label htmlFor="live-message">Sua mensagem</label><textarea id="live-message" value={text} onChange={e => { setText(e.target.value); requestId.current = null; }} maxLength={1000} rows={2} placeholder="Pergunte, compartilhe, participe…" disabled={sending} />
        <div><small>{text.length}/1000 · Um envio a cada 3 s</small><Button type="submit" disabled={sending || !text.trim()}><Send size={15} aria-hidden="true" />{sending ? "Enviando…" : "Enviar"}</Button></div></form>
        : <div className="live-chat-closed">{event.status === "live" ? "O chat foi pausado pela equipe." : ["processing", "recorded"].includes(event.status) ? "Chat encerrado. O histórico está disponível para consulta." : "O chat abre quando a transmissão começar."}</div>}
    </aside></div>
  </div>;
}
