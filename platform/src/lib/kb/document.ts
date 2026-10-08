import { z } from "zod";

export const templates = {
  procedimento: { name: "Procedimento", sections: ["objetivo", "requisitos", "passos", "resultado"], required: ["objetivo", "passos", "resultado"] },
  novidade: { name: "Novidade", sections: ["objetivo", "mudancas", "impacto", "orientacao"], required: ["objetivo", "mudancas", "impacto", "orientacao"] },
  atualizacao: { name: "Atualização", sections: ["objetivo", "mudancas", "impacto", "orientacao"], required: ["objetivo", "mudancas", "impacto", "orientacao"] },
} as const;
export const sectionLabels: Record<string, string> = { objetivo: "Objetivo", requisitos: "Pré-requisitos", passos: "Passo a passo", resultado: "Resultado e verificação", mudancas: "O que mudou", impacto: "Impacto", orientacao: "Orientação de uso" };
const id = z.string().uuid();
const link = z.string().max(2000).refine(v => /^https:\/\/[^\s]+$/i.test(v) || /^mailto:[^\s]+$/i.test(v), "Use HTTPS ou e-mail.");
const markSchema = z.union([
  z.object({ type: z.enum(["bold", "italic", "strike", "underline", "code", "subscript", "superscript"]) }).strict(),
  z.object({type:z.literal("textStyle"),attrs:z.object({color:z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),fontSize:z.enum(["14px","16px","18px","20px","24px"]).nullable().optional()}).strict()}).strict(),
  z.object({type:z.literal("highlight"),attrs:z.object({color:z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional()}).strict()}).strict(),
  z.object({ type: z.literal("link"), attrs: z.object({ href: link, target: z.literal("_blank").nullable().optional(), rel: z.string().optional(), class: z.null().optional() }).strict() }).strict(),
]);
export type RichNode = { type: string; text?: string; attrs?: Record<string, string | number | null>; marks?: z.infer<typeof markSchema>[]; content?: RichNode[] };
export const isBlock=(n:RichNode)=>!["doc","text","hardBreak"].includes(n.type);
export function identifyBlocks(n:RichNode):RichNode{
 const attrs=Object.fromEntries(Object.entries(n.attrs||{}).filter(([,v])=>v!=null));
 const marks=n.marks?.map(m=>m.type==="link"?{type:m.type,attrs:{href:m.attrs.href}}:m.type==="textStyle"||m.type==="highlight"?{...m,attrs:Object.fromEntries(Object.entries(m.attrs).filter(([,v])=>v!=null))}:m).filter(m=>m.type!=="textStyle"||Object.keys(m.attrs).length).sort((a,b)=>a.type.localeCompare(b.type)) as RichNode["marks"];
 return {...n,...(isBlock(n)?{attrs:{...attrs,blockId:attrs.blockId||crypto.randomUUID()}}:{}),...(marks?{marks}:{}),...(n.content?{content:n.content.map(identifyBlocks)}:{})};
}
const allowed = ["doc", "text", "paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "codeBlock", "hardBreak", "horizontalRule", "image", "table", "tableRow", "tableCell", "tableHeader"];
export const richSchema: z.ZodType<RichNode> = z.lazy(() => z.object({
  type: z.enum(allowed as [string, ...string[]]), text: z.string().max(100000).optional(),
  attrs: z.record(z.string(), z.union([z.string().max(2000), z.number(), z.null()])).optional(),
  marks: z.array(markSchema).max(8).optional(), content: z.array(richSchema).max(2000).optional(),
}).strict()).superRefine((n, ctx) => {
  const keys: Record<string, string[]> = { paragraph:["textAlign"], heading: ["level","textAlign"], orderedList: ["start", "type"], image: ["mediaId", "alt", "width", "height"], codeBlock: ["language"], tableCell: ["colspan", "rowspan", "colwidth"], tableHeader: ["colspan", "rowspan", "colwidth"] };
  if (Object.keys(n.attrs || {}).some(k => !(keys[n.type] || []).includes(k) && !(k==="blockId"&&isBlock(n)))) ctx.addIssue({ code: "custom", message: "Atributo fora do template." });
  if(n.attrs?.blockId!=null&&!id.safeParse(n.attrs.blockId).success)ctx.addIssue({code:"custom",message:"ID de bloco inválido."});
  if(n.attrs?.textAlign!=null&&!["left","center","right","justify"].includes(String(n.attrs.textAlign)))ctx.addIssue({code:"custom",message:"Alinhamento inválido."});
  if (n.type === "image" && (!id.safeParse(n.attrs?.mediaId).success || typeof n.attrs?.alt !== "string")) ctx.addIssue({ code: "custom", message: "Imagem exige ID estável e descrição." });
  if (n.type === "heading" && ![2, 3, 4].includes(Number(n.attrs?.level))) ctx.addIssue({ code: "custom", message: "Nível de título inválido." });
  for (const k of ["width", "height", "colspan", "rowspan"]) if (n.attrs?.[k] != null && (!Number.isInteger(n.attrs[k]) || Number(n.attrs[k]) < 1 || Number(n.attrs[k]) > 10000)) ctx.addIssue({ code: "custom", message: "Dimensão inválida." });
  if (n.type === "text" ? !n.text || !!n.content : n.text !== undefined) ctx.addIssue({ code: "custom", message: "Nó de texto inválido." });
  const children: Record<string, string[]> = { doc: ["paragraph", "heading", "bulletList", "orderedList", "blockquote", "codeBlock", "image", "table", "horizontalRule"], paragraph: ["text", "hardBreak"], heading: ["text", "hardBreak"], codeBlock: ["text"], bulletList: ["listItem"], orderedList: ["listItem"], listItem: ["paragraph", "heading", "bulletList", "orderedList", "blockquote", "codeBlock", "image", "table"], blockquote: ["paragraph", "heading", "bulletList", "orderedList", "image"], table: ["tableRow"], tableRow: ["tableCell", "tableHeader"], tableCell: ["paragraph", "bulletList", "orderedList", "image"], tableHeader: ["paragraph", "bulletList", "orderedList", "image"] };
  if (n.content?.some(c => !(children[n.type] || []).includes(c.type))) ctx.addIssue({ code: "custom", message: "Estrutura rica inválida." });
});
export const documentSchema = z.object({
  schemaVersion: z.literal(1), templateId: z.enum(["procedimento", "novidade", "atualizacao"]), templateVersion: z.literal(1),
  metadata: z.object({ title: z.string().max(240), summary: z.string().max(2000), product: z.string().max(120), release: z.string().max(120), category: z.string().max(120), tags: z.array(z.string().max(60)).max(20), legacyPublished: z.string().max(120).nullable(), legacyRevision: z.string().max(240).nullable() }).strict(),
  sections: z.array(z.object({ id, key: z.string(), content: richSchema }).strict()).max(8),
}).strict().superRefine((d, ctx) => {
  const expected = templates[d.templateId].sections;
  if (d.sections.length !== expected.length || d.sections.some((s, i) => s.key !== expected[i] || s.content.type !== "doc") || new Set(d.sections.map(s => s.id)).size !== d.sections.length) ctx.addIssue({ code: "custom", message: "As regiões obrigatórias do template devem ser preservadas." });
});
export type KbDocument = z.infer<typeof documentSchema>;
export function newDocument(templateId: KbDocument["templateId"] = "procedimento"): KbDocument {
  return { schemaVersion: 1, templateId, templateVersion: 1, metadata: { title: "", summary: "", product: "", release: "", category: "", tags: [], legacyPublished: null, legacyRevision: null }, sections: templates[templateId].sections.map(key => ({ id: crypto.randomUUID(), key, content: identifyBlocks({ type: "doc", content: [{ type: "paragraph" }] }) })) };
}
export function textOf(n: RichNode): string { return n.text || (n.content || []).map(textOf).join(n.type === "paragraph" || n.type === "heading" ? "" : " "); }
export function mediaIds(d: KbDocument): string[] { const ids = new Set<string>(); const walk = (n: RichNode) => { if (n.type === "image") ids.add(String(n.attrs?.mediaId)); n.content?.forEach(walk); }; d.sections.forEach(s => walk(s.content)); return [...ids]; }
export function validateDocument(input: unknown, complete = false): KbDocument {
  // Limit total size and depth before recursive Zod parsing (untrusted API JSON).
  const json = JSON.stringify(input); if (json.length > 1000000) throw new Error("Documento muito grande.");
  let depth = 0, max = 0; for (const c of json.replace(/"(?:[^"\\]|\\.)*"/g, '""')) { if (c === "{" || c === "[") max = Math.max(max, ++depth); if (c === "}" || c === "]") depth--; } if (max > 40) throw new Error("Documento muito profundo.");
  const d = documentSchema.parse(input);
  if (complete) {
    if (!d.metadata.title.trim() || !d.metadata.product.trim() || !d.metadata.summary.trim() || (d.templateId !== "procedimento" && !d.metadata.release.trim())) throw new Error("Preencha título, resumo, produto e versão aplicável.");
    for (const key of templates[d.templateId].required) { const text = textOf(d.sections.find(s => s.key === key)!.content).trim(); if (text.length < 8 || /^(escrito\s*\d|placeholder)/i.test(text)) throw new Error(`Preencha ${sectionLabels[key]}.`); }
    const ids=new Set<string>();const walk = (n: RichNode) => { if(isBlock(n)){const key=String(n.attrs?.blockId||"");if(!id.safeParse(key).success||ids.has(key))throw new Error("Blocos devem ter IDs estáveis e únicos.");ids.add(key);} if (n.type === "image" && !String(n.attrs?.alt || "").trim()) throw new Error("Descreva todas as capturas antes de enviar."); n.content?.forEach(walk); }; d.sections.forEach(s => walk(s.content));
  }
  return d;
}
export const escapeHtml = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function richHtml(n: RichNode): string {
  const e = escapeHtml;
  if (n.type === "text") return (n.marks || []).reduceRight((s, m) => {
    if(m.type==="link")return `<a href="${e(m.attrs.href)}" rel="noopener noreferrer">${s}</a>`;
    if(m.type==="textStyle")return `<span style="${m.attrs.color?`color:${e(m.attrs.color)};`:""}${m.attrs.fontSize?`font-size:${e(m.attrs.fontSize)};`:""}">${s}</span>`;
    if(m.type==="highlight")return `<mark${m.attrs.color?` style="background-color:${e(m.attrs.color)}"`:""}>${s}</mark>`;
    const tag=({bold:"strong",italic:"em",strike:"s",underline:"u",code:"code",subscript:"sub",superscript:"sup"} as Record<string,string>)[m.type];return `<${tag}>${s}</${tag}>`;
  }, e(n.text));
  const blockId=n.attrs?.blockId?` data-kb-block="${e(n.attrs.blockId)}"`:"";
  if (n.type === "image") return `<img${blockId} data-media-id="${e(n.attrs?.mediaId)}" src="/api/kb/media/${e(n.attrs?.mediaId)}" alt="${e(n.attrs?.alt)}"${n.attrs?.width ? ` width="${e(n.attrs.width)}"` : ""}${n.attrs?.height ? ` height="${e(n.attrs.height)}"` : ""} loading="lazy">`;
  if (n.type === "hardBreak") return "<br>"; if (n.type === "horizontalRule") return `<hr${blockId}>`;
  const content = (n.content || []).map(richHtml).join(""); if (n.type === "doc") return content;
  const tag = ({ paragraph: "p", heading: `h${n.attrs?.level}`, bulletList: "ul", orderedList: "ol", listItem: "li", blockquote: "blockquote", codeBlock: "pre", table: "table", tableRow: "tr", tableCell: "td", tableHeader: "th" } as Record<string, string>)[n.type];
  const attrs = n.type === "orderedList" ? ` start="${e(n.attrs?.start || 1)}"` : ["tableCell", "tableHeader"].includes(n.type) ? ` colspan="${e(n.attrs?.colspan || 1)}" rowspan="${e(n.attrs?.rowspan || 1)}"` : "";
  const alignment=n.attrs?.textAlign?` style="text-align:${e(n.attrs.textAlign)}"`:"";
  return `<${tag}${blockId}${attrs}${alignment}>${content}</${tag}>`;
}
export function documentHtml(input: KbDocument): string {
 const d=validateDocument(input),e=escapeHtml;
 const fields={product:"Produto",release:"Versão/release",category:"Categoria",legacyPublished:"Publicação histórica",legacyRevision:"Revisão histórica"} as const;
 return `<article data-kb-template="${d.templateId}" data-template-version="1"><header><h1>${e(d.metadata.title)}</h1><p data-kb-field="summary">${e(d.metadata.summary)}</p><dl>${Object.entries(fields).map(([key,label])=>`<dt>${label}</dt><dd data-kb-field="${key}">${e(d.metadata[key as keyof typeof d.metadata])}</dd>`).join("")}</dl><ul data-kb-field="tags">${d.metadata.tags.map(t=>`<li>${e(t)}</li>`).join("")}</ul></header>${d.sections.map(s=>`<section data-kb-section="${s.key}" data-section-id="${s.id}"><h2>${sectionLabels[s.key]}</h2>${richHtml(s.content)}</section>`).join("")}</article>`;
}
