import { identifyBlocks, newDocument, unifiedDocument, type KbDocument, type RichNode } from "./document";

export const templateSummary = "Descreva o objetivo deste artigo e quando esta orientação deve ser utilizada.";
export function institutionalTemplate(base: KbDocument = newDocument(), logoId?: string): KbDocument {
 const d=unifiedDocument(base);
 const text=(value:string,size:"12px"|"16px"|"20px"="16px",bold=false):RichNode=>{const marks:NonNullable<RichNode["marks"]>=[{type:"textStyle",attrs:{fontSize:size}}];if(bold)marks.push({type:"bold"});return {type:"text",text:value,marks};};
 const paragraph=(value:string,size:"12px"|"16px"|"20px"="16px",bold=false):RichNode=>({type:"paragraph",attrs:{textAlign:"justify"},content:[text(value,size,bold)]});
 const item=(value:string):RichNode=>({type:"listItem",content:[paragraph(value)]});
 const content:RichNode[]=[
  ...(logoId?[{type:"image",attrs:{mediaId:logoId,alt:"Logo DeMaria",width:108,height:98,textAlign:"right"}}]:[]),
  paragraph("Data da publicação: dd/mm/aaaa","12px"),
  paragraph("Data da última revisão: dd/mm/aaaa (Nome de quem revisou)","12px"),
  paragraph(`Software a que se aplica este artigo: ${d.metadata.product||"DOC-Windows"}`),
  {type:"paragraph",attrs:{textAlign:"justify"},content:[text("Implementado na versão/release: ","16px",true),text("5")]},
  paragraph(templateSummary),
  {type:"heading",attrs:{level:2,textAlign:"left"},content:[text("Passo a passo","20px",true)]},
  {type:"bulletList",content:[1,2,3].map(n=>({type:"listItem",content:[paragraph(`${n}º Passo – Descreva esta etapa`,"16px",true),{type:"bulletList",content:[item("Descreva a primeira orientação desta etapa."),item("Descreva a segunda orientação desta etapa.")]}]}))},
  paragraph("Resumo final: descreva o resultado esperado e as verificações finais."),
 ];
 return {...d,metadata:{...d.metadata,product:d.metadata.product||"DOC-Windows",release:"5",summary:templateSummary},sections:[{...d.sections[0],content:identifyBlocks({type:"doc",content})}]};
}
