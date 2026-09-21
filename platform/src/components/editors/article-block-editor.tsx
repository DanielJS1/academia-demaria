"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ArrowDown, ArrowUp, Bold, ImagePlus, Italic, Link2, List, ListOrdered, MessageSquare, Plus, Trash2, Type } from "lucide-react";
import type { ArticleBlock } from "@/lib/model";
import { Button } from "../ui/button";

const MAX_IMAGE = 350 * 1024;
const MAX_BODY = 1.5 * 1024 * 1024;

async function compressImage(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Selecione uma imagem PNG, JPEG ou WebP.");
  if (file.size > 12 * 1024 * 1024) throw new Error("A imagem original deve ter no máximo 12 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Seu navegador não conseguiu converter a imagem.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL("image/webp", 0.82 - attempt * 0.06);
      if (result.length <= MAX_IMAGE) return result;
      scale *= 0.8;
    }
    throw new Error("A imagem continua muito grande. Recorte a área importante e tente novamente.");
  } finally { bitmap.close(); }
}

export function ArticleBlockEditor({ blocks, onChange, disabled }: { blocks: ArticleBlock[]; onChange: (blocks: ArticleBlock[]) => void; disabled: boolean }) {
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const fields = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const locked = disabled || imageBusy;
  const size = new TextEncoder().encode(JSON.stringify(blocks)).length;
  const updateBlock = (id: string, change: Partial<ArticleBlock>) => onChange(blocks.map(block => block.id === id ? { ...block, ...change } : block));
  const addBlock = (type: ArticleBlock["type"]) => {
    if (blocks.length >= 80) { setError("O artigo pode ter até 80 blocos."); return; }
    const id = crypto.randomUUID();
    onChange([...blocks, { id, type, ...(type === "steps" || type === "bullets" ? { items: [""] } : { text: "" }) }]);
    requestAnimationFrame(() => fields.current[id]?.focus());
  };
  const move = (index: number, delta: number) => {
    const reordered = [...blocks];
    [reordered[index], reordered[index + delta]] = [reordered[index + delta], reordered[index]];
    onChange(reordered);
  };
  const format = (block: ArticleBlock, before: string, after: string, placeholder: string) => {
    const field = fields.current[block.id];
    if (!field) return;
    const source = field.value;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = source.slice(start, end) || placeholder;
    const next = source.slice(0, start) + before + selected + after + source.slice(end);
    updateBlock(block.id, block.type === "steps" || block.type === "bullets" ? { items: next.split("\n") } : { text: next });
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start + before.length, start + before.length + selected.length); });
  };
  const insertImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (blocks.filter(block => block.type === "image").length >= 8 || blocks.length >= 80) { setError("Limite de 8 imagens ou 80 blocos por artigo atingido."); return; }
    setImageBusy(true);
    try {
      const src = await compressImage(file);
      const next = [...blocks, { id: crypto.randomUUID(), type: "image" as const, src, alt: "", caption: "" }];
      if (new TextEncoder().encode(JSON.stringify(next)).length > MAX_BODY) throw new Error("As imagens e o texto devem ocupar até 1,5 MB. Remova uma imagem ou use um recorte menor.");
      onChange(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível converter a imagem."); }
    finally { setImageBusy(false); }
  };

  return <div className="article-block-editor">
    <div className="article-editor-intro"><h2>Conteúdo do passo a passo</h2><p>Combine textos, listas e imagens. Selecione um trecho para aplicar a formatação e use a prévia para revisar.</p></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {blocks.map((block, index) => <section className="article-editor-block" key={block.id} aria-label={`Bloco ${index + 1}`}>
      <div className="article-block-heading"><strong>{index + 1}. {{ paragraph: "Texto", heading: "Título de seção", steps: "Passo a passo", bullets: "Lista", callout: "Dica ou atenção", image: "Imagem" }[block.type]}</strong><div className="article-block-actions">
        <Button type="button" variant="ghost" size="icon" disabled={locked || index === 0} aria-label={`Mover bloco ${index + 1} para cima`} onClick={() => move(index, -1)}><ArrowUp size={16} /></Button>
        <Button type="button" variant="ghost" size="icon" disabled={locked || index === blocks.length - 1} aria-label={`Mover bloco ${index + 1} para baixo`} onClick={() => move(index, 1)}><ArrowDown size={16} /></Button>
        <Button type="button" variant="ghost" size="icon" disabled={locked} aria-label={`Remover bloco ${index + 1}`} onClick={() => onChange(blocks.filter(item => item.id !== block.id))}><Trash2 size={16} /></Button>
      </div></div>
      {block.type === "image" ? <div className="article-image-fields">
        <img src={block.src} alt={block.alt || "Prévia da imagem inserida"} />
        <label className="field"><span>Descrição da imagem (obrigatória)</span><input value={block.alt || ""} maxLength={240} disabled={locked} onChange={event => updateBlock(block.id, { alt: event.target.value })} placeholder="Descreva a tela e o que a pessoa deve observar" /></label>
        <label className="field"><span>Legenda (opcional)</span><input value={block.caption || ""} maxLength={300} disabled={locked} onChange={event => updateBlock(block.id, { caption: event.target.value })} /></label>
        <small>Imagem comprimida e convertida: {Math.ceil((block.src?.length || 0) / 1024)} KB em Base64.</small>
      </div> : <>
        <div className="article-format-tools" role="group" aria-label={`Formatação do bloco ${index + 1}`}>
          <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={() => format(block, "**", "**", "texto em destaque")}><Bold size={15} /> Negrito</Button>
          <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={() => format(block, "_", "_", "texto em itálico")}><Italic size={15} /> Itálico</Button>
          <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={() => format(block, "[", "](https://exemplo.com)", "texto do link")}><Link2 size={15} /> Link</Button>
        </div>
        <label className="field"><span className="sr-only">Conteúdo do bloco {index + 1}</span><textarea ref={element => { fields.current[block.id] = element; }} value={block.items?.join("\n") ?? block.text ?? ""} disabled={locked} maxLength={12000} rows={block.type === "heading" ? 2 : 5} onChange={event => updateBlock(block.id, block.type === "steps" || block.type === "bullets" ? { items: event.target.value.split("\n") } : { text: event.target.value })} placeholder={block.type === "steps" || block.type === "bullets" ? "Escreva um item por linha" : "Escreva uma orientação clara e objetiva…"} /></label>
        {(block.type === "steps" || block.type === "bullets") && <small>Cada linha vira um item da lista.</small>}
      </>}
    </section>)}
    <div className="article-add-blocks" role="group" aria-label="Adicionar bloco ao artigo">
      <Button type="button" variant="secondary" size="sm" disabled={locked || blocks.length >= 80} onClick={() => addBlock("paragraph")}><Plus size={15} /> Texto</Button>
      <Button type="button" variant="secondary" size="sm" disabled={locked || blocks.length >= 80} onClick={() => addBlock("heading")}><Type size={15} /> Título</Button>
      <Button type="button" variant="secondary" size="sm" disabled={locked || blocks.length >= 80} onClick={() => addBlock("steps")}><ListOrdered size={15} /> Passos</Button>
      <Button type="button" variant="secondary" size="sm" disabled={locked || blocks.length >= 80} onClick={() => addBlock("bullets")}><List size={15} /> Lista</Button>
      <Button type="button" variant="secondary" size="sm" disabled={locked || blocks.length >= 80} onClick={() => addBlock("callout")}><MessageSquare size={15} /> Dica</Button>
      <Button type="button" variant="secondary" size="sm" disabled={locked || blocks.length >= 80} onClick={() => fileInput.current?.click()}><ImagePlus size={15} /> {imageBusy ? "Convertendo…" : "Imagem"}</Button>
      <input type="file" ref={fileInput} accept="image/png,image/jpeg,image/webp" hidden onChange={event => void insertImage(event)} />
    </div>
    <p className="article-size-note" role="status">{Math.ceil(size / 1024)} KB de 1.536 KB · até 8 imagens, com 350 KB cada. A conversão reduz a resolução para até 1.600 px e comprime antes de gerar o Base64.</p>
    <p className="article-size-note">Base64 aumenta o tamanho em relação ao arquivo comprimido. Os limites de tamanho protegem o carregamento e o banco de dados. Confira se os textos das capturas continuam legíveis.</p>
  </div>;
}
