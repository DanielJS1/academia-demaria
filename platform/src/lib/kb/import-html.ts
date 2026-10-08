import sanitize from "sanitize-html";
import { parseDocument } from "htmlparser2";
type DOMNode = ReturnType<typeof parseDocument>["children"][number];
type Element = Extract<DOMNode, { attribs: Record<string, string> }>;
import { textContent } from "domutils";
import { createHash } from "node:crypto";
import { documentHtml, unifiedDocument,withUnifiedContent,identifyBlocks, newDocument, templates, validateDocument, type KbDocument, type RichNode } from "./document";

export type ImportedMedia = { id: string; source: string; alt: string; width: number | null; height: number | null };
export const cleanHtml = (html: string) => sanitize(html, {
  allowedTags: ["article", "header", "section", "div", "span", "mark", "sub", "sup", "p", "h1", "h2", "h3", "h4", "strong", "b", "em", "i", "s", "u", "a", "ul", "ol", "li", "dl", "dt", "dd", "br", "hr", "img", "table", "thead", "tbody", "tr", "th", "td", "pre", "code", "blockquote"],
  allowedAttributes: { "*":["data-kb-block","style"],article: ["data-kb-template", "data-template-version"], section: ["data-kb-section", "data-section-id"], p:["data-kb-field"],dd:["data-kb-field"],ul:["data-kb-field"], img: ["src", "alt", "width", "height", "data-media-id","data-text-align"], a: ["href"], ol: ["start"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
  allowedStyles:{span:{color:[/^#[0-9a-f]{6}$/i],"font-size":[/^(12|14|16|18|20|24)px$/]},mark:{"background-color":[/^#[0-9a-f]{6}$/i]},p:{"text-align":[/^(left|center|right|justify)$/]},h2:{"text-align":[/^(left|center|right|justify)$/]},h3:{"text-align":[/^(left|center|right|justify)$/]},h4:{"text-align":[/^(left|center|right|justify)$/]}},
  allowedSchemes: ["https", "mailto"], allowedSchemesByTag: { img: ["https"] }, allowProtocolRelative: false,
});
const element = (n: DOMNode): n is Element => n.type === "tag";
const uuidFrom = (source: string) => { const h = createHash("sha256").update(source).digest("hex"); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`; };
export function importHtml(html: string, base?: KbDocument) {
  if (Buffer.byteLength(html) > 1000000) throw new Error("HTML muito grande.");
  const cleaned = cleanHtml(html), tree = parseDocument(cleaned);
  const report: string[] = ["Tipografia, cores, classes WordPress, spans e espaçamento normalizados pelos presets institucionais."];
  if (html !== cleaned) report.push("HTML sanitizado: atributos fora da allowlist removidos. Original preservado no relatório privado de importação.");
  const media: ImportedMedia[] = [];
  const inline = (nodes: DOMNode[], marks: NonNullable<RichNode["marks"]> = []): RichNode[] => nodes.flatMap(n => {
    if (n.type === "text") return n.data ? [{ type: "text", text: n.data.replace(/\s+/g, " "), ...(marks.length && n.data.trim() ? { marks } : {}) }] : [];
    if (!element(n)) return [];
    if (n.name === "br") return [{ type: "hardBreak" }];
    if (n.name === "img") return [image(n)];
    const style=Object.fromEntries((n.attribs.style||"").split(";").filter(Boolean).map(v=>v.split(":").map(s=>s.trim())));
    const type = ({ strong: "bold", b: "bold", em: "italic", i: "italic", s: "strike", u: "underline", code: "code",sub:"subscript",sup:"superscript" } as Record<string, string>)[n.name];
    const next = type ? [...marks.filter(m => m.type !== type), { type }] : n.name === "a" && n.attribs.href ? [...marks, { type: "link", attrs: { href: n.attribs.href } }] : n.name==="span"&&(style.color||style["font-size"])?[...marks,{type:"textStyle",attrs:{...(style.color?{color:style.color}:{}),...(style["font-size"]?{fontSize:style["font-size"]}:{})}}]:n.name==="mark"?[...marks,{type:"highlight",attrs:style["background-color"]?{color:style["background-color"]}:{}}]:marks;
    return inline(n.children, next as NonNullable<RichNode["marks"]>);
  });
  const image = (n: Element): RichNode => {
    const source = n.attribs.src || "";
    const stable = n.attribs["data-media-id"];
    const mediaId = stable || uuidFrom(source);
    if (!stable && !/^https:\/\/bc\.demaria\.com\.br\/wp-content\/uploads\//.test(source)) throw new Error("Imagem externa não autorizada. Envie-a pela biblioteca de mídia.");
    const width = Number(n.attribs.width) || null, height = Number(n.attribs.height) || null;
    if (!stable) media.push({ id: mediaId, source, alt: n.attribs.alt || "", width, height });
    if (!n.attribs.alt) report.push(`Descrição alternativa pendente: ${source || mediaId}`);
    return { type: "image", attrs: { mediaId, alt: n.attribs.alt || "", ...(n.attribs["data-text-align"]?{textAlign:n.attribs["data-text-align"]}:{}), ...(n.attribs["data-kb-block"]?{blockId:n.attribs["data-kb-block"]}:{}),...(width ? { width } : {}), ...(height ? { height } : {}) } };
  };
  // Images inside spans/strong are lifted to adjacent block nodes, retaining reading order.
  const paragraphs = (nodes: DOMNode[]): RichNode[] => {
    const out: RichNode[] = []; let current: RichNode[] = [];
    const flush = () => { if (current.some(n => n.type !== "text" || n.text?.trim())) out.push({ type: "paragraph", content: current }); current = []; };
    for (const n of inline(nodes)) { if (n.type === "image") { flush(); out.push(n); report.push("Imagem inline convertida em bloco na mesma posição de leitura."); } else current.push(n); } flush(); return out;
  };
  const blocks = (nodes: DOMNode[]): RichNode[] => {
    const out: RichNode[] = []; let loose: DOMNode[] = [];
    const flush = () => { out.push(...paragraphs(loose)); loose = []; };
    for (const n of nodes) {
      if (!element(n) || ["span", "strong", "b", "em", "i", "a", "br", "code", "u", "s", "mark","sub","sup"].includes(n.name)) { loose.push(n); continue; } flush();const start=out.length;
      if (n.name === "img") out.push(image(n));
      else if (n.name === "p") { const converted = paragraphs(n.children); out.push(...(converted.length ? converted : [{ type: "paragraph" }])); }
      else if (/^h[1-4]$/.test(n.name)) { const parts=paragraphs(n.children);out.push(...parts.map(p=>p.type==="paragraph"?{...p,type:"heading",attrs:{level:Math.max(2,Number(n.name[1]))}}:p)); }
      else if (n.name === "ul" || n.name === "ol") out.push({ type: n.name === "ul" ? "bulletList" : "orderedList", ...(n.name === "ol" ? { attrs: { start: Number(n.attribs.start) || 1 } } : {}), content: n.children.filter(element).filter(c => c.name === "li").map(c => { const content = blocks(c.children); return { type: "listItem", attrs: {blockId:c.attribs["data-kb-block"]||crypto.randomUUID()}, content: content[0]?.type === "paragraph" ? content : [{ type: "paragraph" }, ...content] }; }) });
      else if (n.name === "blockquote") out.push({ type: "blockquote", content: blocks(n.children) });
      else if (n.name === "pre") out.push({ type: "codeBlock", content: textContent(n) ? [{ type: "text", text: textContent(n) }] : [] });
      else if (n.name === "hr") out.push({ type: "horizontalRule" });
      else if (n.name === "table") { const rows = (nodes: DOMNode[]): Element[] => nodes.filter(element).flatMap(c => c.name === "tr" ? [c] : rows(c.children)); out.push({ type: "table", content: rows(n.children).map(row => ({ type: "tableRow", attrs:{blockId:row.attribs["data-kb-block"]||crypto.randomUUID()},content: row.children.filter(element).filter(c => c.name === "td" || c.name === "th").map(c => ({ type: c.name === "th" ? "tableHeader" : "tableCell", attrs: { blockId:c.attribs["data-kb-block"]||crypto.randomUUID(),colspan: Number(c.attribs.colspan) || 1, rowspan: Number(c.attribs.rowspan) || 1 }, content: blocks(c.children) })) })) }); }
      else out.push(...blocks(n.children));
      if(n.attribs["data-kb-block"]&&out[start])out[start]={...out[start],attrs:{...out[start].attrs,blockId:n.attribs["data-kb-block"]}};
      const alignment=n.attribs.style?.match(/text-align\s*:\s*(left|center|right|justify)/)?.[1];if(alignment&&["paragraph","heading"].includes(out[start]?.type))out[start]={...out[start],attrs:{...out[start].attrs,textAlign:alignment}};
    } flush(); return out;
  };
  const articles = tree.children.filter(element).filter(n => n.name === "article" && n.attribs["data-kb-template"]);
  let d: KbDocument;
  if (articles.length) {
    if (!base) throw new Error("Selecione um template para editar HTML institucional.");
    const root = articles[0]; if (articles.length !== 1 || root.attribs["data-kb-template"] !== base.templateId || root.attribs["data-template-version"] !== String(base.templateVersion)) throw new Error("Não altere a identidade/versão do template pelo HTML.");
    const sections = root.children.filter(element).filter(n => n.name === "section");
    if (sections.length !== base.sections.length || sections.some((s, i) => s.attribs["data-kb-section"] !== base.sections[i].key || s.attribs["data-section-id"] !== base.sections[i].id)) throw new Error("As regiões obrigatórias do template não podem ser removidas/reordenadas.");
    const header = root.children.filter(element).find(n => n.name === "header");
    const outside=root.children.filter(n=>!(element(n)&&["header","section"].includes(n.name))).filter(n=>textContent(n).trim()||element(n)&&n.name==="img");
    if(outside.length)report.push("Há conteúdo fora das regiões do template. Ele permanece no original privado para revisão; mova-o para uma seção antes de enviar.");
    d = { ...base, metadata: { ...base.metadata, title: header?.children.filter(element).filter(n => n.name === "h1").map(textContent).join("") || base.metadata.title, summary: header?.children.filter(element).filter(n => n.name === "p").map(textContent).join("") || base.metadata.summary }, sections: sections.map((s, i) => ({ ...base.sections[i], content: { type: "doc", content: blocks(s.children.filter(n => !(element(n) && n.name === "h2" && textContent(n) === ({ objetivo: "Objetivo", requisitos: "Pré-requisitos", passos: "Passo a passo", resultado: "Resultado e verificação", mudancas: "O que mudou", impacto: "Impacto", orientacao: "Orientação de uso" } as Record<string, string>)[base.sections[i].key]))) } })) };
  } else {
    d = base?.templateVersion===2?structuredClone(base):newDocument(base?.templateId); const nodes = tree.children.filter(n => n.type !== "text" || n.data.trim());
    const legacy=nodes.some(n=>/^Software a que se aplica este artigo:/i.test(textContent(n).trim()));
    if(!legacy){
      if(base)d.metadata={...base.metadata};
      (d.templateVersion===2?d.sections[0]:d.sections.find(s=>s.key==="passos"||s.key==="mudancas")!).content={type:"doc",content:blocks(nodes)};
      report.push("HTML sem cabeçalho legado inserido na região principal; preencha as demais regiões obrigatórias.");
    }else{
    // Legacy copied article bodies begin with title, publication/revision, software and release.
    const first = nodes.find(element); if (first) d.metadata.title = textContent(first).trim();
    const remaining: DOMNode[] = []; let objective: DOMNode | undefined, steps = false;
    for (const n of nodes.slice(1)) {
      const t = textContent(n).replace(/\u00a0/g, " ").trim();
      if (/^Data da publica/i.test(t)) { const lines = t.split(/Data da última revisão:/i); d.metadata.legacyPublished = lines[0].replace(/^Data da publicação:\s*/i, "").trim() || null; d.metadata.legacyRevision = lines[1]?.trim() || null; continue; }
      if (/^Data da última revisão:/i.test(t)) { d.metadata.legacyRevision = t.replace(/^Data da última revisão:\s*/i, "").trim() || null; continue; }
      if (/^Software a que se aplica este artigo:/i.test(t)) { d.metadata.product = t.replace(/^Software a que se aplica este artigo:\s*/i, ""); continue; }
      if (/^Implementado na versão\/release:/i.test(t)) { d.metadata.release = t.replace(/^Implementado na versão\/release:\s*/i, ""); continue; }
      if (/^Passo a passo$/i.test(t)) { steps = true; continue; }
      if (!steps && !objective && t) { objective = n; d.metadata.summary = t; continue; }
      remaining.push(n);
    }
    d.sections[0].content = { type: "doc", content: objective ? blocks([objective]) : [] };
    const mainKey = templates[d.templateId].sections.includes("passos" as never) ? "passos" : "mudancas";
    d.sections.find(s => s.key === mainKey)!.content = { type: "doc", content: blocks(remaining) };
    report.push("Cabeçalho e logo legado convertidos em metadados/cabeçalho institucional único; data/revisor históricos não são autoria nem auditoria.", "Conclusão/resultado exige revisão humana; nenhum texto de verificação foi inventado.");
    }
  }
  if(articles.length){
   const header=articles[0].children.filter(element).find(n=>n.name==="header");
   const fields=(nodes:DOMNode[]):Element[]=>nodes.filter(element).flatMap(n=>[n,...fields(n.children)]);
   for(const n of fields(header?.children||[])){
    const key=n.attribs["data-kb-field"];
    if(key==="tags")d.metadata.tags=n.children.filter(element).filter(c=>c.name==="li").map(textContent);
    else if(["summary","product","release","category","legacyPublished","legacyRevision"].includes(key)){
     const text=textContent(n);(d.metadata as Record<string,unknown>)[key]=key.startsWith("legacy")?text||null:text;
    }
   }
  }
  const normalize = (n: RichNode): RichNode => {
    if (!n.content) return n;
    const content: RichNode[] = [];
    for (const child of n.content.map(normalize)) {
      const last = content.at(-1);
      if (child.type === "text" && last?.type === "text" && JSON.stringify(child.marks || []) === JSON.stringify(last.marks || [])) last.text = (last.text! + child.text!).replace(/\s+/g, " ");
      else content.push(child);
    }
    return { ...n, content };
  };
  d.sections = d.sections.map(s => ({ ...s, content: identifyBlocks(normalize(s.content)) }));
  if(base?.templateVersion===2)d=withUnifiedContent(unifiedDocument(d),unifiedDocument(d).sections[0].content);
  d = validateDocument(d);
  return { document: d, html: documentHtml(d), media, report: [...new Set(report)], original: html };
}
