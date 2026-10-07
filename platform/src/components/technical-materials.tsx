"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { FileText, Film, FolderOpen, Plus, Search, Trash2, X } from "lucide-react";
import { browserAuth } from "@/lib/supabase-browser";
import { normalize } from "@/lib/utils";
import type { TechnicalMaterial } from "@/lib/technical-material";
import { useAcademy } from "./academy-provider";
import { Button } from "./ui/button";

const bucket = "academy-technical-pdfs";
type Kind = "all" | "manual" | "video";

async function authorized(path: string, init: RequestInit = {}) {
  const client = browserAuth();
  const session = await client?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("Entre novamente para continuar.");
  const response = await fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` }, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a ação.");
  return data;
}

export function TechnicalMaterials({ search }: { search: string }) {
  const { me } = useAcademy();
  const canEdit = me.audience !== "client" && (me.role === "admin" || me.role === "manager");
  const [materials, setMaterials] = useState<TechnicalMaterial[]>([]);
  const [filter, setFilter] = useState<Kind>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<"manual" | "video">("manual");
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState<{ title: string; url: string; kind: "manual" | "video" } | null>(null);
  const closeViewer = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeViewer.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await authorized("/api/technical-materials");
      setMaterials(data.materials);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar os materiais."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => materials.filter(item =>
    (filter === "all" || item.kind === filter) && normalize(`${item.title} ${item.description} ${item.topic}`).includes(normalize(search))
  ), [materials, filter, search]);
  const topics = useMemo(() => [...new Set(visible.map(item => item.topic))].sort((a, b) => a.localeCompare(b, "pt-BR")), [visible]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError("");
    try {
      let pdfPath: string | null = null;
      if (kind === "manual") {
        if (!file || !file.name.toLowerCase().endsWith(".pdf") || file.size > 30 * 1024 * 1024) throw new Error("Selecione um PDF de até 30 MB.");
        if (await file.slice(0, 5).text() !== "%PDF-") throw new Error("O arquivo selecionado não é um PDF válido.");
        const signed = await authorized("/api/technical-materials/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size }) });
        const client = browserAuth();
        if (!client) throw new Error("Sua sessão expirou.");
        const uploaded = await client.storage.from(bucket).uploadToSignedUrl(signed.path, signed.token, file, { contentType: "application/pdf" });
        if (uploaded.error) throw new Error("Não foi possível enviar o PDF. Tente novamente.");
        pdfPath = signed.path;
      }
      await authorized("/api/technical-materials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        title: String(values.get("title") || ""), description: String(values.get("description") || ""), topic: String(values.get("topic") || ""),
        kind, pdfPath, videoUrl: kind === "video" ? String(values.get("videoUrl") || "") : null,
      }) });
      form.reset(); setFile(null); setShowForm(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar o material."); }
    finally { setBusy(false); }
  }

  async function openMaterial(item: TechnicalMaterial) {
    try {
      setError("");
      const data = await authorized(`/api/technical-materials?open=${encodeURIComponent(item.id)}`);
      if (!data.url) throw new Error("Material indisponível.");
      setOpen({ title: item.title, url: data.url, kind: item.kind });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível abrir o material."); }
  }

  async function remove(item: TechnicalMaterial) {
    if (!window.confirm(`Excluir “${item.title}”?`)) return;
    try {
      setBusy(true); setError("");
      await authorized(`/api/technical-materials?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      setMaterials(current => current.filter(value => value.id !== item.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível excluir o material."); }
    finally { setBusy(false); }
  }

  return <section className="technical-directory">
    <div className="technical-heading">
      <div><span className="eyebrow">ACERVO DE CONSULTA</span><h2>Materiais técnicos</h2><p>Manuais em PDF e vídeos de referência organizados por assunto.</p></div>
      {canEdit && <Button type="button" onClick={() => setShowForm(value => !value)}><Plus size={16} /> Adicionar material</Button>}
    </div>
    {showForm && canEdit && <form className="technical-form panel" onSubmit={save}>
      <div className="technical-form-title"><h3>Novo material técnico</h3><button type="button" aria-label="Fechar formulário" onClick={() => setShowForm(false)}><X size={18} /></button></div>
      <div className="technical-kind" role="group" aria-label="Tipo do material">
        <button type="button" className={kind === "manual" ? "active" : ""} aria-pressed={kind === "manual"} onClick={() => setKind("manual")}><FileText size={17} /> Manual em PDF</button>
        <button type="button" className={kind === "video" ? "active" : ""} aria-pressed={kind === "video"} onClick={() => setKind("video")}><Film size={17} /> Vídeo do Vimeo</button>
      </div>
      <div className="technical-fields">
        <label>Assunto ou produto<input name="topic" required minLength={2} maxLength={80} placeholder="Ex.: Selo Digital MA" /></label>
        <label>Título<input name="title" required minLength={3} maxLength={120} placeholder="Ex.: Manual do Selo Digital do Maranhão" /></label>
        <label className="technical-wide">Descrição<textarea name="description" required minLength={10} maxLength={600} rows={3} placeholder="Resuma o que a pessoa encontrará neste material." /></label>
        {kind === "manual" ? <label className="technical-wide">Arquivo PDF · até 30 MB<input type="file" accept=".pdf,application/pdf" required onChange={event => setFile(event.target.files?.[0] ?? null)} /></label> :
          <label className="technical-wide">Link do vídeo no Vimeo<input name="videoUrl" type="url" required placeholder="https://vimeo.com/123456789" /></label>}
      </div>
      <Button type="submit" disabled={busy}>{busy ? "Salvando material…" : "Publicar material"}</Button>
    </form>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="technical-filters" role="group" aria-label="Filtrar materiais">
      {([ ["all", "Todos"], ["manual", "Manuais"], ["video", "Vídeos"] ] as const).map(([value, label]) => <button key={value} type="button" className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
    </div>
    {loading ? <p role="status">Carregando materiais…</p> : topics.length ? topics.map(topic => <div className="technical-topic" key={topic}>
      <h3><FolderOpen size={18} /> {topic}</h3>
      <div className="technical-grid">{visible.filter(item => item.topic === topic).map(item => <article className="technical-card panel" key={item.id}>
        <span className="technical-card-icon">{item.kind === "manual" ? <FileText size={21} /> : <Film size={21} />}</span>
        <span className="technical-card-kind">{item.kind === "manual" ? "MANUAL PDF" : "VÍDEO TÉCNICO"}</span>
        <h4>{item.title}</h4><p>{item.description}</p>
        <div className="technical-card-actions"><Button type="button" variant="secondary" size="sm" onClick={() => void openMaterial(item)}>{item.kind === "manual" ? "Visualizar PDF" : "Assistir vídeo"}</Button>
          {canEdit && <button type="button" className="technical-delete" disabled={busy} aria-label={`Excluir ${item.title}`} title="Excluir material" onClick={() => void remove(item)}><Trash2 size={17} /></button>}</div>
      </article>)}</div>
    </div>) : <div className="technical-empty panel"><Search size={26} /><h3>{search ? "Nenhum material encontrado" : "O acervo técnico está pronto"}</h3><p>{search ? "Tente outro termo de busca." : "Os manuais e vídeos publicados aparecerão aqui, organizados por assunto."}</p></div>}
    {open && <div className="technical-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(null); }}>
      <div className="technical-viewer" role="dialog" aria-modal="true" aria-label={open.title}>
        <div className="technical-viewer-bar"><strong>{open.title}</strong><button ref={closeViewer} type="button" aria-label="Fechar visualização" onClick={() => setOpen(null)}><X size={20} /></button></div>
        <iframe src={open.url} title={open.title} allow={open.kind === "video" ? "autoplay; fullscreen; picture-in-picture" : undefined} allowFullScreen />
      </div>
    </div>}
  </section>;
}
