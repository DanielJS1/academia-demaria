import { describe,expect,it } from "vitest";
import { institutionalTemplate,templateSummary } from "./institutional-template";
import { documentHtml,newDocument,textOf,validateDocument,withUnifiedContent } from "./document";
import { importHtml } from "./import-html";

describe("updated institutional article template",()=>{
 it("keeps the title in metadata, version 5 and the editable body through HTML cycles",()=>{
  const base=newDocument();base.metadata.title="Título único";
  const doc=institutionalTemplate(base,"11111111-1111-4111-8111-111111111111");
  expect(validateDocument(doc)).toEqual(doc);expect(doc.templateVersion).toBe(2);
  expect(textOf(doc.sections[0].content)).not.toContain(base.metadata.title);
  expect(textOf(doc.sections[0].content)).not.toContain("fonte Calibri");
  expect(textOf(doc.sections[0].content)).toContain("Implementado na versão/release: 5");
  expect(doc.sections[0].content.content?.[0].attrs?.textAlign).toBe("right");
  const dates=doc.sections[0].content.content?.slice(1,3);expect(dates?.map(n=>n.content?.[0].marks)).toEqual(Array(2).fill([{type:"textStyle",attrs:{fontSize:"12px"}}]));
  const list=doc.sections[0].content.content?.find(n=>n.type==="bulletList");expect(list?.content).toHaveLength(3);expect(list?.content?.every(n=>n.content?.[1].content?.length===2)).toBe(true);
  let round=doc;for(let i=0;i<5;i++)round=importHtml(documentHtml(round),round).document;
  expect(round).toEqual(doc);expect(withUnifiedContent(round,round.sections[0].content).metadata.summary).toBe(templateSummary);
  expect(base.templateVersion).toBe(1);expect(base.sections[0].content.content).toHaveLength(1);
 });
});
