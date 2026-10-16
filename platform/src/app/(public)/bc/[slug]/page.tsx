import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { context,publication } from "@/lib/kb/server";
import { publicOrigin,kbRobots } from "@/lib/kb/host";
import { ArticleViews } from "@/components/kb/article-views";
import { KbReader } from "@/components/kb/reader";
import type { KbDocument } from "@/lib/kb/document";
export const dynamic="force-dynamic";
async function read(slug:string){const req=new Request(process.env.NODE_ENV!=="production"?"http://127.0.0.1/bc":"https://bc.invalid/bc");return publication(await context(req),slug);}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){try{const slug=(await params).slug;const a=await read(slug);if(!a)return {title:"Artigo não encontrado",robots:{index:false,follow:false}};return {title:a.title,description:a.summary,robots:kbRobots((await headers()).get("host")),alternates:publicOrigin()?{canonical:`${publicOrigin()}/bc/${slug}`}:undefined};}catch{return {title:"Base de Conhecimento",robots:{index:false,follow:false}};}}
export default async function Page({params}:{params:Promise<{slug:string}>}){const a=await read((await params).slug);if(!a)notFound();return <KbReader document={a.document as KbDocument} publishedAt={String(a.published_at)} articleViews={<ArticleViews slug={a.slug}/>}/>;}
