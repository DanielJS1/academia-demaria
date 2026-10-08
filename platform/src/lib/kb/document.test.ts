import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { importHtml } from "./import-html";
import { documentHtml, identifyBlocks, mediaIds, newDocument, textOf, validateDocument } from "./document";
import { parseDocument } from "htmlparser2";
import { textContent } from "domutils";
const manifestPath=resolve("../docs/references/bc-artigos-manifesto.json");
const referencesAvailable=existsSync(manifestPath)&&JSON.parse(readFileSync(manifestPath,"utf8")).articles.every((e:{html_path:string;pdf_path:string})=>existsSync(e.html_path)&&existsSync(e.pdf_path));

describe("Contrato institucional e importação", () => {
  it("preserva alinhamento, cores, tamanho, destaque e sobrescrito em cinco ciclos",()=>{
    const doc=newDocument();doc.sections[0].content=identifyBlocks({type:"doc",content:[{type:"paragraph",attrs:{textAlign:"justify"},content:[{type:"text",text:"Orientação com formatação profissional.",marks:[{type:"bold"},{type:"underline"},{type:"textStyle",attrs:{color:"#087b80",fontSize:"18px"}},{type:"highlight",attrs:{color:"#fef08a"}},{type:"superscript"}]}]}]});
    let next=doc;for(let i=0;i<5;i++)next=importHtml(documentHtml(next),next).document;expect(next).toEqual(doc);
    const forged=structuredClone(doc);forged.sections[0].content.content![0].attrs!.textAlign="expression(alert(1))";expect(()=>validateDocument(forged)).toThrow();
    forged.sections[0].content.content![0].attrs!.textAlign="left";forged.sections[0].content.content![0].content![0].marks=[{type:"textStyle",attrs:{color:"url(https://evil.invalid)"}}];expect(()=>validateDocument(forged)).toThrow();
    const base=newDocument();const cleaned=importHtml(documentHtml(base).replace('<h2>Objetivo</h2>','<h2>Objetivo</h2><p style="text-align:right;position:fixed"><span style="color:#1d4ed8;font-size:18px;background:url(javascript:x)">Texto seguro</span></p>'),base);
    expect(cleaned.html).not.toMatch(/position|javascript|url\(/);expect(cleaned.html).toContain('text-align:right');expect(cleaned.html).toContain('color:#1d4ed8');
  });
  it("rejeita template/seções forjados e rascunho incompleto", () => {
    const d = newDocument(); expect(() => validateDocument(d)).not.toThrow(); expect(() => validateDocument(d, true)).toThrow();
    expect(() => validateDocument({ ...d, sections: [] })).toThrow(); expect(() => validateDocument({ ...d, templateVersion: 2 })).toThrow();
    expect(() => importHtml(documentHtml(d).replace('data-kb-section="objetivo"', 'data-kb-section="fraude"'), d)).toThrow();
  });
  it("sanitiza scripts, eventos, CSS, protocolos executáveis e base64", () => {
    const d = newDocument(); const html = documentHtml(d).replace('<h2>Objetivo</h2>', '<h2>Objetivo</h2><script>alert(1)</script><p style="background:url(javascript:x)" onclick="x()"><a href="javascript:x()">Link</a><img src="data:image/png;base64,xxx" data-media-id="2c983948-149f-4f55-8b68-f7eb530a1f48" alt="Imagem"></p>');
    const result = importHtml(html, d); expect(result.html).not.toMatch(/script|onclick|javascript:|base64|style=/); expect(result.html).toContain("Link");
  });
  it("preserva tabelas mescladas, código, links e imagens aninhadas", () => {
    const d = newDocument(); const rich = '<table><tr><th colspan="2">Cabeçalho</th></tr><tr><td rowspan="2"><p>Texto</p></td><td><p>Dado</p></td></tr></table><pre>if (a &lt; b) return;</pre><p><a href="https://demaria.com.br">Site</a></p>';
    const x = importHtml(documentHtml(d).replace('<h2>Objetivo</h2>', '<h2>Objetivo</h2>' + rich), d);
    expect(x.html).toContain('colspan="2"'); expect(x.html).toContain('rowspan="2"'); expect(x.html).toContain('https://demaria.com.br'); expect(x.html).toContain("if (a &lt; b) return;");
    expect(importHtml(x.html, x.document).document).toEqual(x.document);
  });
  it.skipIf(!referencesAvailable)("converte os cinco originais, confere hashes e cinco ciclos sobre JSON normalizado", () => {
    const manifest = JSON.parse(readFileSync(resolve("../docs/references/bc-artigos-manifesto.json"), "utf8"));
    const folder = resolve(".kb-pilot/conversion"); mkdirSync(folder, { recursive: true });
    for (const entry of manifest.articles) {
      expect(existsSync(entry.html_path), `Original indisponível: ${entry.html_path}`).toBe(true);
      const bytes = readFileSync(entry.html_path); expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.html_analysis.sha256);
      expect(createHash("sha256").update(readFileSync(entry.pdf_path)).digest("hex")).toBe(entry.pdf_sha256);
      const converted = importHtml(bytes.toString("utf8")); const original = converted.document;
      let document = original;
      for (let i = 0; i < 5; i++) document = importHtml(documentHtml(document), document).document;
      expect(document).toEqual(original);
      const images = (n: import("./document").RichNode): import("./document").RichNode[] => [...(n.type === "image" ? [n] : []), ...(n.content || []).flatMap(images)];
      const occurrences = document.sections.flatMap(s => images(s.content));
      expect(occurrences.length).toBe(entry.html_analysis.images.length - 1);
      const sourceText = bytes.toString("utf8");
      // Text evidence includes structured metadata; formatting/blank spaces normalized explicitly.
      expect(document.metadata.product).toBe("DOC-Windows");
      expect(document.sections.map(s => textOf(s.content)).join(" ").length).toBeGreaterThan(300);
      const flat=(s:string)=>s.replace(/\s+/g," ").trim();
      const originalBody=parseDocument(sourceText).children.filter(n=>n.type==="tag");
      const mainIndex=originalBody.findIndex(n=>flat(textContent(n)).toLowerCase()==="passo a passo");
      const expectedText=flat(originalBody.slice(mainIndex+1).map(textContent).join(" "));
      expect(flat(textOf(document.sections.find(s=>s.key==="passos")!.content))).toBe(expectedText);
      if (sourceText.includes('width="645"')) expect(occurrences.some(n => n.attrs?.width === 645 && n.attrs?.height === 42)).toBe(true);
      if (entry.html_path.endsWith("PR.txt")) expect(mediaIds(document).length).toBe(5);
      const file = resolve(folder, `${entry.html_analysis.sha256}.json`);
      writeFileSync(file, JSON.stringify({ document, original: converted.original, media: converted.media, report: converted.report, cycles: 5 }, null, 2));
      expect(JSON.parse(readFileSync(file, "utf8")).document).toEqual(original);
    }
  });
});
