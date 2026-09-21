"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock3, Flame, Heart, MessageCircle, Pencil, RefreshCw, Send, Trash2 } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { EmptyState } from "../shared";
import { articleDate, fetchArticle, type ArticleDetailData } from "./article-client";
import { ArticleContent, CommunityXpRules } from "./article-content";

export function CommunityArticle({ id }: { id: string }) {
  const { me, mutate, busy, notify } = useAcademy();
  const router = useRouter();
  const [data, setData] = useState<ArticleDetailData | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [comment, setComment] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [reason, setReason] = useState("");
  const commentId = useRef<string | null>(null);
  const locked = busy || pending;
  const reload = useCallback(async () => {
    const next = await fetchArticle(id);
    setData(next);
  }, [id]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    fetchArticle(id, false, controller.signal).then(next => { if (!controller.signal.aborted) setData(next); }).catch(cause => { if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : "Não foi possível abrir o artigo."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  if (loading) return <div className="empty-state" role="status">Abrindo artigo…</div>;
  if (loadError || !data) return <EmptyState title="Artigo indisponível" description={loadError || "Este artigo não foi encontrado."}><Button variant="secondary" onClick={() => { setLoading(true); reload().then(() => setLoadError("")).catch(cause => setLoadError(cause instanceof Error ? cause.message : "Tente novamente.")).finally(() => setLoading(false)); }}>Tentar novamente</Button><Button asChild variant="ghost"><Link href="/conhecimento">Voltar à biblioteca</Link></Button></EmptyState>;
  const article = data.article;
  const own = article.authorId === me.id;
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
    if (success) { notify("Artigo excluído da biblioteca."); router.push("/conhecimento"); }
    else { setError("Não foi possível excluir o artigo. Tente novamente."); setPending(false); }
  };

  return <article className="article-page page-enter community-article">
    <Link href="/conhecimento" className="back-link"><ArrowLeft size={15} /> Voltar à biblioteca</Link>
    <div className="panel">
      <div className="community-article-heading"><span className="pill">{article.category}</span><div className="community-article-actions">{canEdit && <Button asChild variant="secondary" size="sm"><Link href={`/conhecimento/${article.id}/editar`}><Pencil size={15} /> Editar</Link></Button>}{moderator && <><Button variant="ghost" size="sm" disabled={locked} onClick={() => setRequestOpen(value => !value)}><RefreshCw size={15} /> Pedir atualização</Button><Button variant="danger" size="sm" disabled={locked} onClick={() => void deleteArticle()}><Trash2 size={15} /> Excluir</Button></>}</div></div>
      <h1>{article.title}</h1><div className="article-meta"><span>Por {article.author}</span><span>{article.product}</span><span>Versão {article.revision}</span><span><Clock3 size={13} /> {articleDate(article.updatedAt)}</span></div>
      {article.updateRequest && <div className="notice-bar community-update-request"><strong>Atualização solicitada</strong><p>{article.updateRequest.message}</p><small>{own ? "Edite o artigo e publique a revisão para concluir a solicitação." : "O autor foi avisado para revisar estas orientações."}</small></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {requestOpen && moderator && <form className="community-request-form" onSubmit={event => { event.preventDefault(); void run(() => mutate({ type: "community-request-update", articleId: article.id, message: reason.trim() }), () => { setRequestOpen(false); setReason(""); notify("Solicitação de atualização enviada ao autor."); }); }}><label className="field"><span>O que precisa ser corrigido ou atualizado?</span><textarea value={reason} onChange={event => setReason(event.target.value)} minLength={10} maxLength={1000} required rows={3} disabled={locked} placeholder="Indique a etapa, o problema e a orientação esperada." /></label><div className="community-form-actions"><Button type="submit" disabled={locked || reason.trim().length < 10}>Enviar solicitação</Button><Button type="button" variant="ghost" disabled={locked} onClick={() => setRequestOpen(false)}>Cancelar</Button></div></form>}
      <ArticleContent article={article} />
      {article.community && <>
        <section className="community-reactions" aria-label="Reconhecimento do artigo"><p>Este conteúdo ajudou você?</p><div className="community-reaction-buttons"><Button variant={article.liked ? "default" : "secondary"} disabled={locked || own} aria-pressed={!!article.liked} onClick={() => void run(() => mutate({ type: "community-react", articleId: article.id, reaction: "like", active: !article.liked }))}><Heart size={17} fill={article.liked ? "currentColor" : "none"} /> {article.liked ? "Curtido" : "Curtir"} · {article.likeCount || 0}</Button><Button variant={article.hyped ? "default" : "secondary"} disabled={locked || own} aria-pressed={!!article.hyped} onClick={() => void run(() => mutate({ type: "community-react", articleId: article.id, reaction: "hype", active: !article.hyped }))}><Flame size={17} /> {article.hyped ? "Hypado" : "Dar hype"} · {article.hypeCount || 0}</Button></div><small>{own ? "O reconhecimento dos colegas gera XP para você, dentro dos limites da biblioteca." : "Curtir e dar hype reconhece o autor. Você não recebe XP por interagir."}</small></section>
        <section className="community-comments" aria-labelledby="comments-title"><h2 id="comments-title"><MessageCircle size={20} /> Comentários ({data.comments.length})</h2><form onSubmit={event => { event.preventDefault(); if (!commentId.current) commentId.current = crypto.randomUUID(); const submittedId = commentId.current; void run(() => mutate({ type: "community-comment", articleId: article.id, commentId: submittedId, content: comment.trim() }), () => { setComment(""); commentId.current = null; }); }}><label className="field"><span>Contribua com uma dúvida ou complemento</span><textarea value={comment} maxLength={2000} minLength={3} required rows={3} disabled={locked} onChange={event => setComment(event.target.value)} placeholder="Compartilhe uma observação que ajude a equipe…" /></label><Button type="submit" disabled={locked || comment.trim().length < 3}><Send size={15} /> {pending ? "Enviando…" : "Publicar comentário"}</Button></form><div className="community-comment-list">{data.comments.length ? data.comments.map(item => <div className="community-comment" key={item.id}><div><strong>{item.author}</strong><time dateTime={item.createdAt}>{articleDate(item.createdAt)}</time></div><p>{item.content}</p></div>) : <p className="community-no-comments">Ainda não há comentários. Comece a conversa com uma contribuição útil.</p>}</div></section>
        <CommunityXpRules />
      </>}
    </div>
  </article>;
}
