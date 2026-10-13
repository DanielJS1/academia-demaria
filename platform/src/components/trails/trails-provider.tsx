"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { browserAuth } from "@/lib/supabase-browser";
import { type TrailCommand, type TrailNotice, type TrailsData } from "@/lib/trails";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";

type Context = { data?: TrailsData; loading: boolean; error: string; saving: boolean; refresh: () => Promise<void>; command: (command: TrailCommand) => Promise<boolean> };
const TrailsContext = createContext<Context | null>(null);
export function TrailsProvider({ children }: { children: React.ReactNode }) {
  const { me, isClientEnvironment, notify } = useAcademy();
  const [result, setResult] = useState<{ userId: string; data?: TrailsData; error: string }>();
  const [saving, setSaving] = useState(false);
  const identity = useRef(me.id); identity.current = me.id;
  const sequence = useRef(0), busy = useRef(false);
  const request = useCallback(async (command?: TrailCommand, signal?: AbortSignal) => {
    const session = await browserAuth()?.auth.getSession();
    if (!session?.data.session || session.data.session.user.id !== me.id) throw new Error("Entre novamente para consultar as trilhas.");
    const response = await fetch("/api/trilhas", { method: command ? "POST" : "GET", headers: { Authorization: `Bearer ${session.data.session.access_token}`, ...(command ? { "Content-Type": "application/json" } : {}) }, body: command ? JSON.stringify(command) : undefined, cache: "no-store", signal });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível consultar as trilhas."); return data;
  }, [me.id]);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (isClientEnvironment) return;
    const version = ++sequence.current, userId = me.id;
    try { const data = await request(undefined, signal); if (!signal?.aborted && version === sequence.current && identity.current === userId) setResult({ userId, data, error: "" }); }
    catch (e) { if (!signal?.aborted && version === sequence.current && identity.current === userId) setResult({ userId, error: e instanceof Error ? e.message : "Trilhas indisponíveis." }); }
  }, [isClientEnvironment, me.id, request]);
  useEffect(() => { const abort = new AbortController(); void load(abort.signal); return () => abort.abort(); }, [load]);
  const command = useCallback(async (input: TrailCommand) => {
    if (busy.current) return false; busy.current = true; setSaving(true);
    try { await request(input); await load(); return true; }
    catch (e) { notify(e instanceof Error ? e.message : "Não foi possível salvar."); return false; }
    finally { busy.current = false; setSaving(false); }
  }, [request, load, notify]);
  const current = result?.userId === me.id ? result : undefined;
  return <TrailsContext.Provider value={{ data: current?.data, loading: !isClientEnvironment && !current, error: current?.error ?? "", saving, refresh: load, command }}>{children}{!isClientEnvironment && <LearningPopup key={me.id}/>}</TrailsContext.Provider>;
}
export function useTrails() { const context = useContext(TrailsContext); if (!context) throw new Error("Trilhas fora do provedor."); return context; }
const priority: Record<string, number> = { overdue: 0, deadline: 1, manual: 2, assigned: 3, inactive: 4, "low-access": 5, resume: 6 };
function LearningPopup() {
  const { me } = useAcademy();
  const { data, command, saving } = useTrails();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<TrailNotice>();
  const shown = useRef(false);
  useEffect(() => {
    if (!data || shown.current) return;
    const popup = data.notices.filter(n => n.userId === me.id && n.popup && !n.seenAt && !n.resolvedAt).sort((a, b) => (priority[a.kind] ?? 3) - (priority[b.kind] ?? 3) || b.createdAt.localeCompare(a.createdAt))[0];
    if (!popup) return;
    // One blocking popup per browser entry/day; unread notices remain accessible in the bell.
    const key = `academy.learning-popup.${me.id}`;
    try { if (sessionStorage.getItem(key) === new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })) return; sessionStorage.setItem(key, new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })); } catch { /* session-only ref still limits frequency */ }
    shown.current = true; setSelected(popup);
  }, [data, me.id]);
  useEffect(() => { if (selected && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [selected]);
  const close = async () => {
    if (!selected || saving) return;
    // Failure never traps a collaborator behind the overlay; the server can offer the notice again later.
    dialog.current?.close(); const id = selected.id; setSelected(undefined); await command({ type: "ack", id });
  };
  return <dialog ref={dialog} className="learning-dialog" aria-labelledby="learning-popup-title" aria-describedby="learning-popup-message" onCancel={event => { event.preventDefault(); void close(); }}>
    {selected && <><span className="eyebrow">SUA JORNADA DE APRENDIZADO</span><h2 id="learning-popup-title">{selected.title}</h2><p id="learning-popup-message">{selected.message}</p><div className="trail-actions"><Button asChild><Link href={selected.link} onClick={() => void close()}>Abrir {selected.kind === "resume" ? "curso" : "trilhas"}</Link></Button><Button variant="secondary" disabled={saving} onClick={() => void close()}>Fechar aviso</Button></div></>}
  </dialog>;
}
