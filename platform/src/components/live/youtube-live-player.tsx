"use client";
import { useEffect, useRef, useState } from "react";
import { PlayCircle } from "lucide-react";
import { youtubeEmbed } from "@/lib/model";

export function YouTubeLivePlayer({ url, title, preview = false }: { url: string; title: string; preview?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!preview);
  const [tabVisible, setTabVisible] = useState(true);
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
    const sync = () => setTabVisible(!document.hidden);
    sync(); document.addEventListener("visibilitychange", sync);
    const observer = new IntersectionObserver(entries => setVisible(entries[0]?.isIntersecting || false));
    if (container.current) observer.observe(container.current);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, []);
  const embed = youtubeEmbed(url);
  const playing = !preview || visible && tabVisible;
  const src = embed ? `${embed}&playsinline=1&rel=0&autoplay=${preview && playing ? 1 : 0}&mute=${preview ? 1 : 0}&origin=${encodeURIComponent(origin)}` : "";
  return <div className={`live-player${preview ? " live-player--preview" : ""}`} ref={container}>
    {src && playing ? <iframe src={src} title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      : <div className="live-player-idle"><PlayCircle size={38} aria-hidden="true" /><span>{preview ? "Prévia da transmissão" : "Vídeo indisponível"}</span></div>}
  </div>;
}
