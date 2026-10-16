"use client";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Play, Check } from "lucide-react";
import type { ChannelVideo } from "@/lib/kb/channel-videos";
import { ResourceHero } from "./resource-hero";

const CHANNEL = "https://www.youtube.com/@demariasoftware/videos";
const date = (value: string) => new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short", year: "numeric" });
export function VideoGallery({ videos, cached }: { videos: ChannelVideo[]; cached: boolean }) {
  const [selected, setSelected] = useState(videos[0]), [play, setPlay] = useState(false), [limit, setLimit] = useState(6);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!play) return;
    title.current?.focus({ preventScroll: true });
    title.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [selected?.id, play]);
  function choose(video: ChannelVideo) {
    setSelected(video); setPlay(true);
  }
  return <div className="kb-resource-page">
    <ResourceHero title="Vídeos da DeMaria">Novidades, orientações e conversas do nosso canal.</ResourceHero>
    <div className="kb-resource-content">
      <div className="kb-resource-heading"><p>Os vídeos mais recentes aparecem primeiro.</p><a href={CHANNEL} target="_blank" rel="noopener noreferrer">Ver canal no YouTube<ExternalLink size={16} aria-hidden="true"/><span className="sr-only"> (abre em nova aba)</span></a></div>
      {cached && <p className="kb-feed-notice" role="status">Não foi possível atualizar a lista agora. Exibimos os últimos vídeos disponíveis; consulte o canal para conferir novas publicações.</p>}
      {selected && <section className="kb-video-feature" aria-label="Vídeo em destaque">
        <div className="kb-video-feature-copy"><span className="kb-eyebrow">{selected.id === videos[0]?.id ? "Mais recente do canal" : "Vídeo selecionado"}</span><h2 ref={title} tabIndex={-1}>{selected.title}</h2><p>Publicado em <time dateTime={selected.publishedAt}>{date(selected.publishedAt)}</time></p></div>
        <div className="kb-video-player"><iframe key={`${selected.id}-${play}`} title={`Reproduzir: ${selected.title}`} src={`https://www.youtube-nocookie.com/embed/${selected.id}?rel=0&autoplay=${play ? 1 : 0}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div>
        <a className="kb-video-external" href={`https://www.youtube.com/watch?v=${selected.id}`} target="_blank" rel="noopener noreferrer">Assistir no YouTube<ExternalLink size={16} aria-hidden="true"/><span className="sr-only"> (abre em nova aba)</span></a>
      </section>}
      <section aria-labelledby="kb-gallery-title"><h2 id="kb-gallery-title">Explore os vídeos</h2><div className="kb-video-grid">{videos.slice(0, limit).map(video => <button key={video.id} className="kb-video-card" aria-pressed={selected?.id === video.id} aria-label={`Assistir: ${video.title}`} onClick={() => choose(video)}>
        <span className="kb-video-thumbnail"><img src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="" width="480" height="360" loading="lazy"/><span className="kb-video-play"><Play size={24} aria-hidden="true"/></span></span>
        <span className="kb-video-card-copy"><strong>{video.title}</strong><span className="kb-video-card-meta"><time dateTime={video.publishedAt}>{date(video.publishedAt)}</time>{selected?.id === video.id && <span><Check size={14} aria-hidden="true"/>Selecionado</span>}</span></span>
      </button>)}</div>{limit < videos.length && <button className="kb-video-more" onClick={() => setLimit(value => value + 6)}>Mostrar mais vídeos</button>}</section>
    </div>
  </div>;
}
