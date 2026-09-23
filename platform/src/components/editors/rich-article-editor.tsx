"use client";

import { useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Node, type JSONContent } from "@tiptap/core";
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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
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
    extensions: [StarterKit, Image.configure({ allowBase64: false }), TableKit, Attachment],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor: instance }) => onChange(instance.getJSON() as RichDocument, instance.getText({ blockSeparator: "\n" })),
    editorProps: { handlePaste: (_view, event) => {
      const file = Array.from(event.clipboardData?.files || []).find(item => item.type.startsWith("image/"));
      if (!file) return false;
      void upload(file, false);
      return true;
    } },
  });
  editorRef.current = editor;
  if (!editor) return <div role="status">Preparando editor…</div>;
  const action = (label: string, fn: () => void, active = false) => <Button type="button" variant={active ? "secondary" : "ghost"} size="sm" disabled={disabled || uploading} aria-label={label} aria-pressed={active} onClick={fn}>{label}</Button>;
  return <div className="rich-article-editor">
    <div className="rich-article-toolbar" role="toolbar" aria-label="Formatação do artigo">
      {action("Parágrafo", () => editor.chain().focus().setParagraph().run(), editor.isActive("paragraph"))}
      {([1, 2, 3] as const).map(level => <span key={level}>{action(`H${level}`, () => editor.chain().focus().toggleHeading({ level }).run(), editor.isActive("heading", { level }))}</span>)}
      {action("Negrito", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
      {action("Itálico", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
      {action("Sublinhado", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}
      {action("Riscado", () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}
      {action("Lista", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
      {action("Numerada", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
      {action("Dica / Atenção", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
      {action("Código", () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive("codeBlock"))}
      {action("Tabela", () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
      {editor.isActive("table") && <>{action("Linha +", () => editor.chain().focus().addRowAfter().run())}{action("Coluna +", () => editor.chain().focus().addColumnAfter().run())}{action("Excluir tabela", () => editor.chain().focus().deleteTable().run())}</>}
      {action("Link", () => { const href = window.prompt("URL HTTPS do link:", editor.getAttributes("link").href || "https://"); if (href && /^https:\/\//i.test(href)) editor.chain().focus().setLink({ href, target: "_blank" }).run(); })}
      {action("Imagem", () => imageInput.current?.click())}
      {action("Anexo", () => attachmentInput.current?.click())}
    </div>
    <EditorContent editor={editor} className="rich-article-canvas community-prose" aria-label="Corpo do artigo" />
    <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file, false); }} />
    <input ref={attachmentInput} type="file" accept=".sql,.xlsx,.pdf" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file, true); }} />
    {uploading && <p role="status">Enviando arquivo…</p>}{error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
