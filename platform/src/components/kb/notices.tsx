"use client";
import { useEffect,useState,useId,useRef } from "react";
import { Bell,X } from "lucide-react";
import { kbJson } from "@/lib/kb/client";
type Notice={id:string;article_id:string;message:string;created_at:string;read_at:string|null};
export function KbNotices({refreshKey,onOpen}:{refreshKey:string;onOpen:(id:string)=>void}){
 const [notices,setNotices]=useState<Notice[]>([]),[error,setError]=useState(""),[open,setOpen]=useState(false);const id=useId(),panel=useRef<HTMLDivElement>(null);
 useEffect(()=>{const abort=new AbortController();void kbJson<{notices:Notice[]}>("/api/kb/notifications",{signal:abort.signal}).then(r=>{if(!abort.signal.aborted){setNotices(r.notices);setError("");}}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[refreshKey]);
 return <div className="kb-notices"><button type="button" className="kb-notices-trigger" popoverTarget={id} aria-expanded={open} aria-controls={id}><Bell size={18}/><span>Avisos editoriais</span><span className="kb-notice-count" aria-label={`${notices.filter(n=>!n.read_at).length} avisos não lidos`}>{notices.filter(n=>!n.read_at).length}</span></button>
  <div ref={panel} id={id} popover="auto" className="kb-notices-panel" role="region" aria-label="Avisos editoriais" onToggle={e=>setOpen(e.newState==="open")}><header><h2>Avisos editoriais</h2><button type="button" popoverTarget={id} popoverTargetAction="hide" aria-label="Fechar avisos"><X size={18}/></button></header><div className="kb-notices-scroll"><p role="alert">{error}</p>{!notices.length&&!error?<p>Nenhum aviso editorial por enquanto.</p>:null}{notices.map(n=><div className={`kb-event${n.read_at?"":" kb-notice-unread"}`} key={n.id}><p>{n.message}</p><time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</time><div><button onClick={()=>{panel.current?.hidePopover();onOpen(n.article_id);}}>Abrir artigo</button>{!n.read_at?<button onClick={async()=>{try{await kbJson("/api/kb/notifications",{method:"POST",body:JSON.stringify({id:n.id})});setNotices(v=>v.map(i=>i.id===n.id?{...i,read_at:new Date().toISOString()}:i));}catch(e){setError((e as Error).message);}}}>Marcar como lido</button>:null}</div></div>)}</div></div>
 </div>;
}
