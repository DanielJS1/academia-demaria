"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { useSearchParams,useRouter } from "next/navigation";
import { kbJson } from "@/lib/kb/client";
type Result={slug:string;title:string;summary:string;product:string;category:string;tags:string[];published_at:string;total:number};
export function PublicPortal({internal=false}:{internal?:boolean}){
 const base=internal?"/conhecimento/base":"/bc";
 const params=useSearchParams(),router=useRouter();const [results,setResults]=useState<Result[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 const page=Math.max(1,Number(params.get("pagina"))||1);const query=new URLSearchParams({q:params.get("q")||"",pagina:String(page)}).toString();
 useEffect(()=>{const abort=new AbortController();setLoading(true);setError("");void kbJson<{results:Result[]}>(`/api/kb?${query}`,{signal:abort.signal},internal).then(r=>setResults(r.results)).catch(e=>{if(!abort.signal.aborted){setResults([]);setError(e.message);}}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();},[query,internal]);
 const changePage=(p:number)=>{const next=new URLSearchParams(query);next.set("pagina",String(p));router.push(`${base}?${next}`);};
 return <div className="kb-portal"><section className="kb-hero"><p className="kb-eyebrow">DOCUMENTAÇÃO DEMARIA</p><h1>Encontre a orientação<br/>para o próximo passo.</h1><p>Procedimentos, novidades e atualizações dos nossos produtos.</p><form action={base} className="kb-search" key={query}><label htmlFor="kb-query">O que você precisa consultar?</label><div><input id="kb-query" type="search" name="q" defaultValue={params.get("q")||""} placeholder="Busque nos títulos, conteúdos e tags…"/><button type="submit">Pesquisar</button></div></form></section><section className="kb-results" aria-busy={loading}><h2>{params.get("q")?`Resultados para “${params.get("q")}”`:"Artigos publicados"}</h2><p role="status">{loading?"Pesquisando…":error||`${results[0]?.total||0} artigos encontrados`}</p>{!loading&&!error&&results.length===0?<p>Nenhum artigo publicado corresponde à pesquisa.</p>:null}{results.map(r=><article key={r.slug}><p className="kb-eyebrow">{r.product} · {r.category}</p><h3><Link href={`${base}/${r.slug}`}>{r.title}</Link></h3><p className="kb-card-summary">{r.summary}</p><small>{new Date(r.published_at).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})} · {r.tags.join(" · ")}</small></article>)}<nav className="kb-pagination" aria-label="Paginação"><button onClick={()=>changePage(page-1)} disabled={page===1||loading}>Anterior</button><span>Página {page}</span><button onClick={()=>changePage(page+1)} disabled={page*20>=Number(results[0]?.total||0)||loading}>Próxima</button></nav></section></div>;
}
