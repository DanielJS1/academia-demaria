"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock3, Flame, Heart, MessageCircle, Pencil, Send, Trash2 } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { EmptyState } from "../shared";
import { articleDate, fetchArticle, type ArticleDetailData } from "./article-client";
import { ArticleContent, CommunityXpRules } from "./article-content";
import { tierClass } from "@/lib/gamification";

export function CommunityArticle({ id }: { id: string }) {
  const { state, me, mutate, busy, notify, avatar } = useAcademy();
  const router = useRouter();
  const [data, setData] = useState<ArticleDetailData | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [comment, setComment] = useState("");
  const commentId = useRef<string | null>(null);
  const commentsScrolled = useRef(false);
  const locked = busy || pending || data?.article.coauthor?.id === me.id;
  const reload = useCallback(async () => {
    const next = await fetchArticle(id);
    setData(next);
  }, [id]);
  useEffect(() => {
    const controller = new AbortController();
    commentsScrolled.current = false;
    setLoading(true);
    setLoadError("");
    fetchArticle(id, false, controller.signal).then(next => { if (!controller.signal.aborted) setData(next); }).catch(cause => { if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : "Não foi possível abrir o artigo."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (loading || !data || commentsScrolled.current || window.location.hash !== "#comentarios") return;
    commentsScrolled.current = true;
    const frame = requestAnimationFrame(() => {
      const section = document.getElementById("comentarios");
      const heading = document.getElementById("comentarios-titulo");
      section?.scrollIntoView({ block: "start" });
      heading?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, data]);

  if (loading) return <div className="empty-state" role="status">Abrindo artigo…</div>;
  if (loadError || !data) return <EmptyState title="Artigo indisponível" description={loadError || "Este artigo não foi encontrado."}><Button variant="secondary" onClick={() => { setLoading(true); reload().then(() => setLoadError("")).catch(cause => setLoadError(cause instanceof Error ? cause.message : "Tente novamente.")).finally(() => setLoading(false)); }}>Tentar novamente</Button><Button asChild variant="ghost"><Link href="/conhecimento?aba=biblioteca">Voltar à biblioteca</Link></Button></EmptyState>;
  const article = data.article;
  const own = article.authorId === me.id;
  const coOwn = article.coauthor?.id === me.id;
  const moderator = me.role === "admin" || me.role === "manager";
  const canEdit = own || me.role === "admin";
  const run = async (action: () => Promise<boolean>, success?: () => void) => {
    setError(""); setPending(true);
    try {
      if (!await action()) { setError("A alteração não foi salva. Confira a mensagem do servidor e tente novamente."); return; }
      success?.();
      await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "A alteração foi enviada, mas não conseguimos atualizar a página. Recarregue para conferir."); }
    finally { setPending(false); }
  };
  const deleteArticle = async () => {
    if (!window.confirm(`Excluir “${article.title}”? O artigo e suas interações deixarão de aparecer na biblioteca.`)) return;
    setPending(true); setError("");
    const success = await mutate({ type: "community-delete", articleId: article.id });
    if (success) { notify("Artigo excluído da biblioteca."); router.push("/conhecimento?aba=biblioteca"); }
    else { setError("Não foi possível excluir o artigo. Tente novamente."); setPending(false); }
  };

  return <article className="article-page page-enter community-article">
    <Link href="/conhecimento?aba=biblioteca" className="back-link"><ArrowLeft size={15} /> Voltar à biblioteca</Link>
    <div className="panel">
      <div className="community-article-heading"><span className="pill">{article.category}</span><div className="community-article-actions">{canEdit && <Button asChild variant="secondary" size="sm"><Link href={`/conhecimento/${article.id}/editar`}><Pencil size={15} /> Editar</Link></Button>}{article.community && !own && !article.coauthor && <Button asChild variant="secondary" size="sm"><Link href={`/conhecimento/${article.id}/editar?sugerir=1`}><Pencil size={15} /> Sugerir melhoria</Link></Button>}{moderator && <Button variant="danger" size="sm" disabled={locked} onClick={() => void deleteArticle()}><Trash2 size={15} /> Excluir</Button>}</div></div>
      <h1>{article.title}</h1><div className="article-meta"><span>Por {article.author}{article.coauthor ? ` e ${article.coauthor.name}` : ""}</span><span>{article.product}</span><span>Versão {article.revision}</span><span><Clock3 size={13} /> {articleDate(article.updatedAt)}</span></div>
      {article.updateRequest && <div className="notice-bar community-update-request"><strong>Atualização solicitada</strong><p>{article.updateRequest.message}</p><small>{own ? "Edite o artigo e publique a revisão para concluir a solicitação." : "O autor foi avisado para revisar estas orientações."}</small></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {own && !!article.suggestions?.some(item=>item.status==="pending") && <section className="community-suggestions" aria-label="Melhorias sugeridas"><h2>Melhorias para analisar</h2>{article.suggestions.filter(item=>item.status==="pending").map(item=><div className="community-suggestion" key={item.id}><strong>{item.proposer}</strong><small>{articleDate(item.createdAt)}</small><p>{item.proposedText}</p><div className="community-form-actions"><Button asChild size="sm" variant="secondary"><Link href={`/conhecimento/${article.id}/editar?proposta=${item.id}`}>Ver e revisar proposta</Link></Button></div></div>)}</section>}
      <ArticleContent article={article} />
      {article.community && <>
        <section className="community-reactions" aria-label="Reconhecimento do artigo"><p>Este conteúdo ajudou você?</p><div className="community-reaction-buttons"><Button variant={article.liked ? "default" : "secondary"} disabled={locked || own || coOwn} aria-pressed={!!article.liked} onClick={() => void run(() => mutate({ type: "community-react", articleId: article.id, reaction: "like", active: !article.liked }))}><Heart size={17} fill={article.liked ? "currentColor" : "none"} /> {article.liked ? "Curtido" : "Curtir"} · {article.likeCount || 0}</Button><Button variant={article.hyped ? "default" : "secondary"} disabled={locked || own || coOwn} aria-pressed={!!article.hyped} onClick={() => void run(() => mutate({ type: "community-react", articleId: article.id, reaction: "hype", active: !article.hyped }))}><Flame size={17} /> {article.hyped ? "Hypado" : "Dar hype"} · {article.hypeCount || 0}</Button></div><small>{own || coOwn ? "O reconhecimento dos colegas gera XP para os autores, dentro dos limites da biblioteca." : "Curtir e dar hype reconhece os autores. Você não recebe XP por interagir."}</small></section>
        <section id="comentarios" className="community-comments" aria-labelledby="comentarios-titulo"><h2 id="comentarios-titulo" tabIndex={-1}><MessageCircle size={20} /> Comentários ({data.comments.length})</h2><form onSubmit={event => { event.preventDefault(); if (!commentId.current) commentId.current = crypto.randomUUID(); const submittedId = commentId.current; void run(() => mutate({ type: "community-comment", articleId: article.id, commentId: submittedId, content: comment.trim() }), () => { setComment(""); commentId.current = null; }); }}><label className="field"><span>Contribua com uma dúvida ou complemento</span><textarea value={comment} maxLength={2000} minLength={3} required rows={3} disabled={locked} onChange={event => setComment(event.target.value)} placeholder="Compartilhe uma observação que ajude a equipe…" /></label><Button type="submit" disabled={locked || comment.trim().length < 3}><Send size={15} /> {pending ? "Enviando…" : "Publicar comentário"}</Button></form><div className="community-comment-list">{data.comments.length ? data.comments.map(item => { const commenter = state.people.find(p => p.id === item.userId); const commenterAvatar = commenter?.avatar || (item.userId === me.id ? avatar : undefined); return <div className="community-comment" key={item.id}><div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span className={`avatar avatar-0 tier-avatar ${tierClass(commenter?.xp || 0)}`} title={`Faixa ${tierClass(commenter?.xp || 0).slice(5)}`} style={{ width: 26, height: 26, fontSize: 11, padding: 0 }}>{commenterAvatar ? <img src={commenterAvatar} alt={item.author} className="avatar-img" /> : item.author.slice(0, 1).toUpperCase()}</span><strong>{item.author}</strong></div><time dateTime={item.createdAt}>{articleDate(item.createdAt)}</time></div><p>{item.content}</p></div>; }) : <p className="community-no-comments">Ainda não há comentários. Comece a conversa com uma contribuição útil.</p>}</div></section>
        <CommunityXpRules />
      </>}
    </div>
  </article>;
}
