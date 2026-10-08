"use client";

import { useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { Node, type JSONContent } from "@tiptap/core";
import { Bold, Check, CheckSquare, ChevronDown, FileUp, ImagePlus, Italic, Link2, List, ListOrdered, Plus, Quote, Redo2, Strikethrough, Table2, Underline, Undo2, X } from "lucide-react";
import { uploadMedia } from "@/lib/storage-service";
import { Button } from "../ui/button";

type RichDocument = { type: "doc"; content?: JSONContent[] };

const Attachment = Node.create({
  name: "attachment", group: "block", atom: true,
  addAttributes() { return { href: { default: "" }, name: { default: "Arquivo" } }; },
  parseHTML() { return [{ tag: "div[data-article-attachment]" }]; },
  renderHTML({ HTMLAttributes }) { return ["div", { "data-article-attachment": "", class: "community-attachment" }, ["a", { href: HTMLAttributes.href, target: "_blank", rel: "noopener noreferrer", download: "" }, HTMLAttributes.name]]; },
});

export function RichArticleEditor({ value, onChange, disabled, onUploadingChange }: { value: RichDocument; onChange: (value: RichDocument, plainText: string) => void; disabled: boolean; onUploadingChange: (busy: boolean) => void }) {
  const imageInput = useRef<HTMLInputElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [slash, setSlash] = useState<string | null>(null);
  const [slashPosition, setSlashPosition] = useState({ top: 70, left: 24 });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [revision, setRevision] = useState(0);
  const updateSlash = (instance: Editor) => {
    const { $from } = instance.state.selection;
    const before = $from.parent.textBetween(0, $from.parentOffset);
    const query = $from.parent.type.name === "paragraph" && /^\/[\wÀ-ÿ ]{0,30}$/.test(before) ? before.slice(1) : null;
    setSlash(query);
    if (query !== null && canvasRef.current) {
      const caret = instance.view.coordsAtPos($from.pos);
      const canvas = canvasRef.current.getBoundingClientRect();
      setSlashPosition({ top: caret.bottom - canvas.top + 8, left: Math.max(12, Math.min(caret.left - canvas.left, canvas.width - 312)) });
    }
  };
  const upload = async (file: File, attachment: boolean, instance?: Editor) => {
    const target = instance || editorRef.current;
    if (!target) return;
    setError(""); setUploading(true); onUploadingChange(true);
    try {
      const url = await uploadMedia(file, attachment ? "article-file" : "article-image");
      if (attachment) target.chain().focus().insertContent({ type: "attachment", attrs: { href: url, name: file.name.slice(0, 200) } }).run();
      else target.chain().focus().setImage({ src: url, alt: file.name.replace(/\.[^.]+$/, "") }).run();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha no upload."); }
    finally { setUploading(false); onUploadingChange(false); }
  };
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Image.configure({ allowBase64: false }), TableKit, TaskList, TaskItem.configure({ nested: true }), Placeholder.configure({ placeholder: "Escreva seu artigo ou digite / para inserir um bloco…" }), Attachment],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getJSON() as RichDocument, instance.getText({ blockSeparator: "\n" }));
      updateSlash(instance);
      setRevision(current => current + 1);
    },
    onSelectionUpdate: ({ editor: instance }) => { updateSlash(instance); setRevision(current => current + 1); },
    editorProps: { handlePaste: (_view, event) => {
      const file = Array.from(event.clipboardData?.files || []).find(item => item.type.startsWith("image/"));
      if (!file) return false;
      void upload(file, false);
      return true;
    } },
  });
  editorRef.current = editor;
  if (!editor) return <div role="status">Preparando editor…</div>;
  const action = (label: string, icon: React.ReactNode, fn: () => void, active = false, inactive = false) => <button type="button" className={`rich-tool ${active ? "is-active" : ""}`} disabled={disabled || uploading || inactive} aria-label={label} title={label} aria-pressed={active} onClick={fn}>{icon}</button>;
  const insert = (kind: string) => {
    if (slash !== null) {
      const { $from } = editor.state.selection;
      editor.chain().focus().deleteRange({ from: $from.pos - slash.length - 1, to: $from.pos }).run();
    }
    setSlash(null);
    if (kind === "heading1" || kind === "heading2" || kind === "heading3") editor.chain().focus().toggleHeading({ level: Number(kind.slice(-1)) as 1 | 2 | 3 }).run();
    else if (kind === "bulletList") editor.chain().focus().toggleBulletList().run();
    else if (kind === "orderedList") editor.chain().focus().toggleOrderedList().run();
    else if (kind === "taskList") editor.chain().focus().toggleTaskList().run();
    else if (kind === "blockquote") editor.chain().focus().toggleBlockquote().run();
    else if (kind === "codeBlock") editor.chain().focus().toggleCodeBlock().run();
    else if (kind === "horizontalRule") editor.chain().focus().setHorizontalRule().run();
    else if (kind === "table") editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    else if (kind === "image") imageInput.current?.click();
    else if (kind === "attachment") attachmentInput.current?.click();
    else editor.chain().focus().setParagraph().run();
  };
  const blocks = [
    { kind: "paragraph", label: "Texto", hint: "Parágrafo simples" },
    { kind: "heading1", label: "Título 1", hint: "Seção principal" },
    { kind: "heading2", label: "Título 2", hint: "Subseção" },
    { kind: "heading3", label: "Título 3", hint: "Detalhe" },
    { kind: "bulletList", label: "Lista com marcadores", hint: "Itens sem ordem" },
    { kind: "orderedList", label: "Lista numerada", hint: "Etapas em sequência" },
    { kind: "taskList", label: "Lista de tarefas", hint: "Checklist de verificação" },
    { kind: "blockquote", label: "Dica ou atenção", hint: "Informação em destaque" },
    { kind: "codeBlock", label: "Bloco de código", hint: "Comandos e exemplos" },
    { kind: "horizontalRule", label: "Divisória", hint: "Separar assuntos" },
    { kind: "table", label: "Tabela", hint: "Organizar dados" },
    { kind: "image", label: "Imagem", hint: "Captura de tela" },
    { kind: "attachment", label: "Anexo", hint: "Arquivo de apoio" },
  ];
  const matchingBlocks = slash === null ? [] : blocks.filter(block => `${block.label} ${block.hint}`.toLocaleLowerCase("pt-BR").includes(slash.toLocaleLowerCase("pt-BR")));

  const wordCount = editor.getText().trim().split(/\s+/).filter(Boolean).length;
  const currentStyle = editor.isActive("heading", { level: 1 }) ? "Título 1" : editor.isActive("heading", { level: 2 }) ? "Título 2" : editor.isActive("heading", { level: 3 }) ? "Título 3" : editor.isActive("taskList") ? "Tarefas" : editor.isActive("bulletList") ? "Lista" : editor.isActive("orderedList") ? "Numerada" : editor.isActive("blockquote") ? "Destaque" : editor.isActive("codeBlock") ? "Código" : "Texto";
  void revision;
  return <div className="rich-article-editor">
    <div className="rich-article-toolbar" role="toolbar" aria-label="Formatação do artigo">
      <div className="rich-tool-group">{action("Desfazer", <Undo2 size={17} />, () => editor.chain().focus().undo().run(), false, !editor.can().undo())}{action("Refazer", <Redo2 size={17} />, () => editor.chain().focus().redo().run(), false, !editor.can().redo())}</div>
      <div className="rich-tool-group"><label className="rich-style-select"><span className="sr-only">Tipo de bloco</span><select aria-label="Tipo de bloco" value={currentStyle} disabled={disabled || uploading} onChange={event => insert(({ "Texto": "paragraph", "Título 1": "heading1", "Título 2": "heading2", "Título 3": "heading3", "Lista": "bulletList", "Numerada": "orderedList", "Tarefas": "taskList", "Destaque": "blockquote", "Código": "codeBlock" } as Record<string, string>)[event.target.value])}>{["Texto", "Título 1", "Título 2", "Título 3", "Lista", "Numerada", "Tarefas", "Destaque", "Código"].map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label></div>
      <div className="rich-tool-group">{action("Negrito", <Bold size={17} />, () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}{action("Itálico", <Italic size={17} />, () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}{action("Sublinhado", <Underline size={17} />, () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}{action("Riscado", <Strikethrough size={17} />, () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}</div>
      <div className="rich-tool-group">{action("Lista com marcadores", <List size={18} />, () => insert("bulletList"), editor.isActive("bulletList"))}{action("Lista numerada", <ListOrdered size={18} />, () => insert("orderedList"), editor.isActive("orderedList"))}{action("Lista de tarefas", <CheckSquare size={18} />, () => insert("taskList"), editor.isActive("taskList"))}{action("Dica ou atenção", <Quote size={18} />, () => insert("blockquote"), editor.isActive("blockquote"))}</div>
      <div className="rich-tool-group">{action("Inserir link", <Link2 size={18} />, () => { setLinkUrl(editor.getAttributes("link").href || "https://"); setLinkOpen(true); }, editor.isActive("link"))}{action("Inserir imagem", <ImagePlus size={18} />, () => imageInput.current?.click())}{action("Inserir anexo", <FileUp size={18} />, () => attachmentInput.current?.click())}{action("Inserir tabela", <Table2 size={18} />, () => insert("table"))}</div>
      <details className="rich-insert-menu"><summary><Plus size={17} /> Inserir bloco <ChevronDown size={14} /></summary><div className="rich-block-menu">{blocks.map(block => <button key={block.kind} type="button" disabled={disabled || uploading} onClick={event => { insert(block.kind); event.currentTarget.closest("details")?.removeAttribute("open"); }}><strong>{block.label}</strong><small>{block.hint}</small></button>)}</div></details>
    </div>
    {editor.isActive("table") && <div className="rich-table-tools" role="toolbar" aria-label="Editar tabela">{action("Adicionar linha", <><Plus size={15} /> Linha</>, () => editor.chain().focus().addRowAfter().run())}{action("Adicionar coluna", <><Plus size={15} /> Coluna</>, () => editor.chain().focus().addColumnAfter().run())}{action("Remover linha", "− Linha", () => editor.chain().focus().deleteRow().run())}{action("Remover coluna", "− Coluna", () => editor.chain().focus().deleteColumn().run())}{action("Excluir tabela", <><X size={15} /> Tabela</>, () => editor.chain().focus().deleteTable().run())}</div>}
    {linkOpen && <form className="rich-link-form" onSubmit={event => { event.preventDefault(); if (/^https:\/\/\S+$/i.test(linkUrl)) { editor.chain().focus().setLink({ href: linkUrl, target: "_blank" }).run(); setLinkOpen(false); setError(""); } else setError("Use uma URL HTTPS válida."); }}><label>Endereço do link <input type="url" autoFocus value={linkUrl} onChange={event => setLinkUrl(event.target.value)} placeholder="https://exemplo.com" /></label><Button type="submit" size="sm"><Check size={16} /> Aplicar</Button>{editor.isActive("link") && <Button type="button" variant="ghost" size="sm" onClick={() => { editor.chain().focus().unsetLink().run(); setLinkOpen(false); }}>Remover</Button>}<Button type="button" variant="ghost" size="sm" onClick={() => setLinkOpen(false)} aria-label="Fechar link"><X size={16} /></Button></form>}
    <div className="rich-article-workspace"><div ref={canvasRef} className="rich-canvas-wrap" onKeyDown={event => { if (slash === null || (event.target as HTMLElement).closest(".rich-slash-menu")) return; if (event.key === "Escape") { event.preventDefault(); setSlash(null); } else if (event.key === "Enter" && matchingBlocks[0]) { event.preventDefault(); insert(matchingBlocks[0].kind); } else if (event.key === "ArrowDown") { event.preventDefault(); canvasRef.current?.querySelector<HTMLButtonElement>(".rich-slash-menu button")?.focus(); } }}><EditorContent editor={editor} className="rich-article-canvas community-prose" aria-label="Corpo do artigo" />{slash !== null && !disabled && <div className="rich-slash-menu" role="menu" aria-label="Inserir bloco" style={slashPosition}>{matchingBlocks.length ? matchingBlocks.map(block => <button key={block.kind} type="button" role="menuitem" onClick={() => insert(block.kind)}><strong>{block.label}</strong><small>{block.hint}</small></button>) : <p>Nenhum bloco encontrado.</p>}</div>}</div></div>
    <div className="rich-editor-footer"><span>Digite <kbd>/</kbd> para inserir blocos</span><span>{wordCount} {wordCount === 1 ? "palavra" : "palavras"}</span></div>
    <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file, false); }} />
    <input ref={attachmentInput} type="file" accept=".sql,.xlsx,.pdf" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file, true); }} />
    {uploading && <p role="status">Enviando arquivo…</p>}{error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
