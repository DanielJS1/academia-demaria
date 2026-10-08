"use client";
import {useState} from "react";
import {useEditorState} from "@tiptap/react";
import type {Editor} from "@tiptap/core";
import {AlignLeft,AlignCenter,AlignRight,AlignJustify,Bold,Italic,Underline,Strikethrough,List,ListOrdered,IndentIncrease,IndentDecrease,Link2,Unlink,ImagePlus,Table2,Quote,Code2,Minus,Undo2,Redo2,RemoveFormatting,Highlighter,Palette,Subscript,Superscript,Check,X,type LucideIcon} from "lucide-react";

const colors=[{name:"Grafite",value:"#1c353b"},{name:"DeMaria",value:"#087b80"},{name:"Azul",value:"#1d4ed8"},{name:"Verde",value:"#166534"},{name:"Vermelho",value:"#b91c1c"},{name:"Violeta",value:"#7e22ce"},{name:"Cinza",value:"#51666b"},{name:"Preto",value:"#000000"}];
const highlights=[{name:"Amarelo",value:"#fef08a"},{name:"Verde",value:"#bbf7d0"},{name:"Azul",value:"#bfdbfe"},{name:"Rosa",value:"#fbcfe8"},{name:"Lilás",value:"#ddd6fe"}];
function Tool({name,icon:Icon,active,disabled,onClick}:{name:string;icon:LucideIcon;active?:boolean;disabled?:boolean;onClick:()=>void}){
 return <button type="button" className="kb-tool" aria-label={name} title={name} aria-pressed={active===undefined?undefined:active} disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={onClick}><Icon size={18} strokeWidth={1.8} aria-hidden="true"/></button>;
}
export function EditorToolbar({editor,disabled,label,onImage}:{editor:Editor;disabled:boolean;label:string;onImage:()=>void}){
 const [panel,setPanel]=useState<"link"|"color"|"highlight"|"table"|null>(null),[href,setHref]=useState(""),[error,setError]=useState("");
 const state=useEditorState({editor,selector:({editor:e})=>({bold:e.isActive("bold"),italic:e.isActive("italic"),underline:e.isActive("underline"),strike:e.isActive("strike"),sub:e.isActive("subscript"),sup:e.isActive("superscript"),bullet:e.isActive("bulletList"),ordered:e.isActive("orderedList"),quote:e.isActive("blockquote"),code:e.isActive("codeBlock"),link:e.isActive("link"),highlight:e.isActive("highlight"),heading:e.isActive("heading")?String(e.getAttributes("heading").level):"p",size:e.getAttributes("textStyle").fontSize||"16px",color:e.getAttributes("textStyle").color||"#1c353b",align:e.getAttributes(e.isActive("heading")?"heading":"paragraph").textAlign||"left",table:e.isActive("table"),undo:e.can().undo(),redo:e.can().redo(),indent:e.can().sinkListItem("listItem"),outdent:e.can().liftListItem("listItem")})});
 const toggle=(next:typeof panel)=>{setError("");setPanel(panel===next?null:next);};
 const tool=(name:string,icon:LucideIcon,onClick:()=>void,active?:boolean,unavailable=false)=><Tool key={name} name={name} icon={icon} active={active} disabled={disabled||unavailable} onClick={onClick}/>;
 return <div className="kb-editor-tools">
  <div className="kb-toolbar kb-toolbar-professional" role="toolbar" aria-label={`Ferramentas: ${label}`} onKeyDown={e=>{
   if(!(e.target instanceof HTMLButtonElement)||!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;
   const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));const index=buttons.indexOf(e.target);const next=e.key==="Home"?0:e.key==="End"?buttons.length-1:(index+(e.key==="ArrowRight"?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();e.preventDefault();
  }}>
   <div className="kb-tool-group" role="group" aria-label="Histórico">
    {tool("Desfazer (Ctrl+Z)",Undo2,()=>{editor.chain().focus().undo().run();},undefined,!state.undo)}
    {tool("Refazer (Ctrl+Shift+Z)",Redo2,()=>{editor.chain().focus().redo().run();},undefined,!state.redo)}
   </div>
   <div className="kb-tool-group kb-tool-selects" role="group" aria-label="Estilo do texto">
    <select aria-label={`Estilo em ${label}`} disabled={disabled} value={state.heading} onChange={e=>{if(e.target.value==="p")editor.chain().focus().setParagraph().run();else editor.chain().focus().setHeading({level:Number(e.target.value) as 2|3|4}).run();}}><option value="p">Texto normal</option><option value="2">Título 2</option><option value="3">Título 3</option><option value="4">Título 4</option></select>
    <select aria-label={`Tamanho em ${label}`} disabled={disabled} value={state.size} onChange={e=>editor.chain().focus().setFontSize(e.target.value).run()}>{[14,16,18,20,24].map(n=><option key={n} value={`${n}px`}>{n}</option>)}</select>
   </div>
   <div className="kb-tool-group" role="group" aria-label="Formatação">
    {tool("Negrito",Bold,()=>{editor.chain().focus().toggleBold().run();},state.bold)}
    {tool("Itálico",Italic,()=>{editor.chain().focus().toggleItalic().run();},state.italic)}
    {tool("Sublinhado",Underline,()=>{editor.chain().focus().toggleUnderline().run();},state.underline)}
    {tool("Tachado",Strikethrough,()=>{editor.chain().focus().toggleStrike().run();},state.strike)}
    {tool("Subscrito",Subscript,()=>{editor.chain().focus().unsetSuperscript().toggleSubscript().run();},state.sub)}
    {tool("Sobrescrito",Superscript,()=>{editor.chain().focus().unsetSubscript().toggleSuperscript().run();},state.sup)}
    {tool("Cor do texto",Palette,()=>toggle("color"),panel==="color")}
    {tool("Destacar texto",Highlighter,()=>toggle("highlight"),state.highlight||panel==="highlight")}
   </div>
   <div className="kb-tool-group" role="group" aria-label="Alinhamento">
    {([['left','Alinhar à esquerda',AlignLeft],['center','Centralizar',AlignCenter],['right','Alinhar à direita',AlignRight],['justify','Justificar',AlignJustify]] as const).map(([alignment,name,icon])=>tool(name,icon,()=>{editor.chain().focus().setTextAlign(alignment).run();},state.align===alignment))}
   </div>
   <div className="kb-tool-group" role="group" aria-label="Listas e recuos">
    {tool("Lista com marcadores",List,()=>{editor.chain().focus().toggleBulletList().run();},state.bullet)}
    {tool("Lista numerada",ListOrdered,()=>{editor.chain().focus().toggleOrderedList().run();},state.ordered)}
    {tool("Aumentar recuo da lista",IndentIncrease,()=>{editor.chain().focus().sinkListItem("listItem").run();},undefined,!state.indent)}
    {tool("Diminuir recuo da lista",IndentDecrease,()=>{editor.chain().focus().liftListItem("listItem").run();},undefined,!state.outdent)}
   </div>
   <div className="kb-tool-group" role="group" aria-label="Inserir">
    {tool("Inserir ou editar link",Link2,()=>{setHref(editor.getAttributes("link").href||"");toggle("link");},state.link||panel==="link")}
    {tool("Remover link",Unlink,()=>{editor.chain().focus().unsetLink().run();},undefined,!state.link)}
    {tool("Inserir imagem",ImagePlus,onImage)}
    {tool("Tabela",Table2,()=>toggle("table"),state.table||panel==="table")}
    {tool("Aviso ou citação",Quote,()=>{editor.chain().focus().toggleBlockquote().run();},state.quote)}
    {tool("Bloco de código",Code2,()=>{editor.chain().focus().toggleCodeBlock().run();},state.code)}
    {tool("Linha divisória",Minus,()=>{editor.chain().focus().setHorizontalRule().run();})}
    {tool("Limpar formatação",RemoveFormatting,()=>{editor.chain().focus().unsetAllMarks().unsetTextAlign().clearNodes().run();})}
   </div>
  </div>
  {panel?<div className="kb-tool-panel" role="group" aria-label={{link:"Configurar link",color:"Escolher cor",highlight:"Escolher destaque",table:"Ferramentas de tabela"}[panel]}>
   <button className="kb-tool-panel-close" type="button" aria-label="Fechar ferramentas" onClick={()=>setPanel(null)}><X size={16}/></button>
   {panel==="link"?<form className="kb-link-form" onSubmit={e=>{e.preventDefault();if(!/^(https:\/\/|mailto:)/i.test(href)){setError("Use um endereço HTTPS ou mailto.");return;}editor.chain().focus().extendMarkRange("link").setLink({href}).run();setPanel(null);}}><label>Endereço do link<input autoFocus type="url" name="href" autoComplete="off" value={href} onChange={e=>setHref(e.target.value)} placeholder="https://exemplo.com…"/></label><button type="submit" disabled={disabled}><Check size={16}/>Aplicar link</button><p role="alert">{error}</p></form>:null}
   {panel==="color"||panel==="highlight"?<><strong>{panel==="color"?"Cor do texto":"Destaque do texto"}</strong><div className="kb-color-options">{(panel==="color"?colors:highlights).map(c=><button key={c.value} type="button" aria-label={`${panel==="color"?"Texto":"Destaque"} ${c.name}`} title={c.name} className="kb-color-swatch" style={{backgroundColor:c.value}} onClick={()=>{if(panel==="color")editor.chain().focus().setColor(c.value).run();else editor.chain().focus().setHighlight({color:c.value}).run();setPanel(null);}}/>)}<label className="kb-custom-color">Personalizada<input type="color" aria-label="Cor personalizada" value={state.color} onChange={e=>{if(panel==="color")editor.chain().focus().setColor(e.target.value).run();else editor.chain().focus().setHighlight({color:e.target.value}).run();}}/></label><button type="button" onClick={()=>{if(panel==="color")editor.chain().focus().unsetColor().run();else editor.chain().focus().unsetHighlight().run();setPanel(null);}}>Remover cor</button></div></>:null}
   {panel==="table"?<><strong>{state.table?"Editar tabela":"Inserir tabela"}</strong><div className="kb-table-tools">{!state.table?<button type="button" disabled={disabled} onClick={()=>{editor.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run();setPanel(null);}}><Table2 size={16}/>Tabela 3×3</button>:<>{[["Linha acima",()=>editor.chain().focus().addRowBefore().run()],["Linha abaixo",()=>editor.chain().focus().addRowAfter().run()],["Coluna à esquerda",()=>editor.chain().focus().addColumnBefore().run()],["Coluna à direita",()=>editor.chain().focus().addColumnAfter().run()],["Mesclar células",()=>editor.chain().focus().mergeCells().run()],["Dividir célula",()=>editor.chain().focus().splitCell().run()],["Alternar cabeçalho",()=>editor.chain().focus().toggleHeaderRow().run()],["Excluir linha",()=>editor.chain().focus().deleteRow().run()],["Excluir coluna",()=>editor.chain().focus().deleteColumn().run()],["Excluir tabela",()=>{editor.chain().focus().deleteTable().run();setPanel(null);}]].map(([name,fn])=><button type="button" key={String(name)} disabled={disabled||name==="Mesclar células"&&!editor.can().mergeCells()||name==="Dividir célula"&&!editor.can().splitCell()} onClick={fn as ()=>void}>{String(name)}</button>)}</>}</div></>:null}
  </div>:null}
 </div>;
}
