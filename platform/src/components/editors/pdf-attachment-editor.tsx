"use client";
import { useState } from "react";
import { browserAuth } from "@/lib/supabase-browser";
import type { Lesson } from "@/lib/model";
export function PdfAttachmentEditor({lesson,onChange,onBusyChange}:{lesson:Lesson;onChange:(value:Pick<Lesson,"attachmentPath"|"attachmentName">)=>void;onBusyChange:(busy:boolean)=>void}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 return <div className="field"><label><span>Anexar PDF · até 3 MB</span><input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={async event=>{
  const input=event.currentTarget;const file=input.files?.[0];if(!file)return;setError("");
  if(file.size>3*1024*1024){setError("O PDF deve ter até 3 MB.");input.value="";return;}
  setBusy(true);onBusyChange(true);try{
   const session=await browserAuth()?.auth.getSession();const token=session?.data.session?.access_token;if(!token)throw new Error("Entre novamente para anexar o PDF.");
   const body=new FormData();body.set("file",file);
   const response=await fetch("/api/attachments",{method:"POST",headers:{Authorization:`Bearer ${token}`},body});const data=await response.json();
   if(!response.ok)throw new Error(data.error);onChange({attachmentPath:data.attachmentPath,attachmentName:data.attachmentName});
  }catch(e){setError(e instanceof Error?e.message:"Falha no envio.");}finally{setBusy(false);onBusyChange(false);input.value="";}
 }}/></label>{busy&&<small role="status">Enviando PDF… aguarde antes de salvar.</small>}{lesson.attachmentPath&&<div><strong>{lesson.attachmentName||"PDF anexado"}</strong><button type="button" className="button button-ghost" onClick={()=>onChange({attachmentPath:undefined,attachmentName:undefined})}>Remover anexo</button><small>Salve o curso para disponibilizar o arquivo na prévia.</small></div>}{error&&<p className="form-error" role="alert">{error}</p>}</div>;
}
