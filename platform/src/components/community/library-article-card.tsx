"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { ArrowRight, FileText, Flame, Heart, MessageCircle } from "lucide-react";
import type { Article } from "@/lib/model";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { articleDate } from "./article-client";

type Reaction = "like" | "hype";
type ReactionState = Pick<Article, "liked" | "hyped" | "likeCount" | "hypeCount">;

export function LibraryArticleCard({ article }: { article: Article }) {
  const { me, mutate, busy } = useAcademy();
  const [optimistic, setOptimistic] = useState<ReactionState | null>(null);
  const [pending, setPending] = useState(false);
  const view = optimistic ? { ...article, ...optimistic } : article;
  const draft = article.status === "draft";
  const own = article.authorId === me.id;
  const href = draft ? `/conhecimento/${article.id}/editar` : `/conhecimento/${article.id}`;
  const disabled = draft || own || pending || busy;

  const react = async (event: MouseEvent<HTMLButtonElement>, reaction: Reaction) => {
    event.stopPropagation();
    if (disabled) return;
    const active = reaction === "like" ? !!view.liked : !!view.hyped;
    setOptimistic({
      liked: reaction === "like" ? !active : !!view.liked,
      hyped: reaction === "hype" ? !active : !!view.hyped,
      likeCount: Math.max(0, (view.likeCount || 0) + (reaction === "like" ? active ? -1 : 1 : 0)),
      hypeCount: Math.max(0, (view.hypeCount || 0) + (reaction === "hype" ? active ? -1 : 1 : 0)),
    });
    setPending(true);
    try { await mutate({ type: "community-react", articleId: article.id, reaction, active: !active }); }
    finally { setOptimistic(null); setPending(false); }
  };

  return <article className="article-card panel community-card">
    <Link href={href} className="community-card-open" aria-label={`${draft ? "Editar" : "Abrir"} artigo: ${article.title}`} />
    <div className="community-card-top"><span className="article-icon"><FileText size={22} /></span><span className="pill">{article.category}</span></div>
    {draft && <span className="community-status">Rascunho privado</span>}{article.updateRequest && <span className="community-status">Atualização solicitada</span>}
    <h3>{article.title}</h3><p>{article.summary || article.content || "Continue o seu rascunho."}</p><div className="community-card-author">{article.author} · {article.product}</div>
    <div className="community-card-stats" aria-label={`Interações com ${article.title}`}>
      {draft ? <><span><Heart size={14} aria-hidden="true" /> {view.likeCount || 0}</span><span><Flame size={14} aria-hidden="true" /> {view.hypeCount || 0}</span><span><MessageCircle size={14} aria-hidden="true" /> {view.commentCount || 0}</span></> : <>
        <Button type="button" variant="ghost" size="sm" className="community-card-action" disabled={disabled} title={own ? "Você não pode curtir o próprio artigo" : undefined} aria-label={`${view.liked ? "Remover curtida de" : "Curtir"} ${article.title}. ${view.likeCount || 0} curtidas`} aria-pressed={!!view.liked} onClick={event => void react(event, "like")}><Heart size={16} fill={view.liked ? "currentColor" : "none"} aria-hidden="true" /> {view.likeCount || 0}</Button>
        <Button type="button" variant="ghost" size="sm" className="community-card-action" disabled={disabled} title={own ? "Você não pode dar hype ao próprio artigo" : undefined} aria-label={`${view.hyped ? "Remover hype de" : "Dar hype a"} ${article.title}. ${view.hypeCount || 0} hypes`} aria-pressed={!!view.hyped} onClick={event => void react(event, "hype")}><Flame size={16} aria-hidden="true" /> {view.hypeCount || 0}</Button>
        <Link href={`${href}#comentarios`} className="community-card-action community-card-comments" aria-label={`Ver ${view.commentCount || 0} comentários de ${article.title}`} onClick={event => event.stopPropagation()}><MessageCircle size={16} aria-hidden="true" /> {view.commentCount || 0}</Link>
      </>}
      {own && !draft && <small className="community-card-own-note">Seu artigo: reações próprias indisponíveis</small>}
    </div>
    <div className="article-footer"><span>Atualizado em {articleDate(article.updatedAt)}</span><ArrowRight size={16} aria-hidden="true" /></div>
  </article>;
}
