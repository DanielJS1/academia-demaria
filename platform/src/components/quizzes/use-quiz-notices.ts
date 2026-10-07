"use client";
import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { browserAuth } from "@/lib/supabase-browser";
import { quizNoticesSchema, type QuizNotices } from "@/lib/quiz-notifications";

export function useQuizNotices({ userId, enabled, path, simulated, epoch, apply, busy }: {
  userId: string; enabled: boolean; path: string; simulated: boolean;
  epoch: MutableRefObject<number>; apply: (value: QuizNotices) => void; busy: MutableRefObject<boolean>;
}) {
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (!userId || simulated || busy.current || document.visibilityState !== "visible") return;
    controller.current?.abort();
    const pending = new AbortController(); controller.current = pending;
    const version = ++epoch.current;
    try {
      const session = (await browserAuth()?.auth.getSession())?.data.session;
      if (!session || session.user.id !== userId || pending.signal.aborted || version !== epoch.current) return;
      const response = await fetch("/api/quizzes/notifications", {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store", signal: pending.signal,
      });
      if (!response.ok) return;
      const data = quizNoticesSchema.parse(await response.json());
      if (!pending.signal.aborted && version === epoch.current && data.userId === userId) apply(data);
    } catch { /* A failed refresh keeps the last confirmed state. */ }
  }, [userId, simulated, epoch, apply, busy]);
  useEffect(() => {
    if (!userId || simulated) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const visibility = () => {
      clearInterval(timer); timer = undefined;
      if (document.visibilityState === "visible") {
        void refresh();
        if (enabled) timer = setInterval(() => void refresh(), 60_000);
      } else { controller.current?.abort(); ++epoch.current; }
    };
    const focus = () => void refresh();
    visibility();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer); controller.current?.abort(); ++epoch.current;
      document.removeEventListener("visibilitychange", visibility); window.removeEventListener("focus", focus);
    };
  }, [userId, simulated, enabled, path, refresh, epoch]);
  return refresh;
}
