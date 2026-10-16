import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { documentHtml, mediaIds, validateDocument, textOf, isBlock, type RichNode } from "./document";
import { importHtml } from "./import-html";

const root=path.resolve(".kb-pilot/wordpress-100");
const enabled=process.env.KB_WORDPRESS_AUDIT==="1"&&existsSync(path.join(root,"report.json"));
const records: {wpId:string;articleId?:string}[]=enabled?JSON.parse(readFileSync(path.join(root,"report.json"),"utf8")):[];
describe.skipIf(!enabled)("Revisão estrutural do lote WordPress local",()=>{
  for(const r of records.filter(r=>r.articleId))it(`artigo ${r.wpId}: estrutura, mídia e alternância visual/HTML`,()=>{
    const {converted:d,result}=JSON.parse(readFileSync(path.join(root,`article-${r.wpId}.json`),"utf8"));
    expect(()=>validateDocument(d)).not.toThrow();
    const available=new Set(Object.values(result.media));
    for(const id of mediaIds(d))expect(available.has(id)).toBe(true);
    const ids=new Set<string>();const blocks=(n:RichNode)=>{if(isBlock(n)){const id=String(n.attrs?.blockId||"");expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);expect(ids.has(id)).toBe(false);ids.add(id);}if(n.type==="image")expect(String(n.attrs?.alt||"").trim()).not.toBe("");n.content?.forEach(blocks);};d.sections.forEach((s:{content:RichNode})=>blocks(s.content));
    const next=importHtml(documentHtml(d),d).document;
    const compact=(s:string)=>s.replace(/\s+/g,"");
    expect(compact(textOf(next.sections[0].content))).toBe(compact(textOf(d.sections[0].content)));
    expect(mediaIds(next)).toEqual(mediaIds(d));
    const layouts=(n:RichNode):unknown[]=>[...(["image","heading","tableCell","tableHeader","orderedList","bulletList","listItem"].includes(n.type)?[{type:n.type,...Object.fromEntries(Object.entries(n.attrs||{}).filter(([k])=>k!=="blockId"))}]:[]),...(n.content||[]).flatMap(layouts)];
    expect(layouts(next.sections[0].content)).toEqual(layouts(d.sections[0].content));
    expect(next.metadata.legacyPublished).toBe(d.metadata.legacyPublished);
    expect(next.metadata.legacyRevision).toBe(d.metadata.legacyRevision);
    if(d.metadata.product.trim())expect(()=>validateDocument(d,true)).not.toThrow();
  });
});
