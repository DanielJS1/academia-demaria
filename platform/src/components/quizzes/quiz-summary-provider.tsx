"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAcademy } from "../academy-provider";
import { browserAuth } from "@/lib/supabase-browser";
import { periodicQuizListSchema, type PeriodicQuizList } from "@/lib/periodic-quizzes";

type Summary = { data: PeriodicQuizList | null; loading: boolean; error: string; simulated: boolean; reload: () => void };
const Context = createContext<Summary | null>(null);

export function QuizSummaryProvider({ children }: { children: ReactNode }) {
  const { me, simulatedCartorioId } = useAcademy();
  const path = usePathname();
  const simulated = !!simulatedCartorioId;
  const [data, setData] = useState<PeriodicQuizList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(0);
  const [now, setNow] = useState(Date.now);
  const reload = useCallback(() => setGeneration(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    if (simulated) { setData(null); setError(""); setLoading(false); return; }
    async function load() {
      setLoading(true);
      try {
        const session = (await browserAuth()?.auth.getSession())?.data.session;
        if (controller.signal.aborted) return;
        if (!session || session.user.id !== me.id) throw new Error("Entre na sua conta para acessar os desafios.");
        const response = await fetch("/api/quizzes", { headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Não foi possível carregar os desafios.");
        const summary = periodicQuizListSchema.parse(body);
        if (!controller.signal.aborted) { setData(summary); setNow(Date.now()); setError(""); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof TypeError
          ? "Não foi possível conectar aos desafios. Confira sua conexão e tente novamente."
          : cause instanceof Error ? cause.message : "Não foi possível carregar os desafios.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [me.id, path, simulated, generation]);

  useEffect(() => {
    const visible = () => { if (document.visibilityState === "visible") reload(); };
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", visible);
    return () => { window.removeEventListener("focus", reload); document.removeEventListener("visibilitychange", visible); };
  }, [reload]);

  useEffect(() => {
    const deadlines = data?.available.flatMap(quiz => quiz.expires_at ? [Date.parse(quiz.expires_at)] : []).filter(time => time > now) ?? [];
    if (!deadlines.length) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(Math.min(...deadlines) - now + 1, 2147483647));
    return () => window.clearTimeout(timer);
  }, [data, now]);

  const current = useMemo(() => data && ({ ...data,
    available: data.available.filter(quiz => !quiz.expires_at || Date.parse(quiz.expires_at) > now),
  }), [data, now]);
  return <Context.Provider value={{ data: simulated ? null : current, loading, error, simulated, reload }}>{children}</Context.Provider>;
}

export function useQuizSummary() {
  const summary = useContext(Context);
  if (!summary) throw new Error("QuizSummaryProvider ausente.");
  return summary;
}
