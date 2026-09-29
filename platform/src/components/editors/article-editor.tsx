"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Check, Eye, FileText, Pencil, Save } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { EmptyState, PageHeading } from "../shared";
import { articleSchema, type Article } from "@/lib/model";
const RichArticleEditor = dynamic(() => import("./rich-article-editor").then(module => module.RichArticleEditor), { ssr: false, loading: () => <div className="rich-article-editor" role="status" aria-busy="true">Preparando editor…</div> });
import { ArticleContent, CommunityXpRules } from "../community/article-content";
import { fetchArticle, type ArticleDetailData } from "../community/article-client";
import { uploadMedia } from "@/lib/storage-service";

async function legacyDocument(blocks: NonNullable<Article["blocks"]>) {
  const content = [];
  for (const block of blocks) {
    if (block.type === "image" && block.src) {
      let src = block.src;
      if (src.startsWith("data:image/")) {
        const blob = await (await fetch(src)).blob();
        src = await uploadMedia(new File([blob], `imagem-${block.id}.${blob.type.split("/")[1] || "png"}`, { type: blob.type }), "article-image");
      }
      content.push({ type: "image", attrs: { src, alt: block.alt || block.caption || "Imagem do procedimento" } });
    } else if (block.type === "steps" || block.type === "bullets") {
      content.push({ type: block.type === "steps" ? "orderedList" : "bulletList", content: (block.items || []).map(item => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: item }] }] })) });
    } else {
      const type = block.type === "heading" ? "heading" : block.type === "callout" ? "blockquote" : "paragraph";
      const paragraph = { type: "paragraph", content: [{ type: "text", text: block.text || "" }] };
      content.push(type === "blockquote" ? { type, content: [paragraph] } : type === "heading" ? { type, attrs: { level: 2 }, content: paragraph.content } : paragraph);
    }
  }
  return { type: "doc" as const, content };
}

export function ArticleEditor({ id, suggest = false, proposalId }: { id: string; suggest?: boolean; proposalId?: string }) {
  const { state, me, ready } = useAcademy();
  const [loaded, setLoaded] = useState<ArticleDetailData | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (id === "novo" || !ready) return;
    const controller = new AbortController();
    fetchArticle(id, !suggest && !proposalId, controller.signal, proposalId).then(data => { setLoaded(data); setError(""); }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível abrir o artigo."); });
    return () => controller.abort();
  }, [id, ready, attempt, suggest, proposalId]);
  if (!ready) return <div className="empty-state" role="status">Preparando o editor…</div>;
  if (me.audience === "client") return <EmptyState title="Acesso restrito" description="A biblioteca colaborativa é exclusiva para colaboradores." />;
  if (error) return <EmptyState title="Não foi possível abrir o artigo" description={error}><Button onClick={() => { setError(""); setAttempt(value => value + 1); }}>Tentar novamente</Button></EmptyState>;
  if (id !== "novo" && (!loaded || loaded.article.id !== id)) return <div className="empty-state" role="status">Carregando conteúdo do artigo…</div>;
  const mode = proposalId ? "review" : suggest ? "suggest" : "author";
  if (mode === "suggest" && (!loaded?.article.community || loaded.article.authorId === me.id || !!loaded.article.coauthor)) return <EmptyState title="Sugestão indisponível" description="Este artigo não está aberto a novas propostas de melhoria." />;
  if (mode === "review" && (!loaded?.proposal || loaded.original?.authorId !== me.id)) return <EmptyState title="Proposta indisponível" description="Apenas o autor pode revisar esta proposta." />;
  if (mode === "author" && loaded && loaded.article.authorId !== me.id && me.role !== "admin") return <EmptyState title="Edição restrita ao autor" description="Você pode sugerir uma melhoria pela página do artigo." />;
  return <ArticleEditorForm key={`${id}:${mode}:${proposalId || ""}`} initial={id === "novo" ? undefined : loaded!.article} firstProduct={state.products[0] || "Academia DeMaria"} mode={mode} proposal={loaded?.proposal} original={loaded?.original} />;
}

function ArticleEditorForm({ initial, firstProduct, mode, proposal, original }: { initial?: Article; firstProduct: string; mode: "author" | "suggest" | "review"; proposal?: ArticleDetailData["proposal"]; original?: Article }) {
  const { state, me, mutate, busy, notify } = useAcademy();
  const router = useRouter();
  const [article, setArticle] = useState<Article>(() => initial ? { ...initial, richContent: initial.richContent || { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: initial.content }] }] }, blocks: undefined } : {
    id: crypto.randomUUID(), title: "", product: firstProduct, category: "Passo a passo", content: "", status: "draft", revision: 1,
    author: me.name, authorId: me.id, community: true, updatedAt: new Date().toISOString(), richContent: { type: "doc", content: [{ type: "paragraph" }] },
  });
  const [expectedVersion, setExpectedVersion] = useState(initial?.revision || 0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState("");
  const [tagsInput, setTagsInput] = useState((initial?.tags || []).join(", "));
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [legacyReady, setLegacyReady] = useState(!initial?.blocks?.length || !!initial.richContent);
  useEffect(() => {
    if (!initial?.blocks?.length || initial.richContent) return;
    let cancelled = false;
    void legacyDocument(initial.blocks).then(richContent => { if (!cancelled) { setArticle(current => ({ ...current, richContent, blocks: undefined })); setLegacyReady(true); } }).catch(cause => setError(cause instanceof Error ? cause.message : "Falha ao migrar imagens do artigo."));
    return () => { cancelled = true; };
  }, [initial]);
  const locked = busy || saving || uploading;
  const edit = (change: Partial<Article>) => { setArticle(current => ({ ...current, ...change })); setDirty(true); setSaved(""); };
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);

  const save = async (publish: boolean) => {
    setError("");
    const content = article.content.trim();
    const data = { ...article, blocks: undefined, title: article.title.trim(), content, summary: content.slice(0, 250), status: mode === "author" && !publish ? "draft" as const : "published" as const };
    if (!articleSchema.safeParse(data).success) { setError("Revise os campos: título de 3 a 120 caracteres, categoria e conteúdo dentro dos limites indicados."); return; }
    if ((publish || mode !== "author") && content.length < 80) { setError("Explique o procedimento em pelo menos 80 caracteres antes de publicar."); return; }
    if (new TextEncoder().encode(JSON.stringify(article.richContent)).length > 1.5 * 1024 * 1024) { setError("O conteúdo excede 1,5 MB."); return; }
    if (mode === "suggest" && !dirty) { setError("Edite o artigo antes de enviar sua sugestão."); return; }
    if (mode === "suggest" && (message.trim().length < 20 || message.trim().length > 500)) { setError("Explique a melhoria em 20 a 500 caracteres."); return; }
    if (mode === "review" && proposal?.legacy && !dirty) { setError("Esta proposta antiga contém apenas um trecho. Faça os ajustes no artigo completo antes de aceitar."); return; }
    setSaving(true);
    try {
      const command = mode === "suggest"
        ? { type: "community-suggest" as const, articleId: article.id, expectedVersion, message: message.trim(), data }
        : mode === "review"
          ? { type: "community-review-suggestion" as const, articleId: article.id, suggestionId: proposal!.id, decision: "accept" as const, ...(dirty ? { data } : {}) }
          : { type: "community-save" as const, data, publish, expectedVersion };
      const success = await mutate(command);
      if (!success) { setError("Não foi possível salvar. Seu texto continua no editor; confira a mensagem do servidor e tente novamente."); return; }
      setDirty(false);
      if (mode !== "author") { notify(mode === "suggest" ? "Proposta enviada ao autor para revisão." : "Melhoria publicada. Coautoria registrada."); router.push(`/conhecimento/${article.id}`); return; }
      if (publish) { notify("Artigo publicado na biblioteca."); router.push(`/conhecimento/${article.id}`); return; }
      const latest = await fetchArticle(article.id, true);
      setArticle(latest.article);
      setExpectedVersion(latest.article.revision);
      setSaved("Rascunho salvo no servidor. A publicação atual foi preservada.");
      if (!initial) router.replace(`/conhecimento/${article.id}/editar`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível confirmar o salvamento. Reabra o rascunho antes de tentar novamente."); }
    finally { setSaving(false); }
  };

  const reject = async () => {
    if (!proposal) return;
    setError(""); setSaving(true);
    try {
      const success = await mutate({ type: "community-review-suggestion", articleId: article.id, suggestionId: proposal.id, decision: "reject" });
      if (!success) { setError("Não foi possível recusar a proposta. Tente novamente."); return; }
      setDirty(false); notify("Proposta recusada."); router.push(`/conhecimento/${article.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível recusar a proposta. Tente novamente."); }
    finally { setSaving(false); }
  };

  return <div className="page-enter community-editor">
    <Link href={mode === "author" ? "/conhecimento?aba=biblioteca" : `/conhecimento/${article.id}`} className="back-link" onClick={event => { if (dirty && !window.confirm("Sair sem salvar as alterações deste artigo?")) event.preventDefault(); }}><ArrowLeft size={15} /> {mode === "author" ? "Voltar à biblioteca" : "Voltar ao artigo"}</Link>
    <PageHeading title={mode === "suggest" ? "Sugira uma melhoria." : mode === "review" ? "Revise a proposta." : initial ? "Aprimore seu conhecimento." : "Compartilhe o que você sabe."} description={mode === "suggest" ? "Edite o artigo completo. O autor verá sua versão e decidirá se a publica." : mode === "review" ? "Confira a versão proposta, ajuste o que precisar e decida se deseja publicar." : "Registre um procedimento que ajude alguém da equipe a resolver um problema."} />
    {mode === "review" && proposal && <div className="notice-bar community-update-request"><strong>Proposta de {proposal.proposer}</strong><p>{proposal.message}</p>{original && <details><summary>Ver a versão publicada atualmente</summary><h3>{original.title}</h3><ArticleContent article={original} /></details>}</div>}
    {mode === "author" && article.updateRequest && <div className="notice-bar community-update-request"><strong>Atualização solicitada</strong><p>{article.updateRequest.message}</p><small>A solicitação será concluída quando você publicar a revisão.</small></div>}
    <div className="editor-grid">
      <section className="panel form-panel">
        {error && <div className="form-error" role="alert">{error}</div>}
        {saved && <p className="community-save-status" role="status"><Check size={16} /> {saved}</p>}
        <label className="field"><span>Título do artigo</span><input value={article.title} maxLength={120} disabled={locked} onChange={event => edit({ title: event.target.value })} placeholder="Ex.: Como corrigir uma configuração de impressão" /></label>
        <div className="form-grid"><label className="field"><span>Produto</span><select value={article.product} disabled={locked} onChange={event => edit({ product: event.target.value })}>{Array.from(new Set([article.product, ...state.products])).map(item => <option key={item}>{item}</option>)}</select></label><label className="field"><span>Categoria</span><input value={article.category} maxLength={80} disabled={locked} onChange={event => edit({ category: event.target.value })} /></label></div>
        <label className="field"><span>Tags de busca</span><input value={tagsInput} disabled={locked} onChange={event => { setTagsInput(event.target.value); edit({ tags: event.target.value.split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 12) }); }} placeholder="Ex.: SQL, configuração, impressão" /></label>
        {mode === "suggest" && <label className="field"><span>O que você melhorou?</span><textarea value={message} onChange={event => setMessage(event.target.value)} minLength={20} maxLength={500} rows={3} disabled={locked} required placeholder="Explique ao autor o motivo das alterações…" /></label>}
        <div className="community-editor-mode"><span>Por {article.author || me.name}</span><Button type="button" variant="secondary" size="sm" onClick={() => setPreview(value => !value)}>{preview ? <Pencil size={15} /> : <Eye size={15} />} {preview ? "Continuar editando" : "Ver prévia"}</Button></div>
        {!legacyReady ? <div role="status">Preparando imagens antigas no storage…</div> : preview ? <section aria-label="Prévia do artigo"><h2>{article.title || "Título do artigo"}</h2><ArticleContent article={article} /></section> : <RichArticleEditor value={article.richContent || { type: "doc" }} disabled={locked} onUploadingChange={setUploading} onChange={(richContent, content) => edit({ richContent, content })} />}
      </section>
      <aside className="panel form-panel editor-aside community-editor-aside">
        <FileText size={28} color="var(--primary)" /><h2>Conhecimento que ajuda</h2><p>Explique o objetivo, os pré-requisitos, cada etapa e como conferir o resultado. Remova dados de clientes das capturas.</p>
        {mode === "author" && <Button variant="secondary" disabled={locked || !legacyReady} onClick={() => void save(false)}><Save size={16} /> {saving ? "Salvando…" : "Salvar rascunho"}</Button>}
        <Button disabled={locked || !legacyReady || (mode === "suggest" && !dirty)} onClick={() => void save(true)}><Check size={16} /> {mode === "suggest" ? "Enviar proposta ao autor" : mode === "review" ? dirty ? "Aceitar com ajustes" : "Aceitar e publicar" : initial?.status === "published" ? "Publicar revisão" : "Publicar artigo"}</Button>
        {mode === "review" && <Button variant="ghost" disabled={locked} onClick={() => void reject()}>Recusar proposta</Button>}
        <p className="article-size-note">{mode === "suggest" ? "O artigo publicado só mudará após a aprovação do autor." : mode === "review" ? "Ao aceitar, a versão revisada substitui o artigo publicado e o colega vira coautor." : dirty ? "Você tem alterações ainda não salvas." : "O artigo só muda para a equipe ao publicar."}</p>
        <CommunityXpRules />
      </aside>
    </div>
  </div>;
}
