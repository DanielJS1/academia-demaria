import Link from "next/link";
import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {previewCatalog} from "@/lib/kb/pilot-preview";
import {KbReader} from "@/components/kb/reader";
export const dynamic="force-dynamic";
export const metadata={title:"Prévia editorial DeMaria",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{slug:string}>}){
 const host=(await headers()).get("host")||"invalid";
 const {slug}=await params;
 const article=(await previewCatalog(new Request(`http://${host}/bc/previa`))).find(a=>a.slug===slug);
 if(!article)notFound();
 return <><aside className="kb-preview-notice"><Link href="/bc/previas">← Todos os artigos</Link> · Prévia local da leitura dos clientes. Conteúdo histórico ainda em revisão.</aside><KbReader document={article.document} mediaBase="/api/kb/preview-media"/></>;
}
