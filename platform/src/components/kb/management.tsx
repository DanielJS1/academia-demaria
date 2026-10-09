"use client";
import dynamic from "next/dynamic";
import { useCallback,useEffect,useState } from "react";
import { Plus,Search } from "lucide-react";
import { kbJson } from "@/lib/kb/client";
import type { Detail } from "./editor";
import { KbNotices } from "./notices";
import { EditorialTable,type EditorialRow } from "./editorial-table";
const KbEditor=dynamic(()=>import("./editor").then(m=>m.KbEditor),{ssr:false});
type Me={id:string;name:string;role:string};
type Index={articles:EditorialRow[];total:number;counts:Record<string,number>;me:Me};
const filters={all:"Todos",mine:"Meus",published:"Publicados",draft:"Rascunhos",review:"Em revisão",changes:"Ajustes",archived:"Arquivados",deleted:"Lixeira"};
export function KbManagement({pilot=false}:{pilot?:boolean}){
 const [rows,setRows]=useState<EditorialRow[]>([]),[me,setMe]=useState<Me|null>(null),[article,setArticle]=useState<Detail|null>(null);
 const [error,setError]=useState(""),[message,setMessage]=useState(""),[filter,setFilter]=useState("all"),[page,setPage]=useState(1),[query,setQuery]=useState(""),[search,setSearch]=useState("");
 const [counts,setCounts]=useState<Record<string,number>>({}),[total,setTotal]=useState(0),[profiles,setProfiles]=useState<Me[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const load=useCallback(async(signal?:AbortSignal)=>{setLoading(true);try{
  const params=new URLSearchParams({editorial:"1",pagina:String(page),filter,q:query});const r=await kbJson<Index>(`/api/kb?${params}`,{signal});if(signal?.aborted)return;
  setRows(r.articles);setCounts(r.counts);setTotal(r.total);setMe(r.me);setError("");
 }catch(e){if(!signal?.aborted)setError((e as Error).message);}finally{if(!signal?.aborted)setLoading(false);}},[page,filter,query]);
 useEffect(()=>{const abort=new AbortController();void load(abort.signal);return()=>abort.abort();},[load]);
 useEffect(()=>{if(pilot)void kbJson<{profiles:Me[]}>("/api/kb/pilot").then(r=>setProfiles(r.profiles)).catch(()=>{});},[pilot]);
 useEffect(()=>{window.dispatchEvent(new CustomEvent("academy:editor-layout",{detail:!!article}));return()=>{window.dispatchEvent(new CustomEvent("academy:editor-layout",{detail:false}));};},[!!article]);
 const open=async(id:string)=>{setBusy(true);setError("");try{const detail=await kbJson<Detail>(`/api/kb/articles/${id}`);if(detail.status==="deleted"){setArticle(null);setFilter("deleted");setPage(1);setMessage("Este artigo está na lixeira. Restaure-o para editar.");}else setArticle(detail);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 async function create(){setBusy(true);setError("");try{const r=await kbJson<{id:string}>("/api/kb/template",{method:"POST",body:JSON.stringify({templateId:"procedimento"})});await open(r.id);await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function trash(row:Pick<EditorialRow,"id"|"title"|"version">,restore=false){
  if(busy)return;
  if(!restore&&!window.confirm(`Excluir “${row.title||"Artigo sem título"}”? Ele será enviado à lixeira e deixará de aparecer aos clientes. Você poderá restaurá-lo depois.`))return;
  setBusy(true);setError("");try{const r=await kbJson<{status:string}>("/api/kb/trash",{method:"POST",body:JSON.stringify({articleId:row.id,expectedVersion:row.version,restore})});if(article?.id===row.id)setArticle(null);setMessage(restore?`Artigo restaurado${r.status==="archived"?" em Arquivados":""}.`:"Artigo enviado à lixeira.");await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <div className="kb kb-management">
  {pilot?<section className="kb-pilot"><h2>Homologação local</h2><p>Contas sintéticas isoladas. Este acesso é desativado em produção.</p>{profiles.map(p=><button key={p.id} onClick={async()=>{await kbJson("/api/kb/pilot",{method:"POST",body:JSON.stringify({id:p.id})});setArticle(null);await load();}}>{p.name}</button>)}<button onClick={async()=>{await kbJson("/api/kb/pilot",{method:"POST",body:JSON.stringify({id:null})});setArticle(null);await load();}}>Visitante</button></section>:null}
  <header className="kb-management-toolbar"><div><h1>Artigos</h1>{me&&!article&&<button className="kb-create-article" disabled={busy} onClick={()=>void create()}><Plus size={18}/>Criar artigo</button>}</div>{me&&<KbNotices refreshKey={`${me.id}-${article?.version||0}`} onOpen={id=>void open(id)}/>}</header>
  <p role="alert">{error}</p>{message&&<p className="kb-workspace-message" role="status">{message}</p>}
  {article?<KbEditor key={`${article.id}-${article.version}`} article={article} admin={me?.role==="admin"} onDelete={()=>trash({id:article.id,title:article.document.metadata.title,version:article.version})} onRefresh={async()=>{await open(article.id);await load();}} onBack={()=>{setArticle(null);setMessage("");void load();}}/>:me?<>
   <div className="kb-index-tools"><div className="kb-index-filters" role="group" aria-label="Filtrar artigos">{Object.entries(filters).map(([key,label])=><button key={key} aria-pressed={filter===key} disabled={busy} onClick={()=>{setFilter(key);setPage(1);setMessage("");}}>{label}<span>{counts[key]??0}</span></button>)}</div>
    <form className="kb-index-search" onSubmit={e=>{e.preventDefault();setQuery(search.trim());setPage(1);}}><label htmlFor="kb-editorial-query" className="sr-only">Buscar por título ou autor</label><input id="kb-editorial-query" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Título ou autor"/><button type="submit" aria-label="Buscar artigos" disabled={busy}><Search size={18}/></button></form>
   </div>
   <div className="kb-index-summary"><p role="status">{loading?"Carregando artigos…":`${total} ${total===1?"artigo":"artigos"}`}</p><p>Mais recentes primeiro · data de criação original</p></div>
   <section aria-busy={loading}><EditorialTable rows={rows} busy={busy||loading} onOpen={id=>void open(id)} onTrash={(r,restore)=>void trash(r,restore)}/></section>
   <nav className="kb-pagination" aria-label="Páginas dos artigos"><button disabled={page===1||busy||loading} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page} de {Math.max(1,Math.ceil(total/20))}</span><button disabled={page*20>=total||busy||loading} onClick={()=>setPage(p=>p+1)}>Próxima</button></nav>
  </>:!loading?<p>Entre com uma conta interna aprovada.</p>:null}
 </div>;
}