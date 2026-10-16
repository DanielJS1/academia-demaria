import Link from "next/link";
import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {previewCatalog} from "@/lib/kb/pilot-preview";
import {textOf} from "@/lib/kb/document";
export const dynamic="force-dynamic";
export const metadata={title:"Prévia dos artigos DeMaria",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{q?:string}>}){
 const host=(await headers()).get("host")||"invalid";
 const articles=await previewCatalog(new Request(`http://${host}/bc/previas`));if(!articles.length)notFound();
 const {q=""}=await searchParams;
 const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
 const terms=normalize(q).trim().split(/\s+/).filter(Boolean);
 const results=articles.filter(a=>{const text=normalize([a.document.metadata.title,a.document.metadata.summary,...a.document.metadata.tags,...a.document.sections.map(s=>textOf(s.content))].join(" "));return terms.every(term=>text.includes(term));});
 return <div className="kb-portal"><p className="kb-eyebrow">REVISÃO DA BASE DE CONHECIMENTO</p><h1>Os cinco artigos,<br/>na apresentação DeMaria.</h1><p>Confira o conteúdo e as imagens na mesma experiência de leitura que será usada pelos clientes.</p><p className="kb-preview-notice">Prévia local para revisão. Os originais continuam privados e aguardam aprovação editorial.</p><form action="/bc/previas" className="kb-search"><label htmlFor="kb-preview-query">O que você precisa consultar?</label><div><input id="kb-preview-query" type="search" name="q" defaultValue={q} placeholder="Busque nos títulos, conteúdos e tags…"/><button type="submit">Pesquisar</button></div></form><section className="kb-results"><h2>{q?`Resultados para “${q}”`:"Artigos para revisão"}</h2><p role="status">{results.length} artigos encontrados</p>{results.length===0&&<p>Nenhum artigo corresponde à pesquisa.</p>}{results.map(a=><article key={a.id}><p className="kb-eyebrow">{a.document.metadata.product} · Procedimento</p><h2><Link href={`/bc/previa/${a.slug}`}>{a.document.metadata.title}</Link></h2><p className="kb-card-summary">{a.document.metadata.summary}</p><Link href={`/bc/previa/${a.slug}`}>Ler artigo →</Link></article>)}</section></div>;
}
