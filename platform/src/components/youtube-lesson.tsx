"use client";
import { useEffect, useRef, useState } from "react";
import { useAcademy } from "./academy-provider";
import { browserAuth } from "@/lib/supabase-browser";
import { youtubeEmbed, type Course, type Lesson } from "@/lib/model";
import { isVideoNearEnd } from "@/lib/video-completion";
import { mergeWatched } from "@/lib/pilot-contract";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export function YouTubeLesson({
  course,
  lesson,
  preview,
  initialPosition = 0,
  nextTitle,
  onNext,
}: {
  course: Course;
  lesson: Lesson;
  preview: boolean;
  initialPosition?: number;
  nextTitle?: string;
  onNext?: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<any>(null);
  const { mutate, state } = useAcademy();
  const [error, setError] = useState("");
  const retrySave = useRef<() => void>(() => {});
  const [nearEnd, setNearEnd] = useState(false);

  const completed = (state.completed[course.id] || []).includes(lesson.id);
  const embedUrl = youtubeEmbed(lesson.videoUrl);
  const iframeId = `yt-player-${lesson.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  useEffect(() => {
    let active = true;
    let timer: NodeJS.Timeout | null = null;
    let lastRecord = 0;
    let inFlight = false;
    let queued = false;
    let dirty = false;
    let wasNearEnd = false;
    let token = "";
    let lastSnapshot: { currentTime: number; duration: number } | null = null;
    let lastTracked: number | null = null;
    const watched: [number, number][] = [];
    void browserAuth()?.auth.getSession().then(({ data }) => { token = data.session?.access_token || ""; });

    const commandFor = (currentTime: number, duration: number) => ({
      type: "video" as const, courseId: course.id, version: course.version, lessonId: lesson.id,
      duration, position: currentTime, ranges: mergeWatched(watched, duration).ranges as [number, number][],
    });
    const onExit = () => {
      if (preview || !token || !playerRef.current) return;
      const currentTime = playerRef.current.getCurrentTime?.() || lastSnapshot?.currentTime || 0;
      const duration = playerRef.current.getDuration?.() || lastSnapshot?.duration || 0;
      if (duration > 0) void fetch("/api/academy", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(commandFor(currentTime, duration)), keepalive: true }).catch(() => {});
    };

    const record = async (currentTime: number, duration: number, force = false) => {
      if (preview || duration <= 0 || !active) return;
      lastSnapshot = { currentTime, duration };
      if (inFlight) {
        dirty = true;
        if (force) queued = true;
        return;
      }
      if (!force && Date.now() - lastRecord < 10000) return;
      inFlight = true;
      dirty = false;
      lastRecord = Date.now();

      try {
        setNearEnd(isVideoNearEnd(currentTime, duration));

        const saved = await mutate(commandFor(currentTime, duration), { silent: true });

        if (active) {
          if (!saved) dirty = true;
          setError(saved ? "" : "Não foi possível salvar o avanço. Tentaremos novamente automaticamente.");
        }
      } catch {
        dirty = true;
        if (active) setError("Não foi possível acompanhar o vídeo. Verifique a conexão com o YouTube.");
      } finally {
        inFlight = false;
        if (active) {
          if (queued) {
            queued = false;
            if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
              const cur = playerRef.current.getCurrentTime();
              const dur = playerRef.current.getDuration();
              void record(cur, dur, true);
            }
          }
        }
      }
    };
    const schedule = (currentTime: number, duration: number) => {
      if (lastTracked !== null) {
        const advance = currentTime - lastTracked;
        if (advance > 0 && advance < 5) {
          const previous = watched[watched.length - 1];
          if (previous && lastTracked >= previous[0] && lastTracked <= previous[1] + 0.25) previous[1] = Math.max(previous[1], currentTime);
          else watched.push([lastTracked, currentTime]);
        }
      }
      lastTracked = currentTime;
      lastSnapshot = { currentTime, duration };
      dirty = true;
      void record(currentTime, duration);
    };

    retrySave.current = () => {
      const player = playerRef.current;
      if (player) void record(player.getCurrentTime(), player.getDuration(), true);
    };
    const retryTimer = setInterval(() => { if (dirty) retrySave.current(); }, 10000);

    const setupPlayer = () => {
      if (!active || !window.YT || !window.YT.Player || !iframeRef.current) return;
      try {
        if (playerRef.current && typeof playerRef.current.destroy === "function") {
          playerRef.current.destroy();
        }
        playerRef.current = new window.YT.Player(iframeId, {
          events: {
            onReady: (event: { target: { seekTo: (seconds: number, allowSeekAhead: boolean) => void; getDuration: () => number } }) => {
              const duration = event.target.getDuration();
              const position = duration > 0 ? Math.min(initialPosition, Math.max(0, duration - Math.min(1, duration * 0.005))) : initialPosition;
              if (active && initialPosition > 0) {
                event.target.seekTo(position, true);
              }
              if (active) void record(position, duration, true);
            },
            onStateChange: (event: { data: number }) => {
              if (!active) return;
              const player = playerRef.current;
              if (!player || typeof player.getCurrentTime !== "function") return;

              const currentTime = player.getCurrentTime() || 0;
              const duration = player.getDuration() || 0;

              // 1 = PLAYING
              if (event.data === 1) {
                lastTracked = currentTime;
                if (timer) clearInterval(timer);
                timer = setInterval(() => {
                  if (!active || !playerRef.current) return;
                  const cur = playerRef.current.getCurrentTime() || 0;
                  const dur = playerRef.current.getDuration() || 0;
                  const near = isVideoNearEnd(cur, dur);
                  schedule(cur, dur);
                  if (near && !wasNearEnd) {
                    setNearEnd(near);
                    void record(cur, dur, true);
                  }
                  wasNearEnd = near;
                  window.dispatchEvent(new Event("academy:video-activity"));
                }, 2000);
              } else {
                if (timer) clearInterval(timer);
                if (event.data === 2 || event.data === 0) schedule(currentTime, duration);
                lastTracked = null;
                // 0 = ENDED, 2 = PAUSED
                if (event.data === 0) {
                  setNearEnd(isVideoNearEnd(currentTime, duration));
                  void record(duration, duration, true);
                } else if (event.data === 2) {
                  void record(currentTime, duration, true);
                }
              }
            },
            onError: () => {
              if (active) setError("O YouTube não conseguiu carregar este vídeo. Verifique a URL ou tente novamente.");
            },
          },
        });
      } catch {
        // Fallback silently if iframe replacement is restricted
      }
    };

    // Load YouTube API script if not present
    if (!window.YT) {
      const existingScript = document.getElementById("youtube-iframe-api");
      if (!existingScript) {
        const tag = document.createElement("script");
        tag.id = "youtube-iframe-api";
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      }
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        setupPlayer();
      };
    } else {
      setupPlayer();
    }

    const onVisibility = () => { if (document.visibilityState === "hidden") { onExit(); if (lastSnapshot) void record(lastSnapshot.currentTime, lastSnapshot.duration, true); } };
    window.addEventListener("pagehide", onExit);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      onExit();
      active = false;
      clearInterval(retryTimer);
      retrySave.current = () => {};
      if (timer) clearInterval(timer);
      window.removeEventListener("pagehide", onExit);
      document.removeEventListener("visibilitychange", onVisibility);
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        try {
          playerRef.current.destroy();
        } catch {}
      }
    };
  }, [course.id, course.version, lesson.id, lesson.minutes, mutate, preview, iframeId, initialPosition]);

  return (
    <>
      <div className="video-frame">
        <iframe
          id={iframeId}
          key={lesson.id}
          ref={iframeRef}
          src={embedUrl!}
          title={lesson.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      {(nearEnd || completed) && (
        <div className="video-next-action" aria-live="polite">
          <div>
            <strong>
              {preview ? "Final da prévia" : completed ? "Aula concluída!" : "Final do vídeo"}
            </strong>
            <p>{!preview && !completed ? "Para concluir, assista a pelo menos 50% da aula e chegue ao final. Administradores precisam apenas chegar ao final." : nextTitle ? `A seguir: ${nextTitle}` : "Você chegou à última aula deste curso."}</p>
          </div>
          {onNext && (
            <button className="button button-primary" disabled={!preview && !completed} onClick={onNext}>
              Próxima aula →
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="form-error" role="alert">
          {error}
          <button className="button button-secondary" onClick={() => retrySave.current()}>
            Tentar salvar novamente
          </button>
        </div>
      )}
    </>
  );
}
