import { publicOrigin } from "@/lib/kb/host";
import { context,privateHeaders } from "@/lib/kb/server";
import { asLocal } from "@/lib/kb/local-db";
import { escapeHtml } from "@/lib/kb/document";
export const dynamic="force-dynamic";
export async function GET(request:Request){const origin=publicOrigin();if(!origin||request.headers.get("host")!==new URL(origin).host)return new Response(null,{status:404,headers:privateHeaders});try{
 const ctx=await context(new Request(request.url));let items:{slug:string;published_at:string}[]=[];
 if(ctx.local)items=await asLocal(ctx.db,null,async tx=>(await tx.query<{slug:string;published_at:string}>("select slug,published_at from kb_publications where visibility='public'")).rows);
 else {for(let offset=0;;offset+=1000){const r=await ctx.client.from("kb_publications").select("slug,published_at").eq("visibility","public").order("slug").range(offset,offset+999);if(r.error)throw new Error();items.push(...r.data);if(r.data.length<1000)break;}}
 return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items.map(a=>`<url><loc>${escapeHtml(`${origin}/bc/${a.slug}`)}</loc><lastmod>${new Date(a.published_at).toISOString()}</lastmod></url>`).join("")}</urlset>`,{headers:{...privateHeaders,"Content-Type":"application/xml"}});
 }catch{return new Response(null,{status:503,headers:privateHeaders});}}
