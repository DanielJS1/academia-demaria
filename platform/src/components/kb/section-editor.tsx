"use client";
import { useEffect,useRef } from "react";
import { EditorContent,useEditor,NodeViewWrapper,ReactNodeViewRenderer } from "@tiptap/react";
import { Node,Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle,Color,FontSize } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { EditorToolbar } from "./editor-toolbar";
import { TableKit } from "@tiptap/extension-table";
import { KbImage } from "./reader";
import { identifyBlocks,type RichNode } from "@/lib/kb/document";
const BlockIds=Extension.create({name:"blockIds",addGlobalAttributes(){return [{types:["paragraph","heading","bulletList","orderedList","listItem","blockquote","codeBlock","horizontalRule","image","table","tableRow","tableCell","tableHeader"],attributes:{blockId:{default:null,parseHTML:e=>e.getAttribute("data-kb-block"),renderHTML:a=>a.blockId?{"data-kb-block":a.blockId}:{}}}}];}});
const Media=Node.create({name:"image",group:"block",atom:true,
 addAttributes(){return {mediaId:{default:null,parseHTML:e=>e.getAttribute("data-media-id")},alt:{default:""},width:{default:null},height:{default:null},textAlign:{default:"center",parseHTML:e=>e.getAttribute("data-text-align")||"center"}};},
 parseHTML(){return [{tag:"img[data-media-id]"}];},
 renderHTML({HTMLAttributes:a}){return ["img",{"data-kb-block":a["data-kb-block"],"data-text-align":a.textAlign,"data-media-id":a.mediaId,src:`/api/kb/media/${a.mediaId}`,alt:a.alt,width:a.width,height:a.height}];},
 addNodeView(){return ReactNodeViewRenderer(({node,updateAttributes,editor,getPos,selected})=><NodeViewWrapper className={`${selected?"kb-selected-image ":""}${node.attrs.alt==="Logo DeMaria"&&node.attrs.textAlign==="right"?"kb-template-logo-editor":""}`} contentEditable={false}><KbImage node={node.toJSON() as RichNode} onSelect={()=>{const pos=getPos();if(typeof pos==="number")editor.chain().focus().setNodeSelection(pos).run();}}/><details><summary>Texto de acessibilidade</summary><label>Descrição da captura<input disabled={!editor.isEditable} value={node.attrs.alt} onChange={e=>updateAttributes({alt:e.target.value})}/></label></details></NodeViewWrapper>);},
});
export function SectionEditor({value,onChange,disabled,label,onUpload}:{value:RichNode;onChange:(v:RichNode)=>void;disabled:boolean;label:string;onUpload:(file:File)=>Promise<{id:string;alt:string;width:number;height:number}>}){
 const input=useRef<HTMLInputElement>(null),callback=useRef(onChange);callback.current=onChange;
 const editor=useEditor({immediatelyRender:false,extensions:[StarterKit.configure({heading:{levels:[2,3,4]}}),TableKit,Media,BlockIds,TextAlign.configure({types:["paragraph","heading"],defaultAlignment:"justify"}),TextStyle,Color,FontSize,Highlight.configure({multicolor:true}),Subscript,Superscript],content:value,editable:!disabled,onUpdate:({editor:e})=>{const tr=e.state.tr;let missing=false;e.state.doc.descendants((n,pos)=>{if(!["doc","text","hardBreak"].includes(n.type.name)&&!n.attrs.blockId){tr.setNodeMarkup(pos,undefined,{...n.attrs,blockId:crypto.randomUUID()});missing=true;}});if(missing){e.view.dispatch(tr);return;}callback.current(identifyBlocks(e.getJSON() as RichNode));},editorProps:{attributes:{"aria-label":label},handlePaste:(_view,event)=>{const file=Array.from(event.clipboardData?.files||[]).find(f=>f.type.startsWith("image/"));if(!file)return false;void insert(file);return true;}}});
 async function insert(file:File){try{const m=await onUpload(file);editor?.chain().focus().insertContent({type:"image",attrs:{mediaId:m.id,alt:m.alt,width:m.width,height:m.height}}).run();}catch{/* Parent presents upload error. */}}
 useEffect(()=>{if(editor){editor.setEditable(!disabled,false);if(JSON.stringify(identifyBlocks(editor.getJSON() as RichNode))!==JSON.stringify(value))editor.commands.setContent(value,{emitUpdate:false});}},[value,editor,disabled]);
 if(!editor)return <p role="status">Preparando editor…</p>;
 return <div className="kb-section-editor"><EditorToolbar editor={editor} disabled={disabled} label={label} onImage={()=>input.current?.click()}/><p className="kb-help">Imagens e GIFs: até 5 MB. Para GIFs, prefira até 2 MB e demonstrações curtas.</p><input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void insert(f);e.target.value="";}}/><EditorContent editor={editor}/></div>;
}
