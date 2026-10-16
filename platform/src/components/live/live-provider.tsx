"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAcademy } from "../academy-provider";
import { browserAuth } from "@/lib/supabase-browser";
import { liveApi } from "@/lib/live-api";
import { liveSummarySchema, type LiveSummary } from "@/lib/live-events";

const empty: LiveSummary = { events: [], highlights: [] };
const Context = createContext<{ data: LiveSummary; loading: boolean; error: string; reload: () => void }>({ data: empty, loading: true, error: "", reload: () => {} });
export function LiveProvider({ children }: { children: ReactNode }) {
  const { me, simulatedCartorioId } = useAcademy();
  const path = usePathname();
  const [data, setData] = useState<LiveSummary>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(0);
  const reload = useCallback(() => setGeneration(value => value + 1), []);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current?.abort(); request.current = controller;
    if (simulatedCartorioId) { setData(empty); setError(""); setLoading(false); return; }
    void liveApi<unknown>("", "GET", undefined, controller.signal).then(body => {
      if (!controller.signal.aborted) { setData(liveSummarySchema.parse(body)); setError(""); }
    }).catch(cause => {
      if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar as aulas ao vivo."); setData(empty); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [me.id, path, simulatedCartorioId, generation]);
  useEffect(() => {
    if (simulatedCartorioId) return;
    const client = browserAuth();
    let debounce: ReturnType<typeof setTimeout>;
    const channel = client?.channel(`academy-live-summary-${me.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "academy_live_events" }, () => {
        clearTimeout(debounce); debounce = setTimeout(reload, 500);
      }).subscribe();
    const refresh = () => { if (!document.hidden) reload(); };
    // Also catches highlight schedules and recovers when websocket delivery is unavailable.
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(debounce); clearInterval(interval);
      window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh);
      if (channel) void client?.removeChannel(channel);
    };
  }, [me.id, simulatedCartorioId, reload]);
  return <Context.Provider value={{ data: simulatedCartorioId ? empty : data, loading, error, reload }}>{children}</Context.Provider>;
}
export function useLive() { return useContext(Context); }
