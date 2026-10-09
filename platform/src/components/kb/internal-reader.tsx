"use client";
import { useEffect,useState } from "react";
import { kbJson } from "@/lib/kb/client";
import type { KbDocument } from "@/lib/kb/document";
import { ArticleViews } from "./article-views";
import { KbReader } from "./reader";
export function InternalReader({slug}:{slug:string}){const [article,setArticle]=useState<{document:KbDocument;published_at:string}|null>(null),[error,setError]=useState("");useEffect(()=>{const abort=new AbortController();void kbJson<{document:KbDocument;published_at:string}>(`/api/kb/read/${encodeURIComponent(slug)}`,{signal:abort.signal}).then(setArticle).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[slug]);return article?<><ArticleViews slug={slug}/><KbReader document={article.document} publishedAt={article.published_at} baseHref="/conhecimento/base"/></>:<p role={error?"alert":"status"}>{error||"Carregando artigo…"}</p>;}
