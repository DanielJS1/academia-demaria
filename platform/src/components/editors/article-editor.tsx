"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Eye, FileText, Pencil, Save } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { EmptyState, PageHeading } from "../shared";
import { articleSchema, type Article } from "@/lib/model";
import { RichArticleEditor } from "./rich-article-editor";
import { ArticleContent, CommunityXpRules } from "../community/article-content";
import { fetchArticle } from "../community/article-client";
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

export function ArticleEditor({ id }: { id: string }) {
  const { state, me, ready } = useAcademy();
  const [loaded, setLoaded] = useState<Article | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (id === "novo" || !ready) return;
    const controller = new AbortController();
    fetchArticle(id, true, controller.signal).then(data => { setLoaded(data.article); setError(""); }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível abrir o artigo."); });
    return () => controller.abort();
  }, [id, ready, attempt]);
  if (!ready) return <div className="empty-state" role="status">Preparando o editor…</div>;
  if (me.audience === "client") return <EmptyState title="Acesso restrito" description="A biblioteca colaborativa é exclusiva para colaboradores." />;
  if (error) return <EmptyState title="Não foi possível abrir o artigo" description={error}><Button onClick={() => { setError(""); setAttempt(value => value + 1); }}>Tentar novamente</Button></EmptyState>;
  if (id !== "novo" && (!loaded || loaded.id !== id)) return <div className="empty-state" role="status">Carregando conteúdo do artigo…</div>;
  if (loaded && loaded.authorId !== me.id && me.role !== "admin") return <EmptyState title="Edição restrita ao autor" description="Gestores podem solicitar uma atualização pela página do artigo." />;
  return <ArticleEditorForm key={id} initial={id === "novo" ? undefined : loaded!} firstProduct={state.products[0] || "DOC-Academy"} />;
}

function ArticleEditorForm({ initial, firstProduct }: { initial?: Article; firstProduct: string }) {
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
    const data = { ...article, blocks: undefined, title: article.title.trim(), content, summary: content.slice(0, 250), status: publish ? "published" as const : "draft" as const };
    if (!articleSchema.safeParse(data).success) { setError("Revise os campos: título de 3 a 120 caracteres, categoria e conteúdo dentro dos limites indicados."); return; }
    if (publish && content.length < 80) { setError("Explique o procedimento em pelo menos 80 caracteres antes de publicar."); return; }
    if (new TextEncoder().encode(JSON.stringify(article.richContent)).length > 1.5 * 1024 * 1024) { setError("O conteúdo excede 1,5 MB."); return; }
    setSaving(true);
    try {
      const success = await mutate({ type: "community-save", data, publish, expectedVersion });
      if (!success) { setError("Não foi possível salvar. Seu texto continua no editor; confira a mensagem do servidor e tente novamente."); return; }
      setDirty(false);
      if (publish) { notify("Artigo publicado na biblioteca."); router.push(`/conhecimento/${article.id}`); return; }
      const latest = await fetchArticle(article.id, true);
      setArticle(latest.article);
      setExpectedVersion(latest.article.revision);
      setSaved("Rascunho salvo no servidor. A publicação atual foi preservada.");
      if (!initial) router.replace(`/conhecimento/${article.id}/editar`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível confirmar o salvamento. Reabra o rascunho antes de tentar novamente."); }
    finally { setSaving(false); }
  };

  return <div className="page-enter community-editor">
    <Link href="/conhecimento?aba=biblioteca" className="back-link" onClick={event => { if (dirty && !window.confirm("Sair sem salvar as alterações deste artigo?")) event.preventDefault(); }}><ArrowLeft size={15} /> Voltar à biblioteca</Link>
    <PageHeading title={initial ? "Aprimore seu conhecimento." : "Compartilhe o que você sabe."} description="Registre um procedimento que ajude alguém da equipe a resolver um problema." />
    {article.updateRequest && <div className="notice-bar community-update-request"><strong>Atualização solicitada</strong><p>{article.updateRequest.message}</p><small>A solicitação será concluída quando você publicar a revisão.</small></div>}
    <div className="editor-grid">
      <section className="panel form-panel">
        {error && <div className="form-error" role="alert">{error}</div>}
        {saved && <p className="community-save-status" role="status"><Check size={16} /> {saved}</p>}
        <label className="field"><span>Título do artigo</span><input value={article.title} maxLength={120} disabled={locked} onChange={event => edit({ title: event.target.value })} placeholder="Ex.: Como corrigir uma configuração de impressão" /></label>
        <div className="form-grid"><label className="field"><span>Produto</span><select value={article.product} disabled={locked} onChange={event => edit({ product: event.target.value })}>{Array.from(new Set([article.product, ...state.products])).map(item => <option key={item}>{item}</option>)}</select></label><label className="field"><span>Categoria</span><input value={article.category} maxLength={80} disabled={locked} onChange={event => edit({ category: event.target.value })} /></label></div>
        <label className="field"><span>Tags de busca</span><input value={tagsInput} disabled={locked} onChange={event => { setTagsInput(event.target.value); edit({ tags: event.target.value.split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 12) }); }} placeholder="Ex.: SQL, configuração, impressão" /></label>
        <div className="community-editor-mode"><span>Por {article.author || me.name}</span><Button type="button" variant="secondary" size="sm" onClick={() => setPreview(value => !value)}>{preview ? <Pencil size={15} /> : <Eye size={15} />} {preview ? "Continuar editando" : "Ver prévia"}</Button></div>
        {!legacyReady ? <div role="status">Preparando imagens antigas no storage…</div> : preview ? <section aria-label="Prévia do artigo"><h2>{article.title || "Título do artigo"}</h2><ArticleContent article={article} /></section> : <RichArticleEditor value={article.richContent || { type: "doc" }} disabled={locked} onUploadingChange={setUploading} onChange={(richContent, content) => edit({ richContent, content })} />}
      </section>
      <aside className="panel form-panel editor-aside community-editor-aside">
        <FileText size={28} color="var(--primary)" /><h2>Conhecimento que ajuda</h2><p>Explique o objetivo, os pré-requisitos, cada etapa e como conferir o resultado. Remova dados de clientes das capturas.</p>
        <Button variant="secondary" disabled={locked || !legacyReady} onClick={() => void save(false)}><Save size={16} /> {saving ? "Salvando…" : "Salvar rascunho"}</Button>
        <Button disabled={locked || !legacyReady} onClick={() => void save(true)}><Check size={16} /> {initial?.status === "published" ? "Publicar revisão" : "Publicar artigo"}</Button>
        <p className="article-size-note">{dirty ? "Você tem alterações ainda não salvas." : "O artigo só muda para a equipe ao publicar."}</p>
        <CommunityXpRules />
      </aside>
    </div>
  </div>;
}
