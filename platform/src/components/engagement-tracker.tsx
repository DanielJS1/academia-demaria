"use client";

import { useEffect } from "react";
import { browserAuth } from "@/lib/supabase-browser";
import { ENGAGEMENT_HEARTBEAT_MS, ENGAGEMENT_IDLE_MS } from "@/lib/engagement";
import { useAcademy } from "./academy-provider";

/** Presence is approximate foreground activity, never a source of XP. */
export function EngagementTracker() {
  const { me, isClientEnvironment } = useAcademy();
  useEffect(() => {
    if (isClientEnvironment || me.audience === "client") return;
    const sessionId = crypto.randomUUID();
    let lastActivity = Date.now();
    let lastSent = 0;
    let recording = false;
    let stopped = false;
    let idleTimer: ReturnType<typeof setTimeout>;
    // Serialize transitions so a delayed start cannot arrive after a stop.
    let queue = Promise.resolve();
    const send = (active: boolean) => {
      recording = active;
      lastSent = Date.now();
      queue = queue.then(async () => {
        try {
          const session = await browserAuth()?.auth.getSession();
          if (session?.data.session?.user.id !== me.id) return;
          const token = session.data.session.access_token;
          await fetch("/api/engagement", {
            method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, active }), keepalive: true, cache: "no-store",
          });
        } catch { /* Telemetry cannot interrupt a lesson. Reports expose unavailable data. */ }
      });
    };
    const focused = () => document.visibilityState === "visible" && document.hasFocus();
    const check = () => {
      if (stopped) return;
      const active = focused() && Date.now() - lastActivity < ENGAGEMENT_IDLE_MS;
      if (active && (!recording || Date.now() - lastSent >= ENGAGEMENT_HEARTBEAT_MS)) send(true);
      else if (!active && recording) send(false);
    };
    const activity = () => {
      if (!focused()) return;
      lastActivity = Date.now();
      clearTimeout(idleTimer);
      idleTimer = setTimeout(check, ENGAGEMENT_IDLE_MS + 10);
      check();
    };
    const suspend = () => { if (recording) send(false); };
    const visibility = () => { if (focused()) activity(); else suspend(); };
    const activityEvents = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart", "academy:video-activity"];
    activityEvents.forEach(event => window.addEventListener(event, activity, { passive: true }));
    window.addEventListener("focus", activity);
    window.addEventListener("blur", suspend);
    window.addEventListener("pagehide", suspend);
    document.addEventListener("visibilitychange", visibility);
    const timer = setInterval(check, ENGAGEMENT_HEARTBEAT_MS);
    activity();
    return () => {
      stopped = true;
      clearInterval(timer);
      clearTimeout(idleTimer);
      activityEvents.forEach(event => window.removeEventListener(event, activity));
      window.removeEventListener("focus", activity);
      window.removeEventListener("blur", suspend);
      window.removeEventListener("pagehide", suspend);
      document.removeEventListener("visibilitychange", visibility);
      suspend();
    };
  }, [me.id, me.audience, isClientEnvironment]);
  return null;
}
