"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, MessageCircle } from "lucide-react";
import { browserAuth } from "@/lib/supabase-browser";
import { type DiscordStatus } from "@/lib/discord";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";

export function DiscordConnection({ showTeam = false }: { showTeam?: boolean }) {
  const { me, state } = useAcademy();
  const [result, setResult] = useState<{ userId: string; data: DiscordStatus }>(), [error, setError] = useState(""), [busy, setBusy] = useState(false), [code, setCode] = useState<{ value: string; expiresAt: string }>();
  const identity = useRef(me.id), inFlight = useRef(false), callbackHandled = useRef(false); identity.current = me.id;
  const request = useCallback(async (command?: unknown, signal?: AbortSignal, endpoint = "/api/discord") => {
    const session = await browserAuth()?.auth.getSession();
    if (!session?.data.session || session.data.session.user.id !== me.id) throw new Error("Entre novamente para conectar seu Discord.");
    const response = await fetch(endpoint, { method: command ? "POST" : "GET", headers: { Authorization: `Bearer ${session.data.session.access_token}`, ...(command ? { "Content-Type": "application/json" } : {}) }, ...(command ? { body: JSON.stringify(command) } : {}), cache: "no-store", signal });
    const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Não foi possível conectar ao Discord."); return data;
  }, [me.id]);
  const load = useCallback(async (signal?: AbortSignal) => {
    const id = me.id;
    try { const data = await request(undefined, signal); if (!signal?.aborted && identity.current === id) { setResult({ userId: id, data }); setError(""); } }
    catch (e) { if (!signal?.aborted && identity.current === id) setError(e instanceof Error ? e.message : "Conexão indisponível."); }
  }, [me.id, request]);
  useEffect(() => { setCode(undefined); setError(""); const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  useEffect(() => {
    if (callbackHandled.current) return;
    const url = new URL(window.location.href), oauthCode = url.searchParams.get("discord_code"), oauthState = url.searchParams.get("discord_state"), oauthError = url.searchParams.get("discord_error");
    if (!oauthCode && !oauthError) return;
    callbackHandled.current = true;
    for (const key of ["discord_code", "discord_state", "discord_error"]) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", url.href);
    if (oauthError) { setError(oauthError); return; }
    const id = me.id; inFlight.current = true; setBusy(true);
    void (async () => {
      try {
        await request({ type: "finish", code: oauthCode, state: oauthState }, undefined, "/api/discord/oauth");
        if (identity.current === id) { await load(); setError("Discord conectado. Você já pode testar sua mensagem privada."); }
      } catch (e) { if (identity.current === id) setError(e instanceof Error ? e.message : "Não foi possível conectar ao Discord."); }
      finally { inFlight.current = false; if (identity.current === id) setBusy(false); }
    })();
  }, [load, me.id, request]);
  const action = async (type: string, extra: Record<string, unknown> = {}) => {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError(""); const id = me.id;
    try {
      const response = await request({ type, ...extra }, undefined, type === "connect" ? "/api/discord/oauth" : "/api/discord"); if (identity.current !== id) return;
      if (type === "connect") {
        const target = new URL(response.url);
        if (target.origin !== "https://discord.com" || target.pathname !== "/oauth2/authorize") throw new Error("Endereço de autorização inválido.");
        window.location.assign(target.href); return;
      }
      if (response.code) setCode({ value: response.code, expiresAt: response.expiresAt });
      else if (type === "test") setError("Mensagem de teste enviada para seu Discord.");
      else { setCode(undefined); await load(); }
    } catch (e) { if (identity.current === id) setError(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const data = result?.userId === me.id ? result.data : undefined;
  return <section className="panel discord-connection" aria-label="Lembretes no Discord" aria-busy={busy}>
    <div className="discord-connection-header">
      <span className="discord-connection-icon"><MessageCircle size={22} aria-hidden="true"/></span>
      <div className="discord-connection-copy"><h2>Lembretes no Discord</h2><p>Receba avisos sobre suas trilhas e prazos por mensagem privada.</p></div>
      {data && <span className={`discord-connection-status ${data.link?.enabled ? "connected" : ""}`}>{data.link?.enabled && <CheckCircle2 size={15} aria-hidden="true"/>}{data.link ? data.link.enabled ? "Conectado" : "Lembretes pausados" : "Não conectado"}</span>}
    </div>
    {!data && !error && <p role="status">Consultando conexão…</p>}
    {data && !data.configured && <p role="status">O bot está em configuração. Seus avisos continuam disponíveis na Academia.</p>}
    {data?.link ? <><div className="discord-connection-main"><p>Conta vinculada: <strong>{data.link.username}</strong></p><Button variant="secondary" disabled={busy} onClick={() => void action("test")}>Testar mensagem privada</Button></div><details className="discord-connection-details"><summary>Gerenciar conexão</summary><div className="trail-actions"><Button variant="secondary" disabled={busy} onClick={() => void action("preference", { enabled: !data.link!.enabled })}>{data.link.enabled ? "Pausar lembretes" : "Permitir lembretes"}</Button><Button variant="ghost" disabled={busy} onClick={() => void action("unlink")}>Desvincular minha conta</Button></div></details></>
      : data?.configured && <><div className="discord-connection-main"><p>Conecte sua conta uma vez para receber os lembretes.</p><Button disabled={busy || !data.oauthConfigured} onClick={() => void action("connect")}><ExternalLink size={16} aria-hidden="true"/>{busy ? "Conectando…" : "Conectar Discord"}</Button></div>{!data.oauthConfigured && <p role="status">O login do Discord está em configuração.</p>}<details className="discord-connection-details"><summary>Vincular por código como alternativa</summary><p>Use esta opção se não conseguir conectar pelo botão.</p><Button variant="secondary" disabled={busy} onClick={() => void action("code")}>Gerar código para vincular</Button></details></>}
    {code && <div className="discord-link-code"><p>No servidor da DeMaria, use este comando. O código é pessoal, vale por dez minutos e só pode ser usado uma vez.</p><label>Comando de vinculação<input readOnly value={`/academia vincular codigo:${code.value}`} onFocus={e => e.currentTarget.select()}/></label><p>Válido até {new Date(code.expiresAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}.</p><div className="trail-actions"><Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(`/academia vincular codigo:${code.value}`); } catch { setError("Selecione o comando e copie com Ctrl+C."); } }}>Copiar comando</Button><Button variant="secondary" disabled={busy} onClick={() => { setCode(undefined); void load(); }}>Já vinculei — atualizar</Button></div></div>}
    {error && <p className="discord-connection-feedback" role="status">{error}</p>}
    {showTeam && data && <div className="trail-table-scroll trail-table"><h3>Conexão da equipe</h3><table><thead><tr><th>Colaborador</th><th>Discord</th></tr></thead><tbody>{data.team.map(p => <tr key={p.userId}><td>{state.people.find(person => person.id === p.userId)?.name ?? "Colaborador"}</td><td>{!p.linked ? "Precisa vincular a conta" : p.enabled ? "Conectado" : "Lembretes pausados"}</td></tr>)}</tbody></table></div>}
    <p className="trail-help discord-connection-help">Permita mensagens privadas do bot no Discord. Seus avisos são enviados apenas a você.</p>
  </section>;
}
