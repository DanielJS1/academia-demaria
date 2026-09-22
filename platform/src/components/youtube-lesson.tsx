"use client";
import { useEffect, useRef, useState } from "react";
import { useAcademy } from "./academy-provider";
import { youtubeEmbed, type Course, type Lesson } from "@/lib/model";
import { isVideoNearEnd } from "@/lib/video-completion";

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
  nextTitle,
  onNext,
}: {
  course: Course;
  lesson: Lesson;
  preview: boolean;
  nextTitle?: string;
  onNext?: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<any>(null);
  const { mutate, state } = useAcademy();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
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

    const record = async (currentTime: number, duration: number, force = false) => {
      if (preview || duration <= 0 || !active) return;
      if (inFlight) {
        if (force) queued = true;
        return;
      }
      if (!force && Date.now() - lastRecord < 10000) return;
      inFlight = true;
      lastRecord = Date.now();

      try {
        setSaving(true);
        const near = isVideoNearEnd(currentTime, duration);
        if (near) setNearEnd(true);

        const ranges: [number, number][] = [[0, Math.min(currentTime, duration)]];
        const saved = await mutate({
          type: "video",
          courseId: course.id,
          version: course.version,
          lessonId: lesson.id,
          duration: Math.round(duration),
          position: Math.round(currentTime),
          ranges,
        });

        if (active) {
          setError(saved ? "" : "Não foi possível salvar o avanço. Pause o vídeo para tentar novamente.");
        }
      } catch {
        if (active) setError("Não foi possível acompanhar o vídeo. Verifique a conexão com o YouTube.");
      } finally {
        inFlight = false;
        if (active) {
          setSaving(false);
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

    const setupPlayer = () => {
      if (!active || !window.YT || !window.YT.Player || !iframeRef.current) return;
      try {
        if (playerRef.current && typeof playerRef.current.destroy === "function") {
          playerRef.current.destroy();
        }
        playerRef.current = new window.YT.Player(iframeId, {
          events: {
            onStateChange: (event: { data: number }) => {
              if (!active) return;
              const player = playerRef.current;
              if (!player || typeof player.getCurrentTime !== "function") return;

              const currentTime = player.getCurrentTime() || 0;
              const duration = player.getDuration() || (lesson.minutes * 60);

              // 1 = PLAYING
              if (event.data === 1) {
                if (timer) clearInterval(timer);
                timer = setInterval(() => {
                  if (!active || !playerRef.current) return;
                  const cur = playerRef.current.getCurrentTime() || 0;
                  const dur = playerRef.current.getDuration() || (lesson.minutes * 60);
                  const near = isVideoNearEnd(cur, dur);
                  if (near) {
                    setNearEnd(true);
                    void record(cur, dur, true);
                  }
                  window.dispatchEvent(new Event("academy:video-activity"));
                }, 2000);
              } else {
                if (timer) clearInterval(timer);
                // 0 = ENDED, 2 = PAUSED
                if (event.data === 0) {
                  setNearEnd(true);
                  void record(duration, duration, true);
                } else if (event.data === 2) {
                  void record(currentTime, duration, false);
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

    return () => {
      active = false;
      if (timer) clearInterval(timer);
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        try {
          playerRef.current.destroy();
        } catch {}
      }
    };
  }, [course.id, course.version, lesson.id, lesson.minutes, mutate, preview, retry, iframeId]);

  const handleManualComplete = async () => {
    if (preview) return;
    const duration = (lesson.minutes || 1) * 60;
    setSaving(true);
    try {
      await mutate({
        type: "video",
        courseId: course.id,
        version: course.version,
        lessonId: lesson.id,
        duration,
        position: duration,
        ranges: [[0, duration]],
      });
      setNearEnd(true);
    } finally {
      setSaving(false);
    }
  };

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
              {preview ? "Final da prévia" : completed ? "Aula concluída!" : "Registrando conclusão…"}
            </strong>
            <p>{nextTitle ? `A seguir: ${nextTitle}` : "Você chegou à última aula deste curso."}</p>
          </div>
          {onNext && (
            <button className="button button-primary" disabled={!preview && !completed} onClick={onNext}>
              Próxima aula →
            </button>
          )}
        </div>
      )}

      {!preview && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <p className="info-note" style={{ margin: 0 }}>
            {saving
              ? "Salvando seu avanço…"
              : "Regra temporária do piloto: você pode avançar para os últimos 20 segundos para testar a conclusão."}
          </p>
          {!completed && (
            <button
              type="button"
              className="button button-secondary"
              style={{ fontSize: 12, padding: "4px 10px" }}
              disabled={saving}
              onClick={handleManualComplete}
              title="Clique para registrar a conclusão desta aula de YouTube caso o player não sincronize"
            >
              Concluir aula (Piloto)
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="form-error" role="alert">
          {error}
          <button className="button button-secondary" onClick={() => setRetry(v => v + 1)}>
            Reconectar acompanhamento
          </button>
        </div>
      )}
    </>
  );
}
