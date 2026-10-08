"use client";
import { useEffect,useState } from "react";
import { kbJson } from "@/lib/kb/client";
type Notice={id:string;article_id:string;message:string;created_at:string;read_at:string|null};
export function KbNotices({refreshKey,onOpen}:{refreshKey:string;onOpen:(id:string)=>void}){
 const [notices,setNotices]=useState<Notice[]>([]),[error,setError]=useState("");
 useEffect(()=>{const abort=new AbortController();void kbJson<{notices:Notice[]}>("/api/kb/notifications",{signal:abort.signal}).then(r=>setNotices(r.notices)).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[refreshKey]);
 return <details className="kb-notices"><summary>Avisos editoriais ({notices.filter(n=>!n.read_at).length} novos)</summary><p role="alert">{error}</p>{notices.map(n=><div className="kb-event" key={n.id}><p>{n.message}</p><button onClick={()=>onOpen(n.article_id)}>Abrir artigo</button>{!n.read_at?<button onClick={async()=>{try{await kbJson("/api/kb/notifications",{method:"POST",body:JSON.stringify({id:n.id})});setNotices(v=>v.map(i=>i.id===n.id?{...i,read_at:new Date().toISOString()}:i));}catch(e){setError((e as Error).message);}}}>Marcar como lido</button>:null}</div>)}</details>;
}
