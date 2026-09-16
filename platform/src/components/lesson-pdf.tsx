"use client";
import { useEffect, useState } from "react";
import { browserAuth } from "@/lib/supabase-browser";
export function LessonPdf({courseId,lessonId,name,preview}:{courseId:string;lessonId:string;name:string;preview:boolean}){
 const [url,setUrl]=useState("");const [error,setError]=useState("");const [retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setUrl("");setError("");void(async()=>{try{
  const session=await browserAuth()?.auth.getSession();const token=session?.data.session?.access_token;
  const response=await fetch(`/api/attachments?${new URLSearchParams({courseId,lessonId,preview:preview?"1":"0"})}`,{headers:{Authorization:`Bearer ${token}`}});const data=await response.json();
  if(!response.ok)throw new Error(data.error);if(active)setUrl(data.url);
 }catch(e){if(active)setError(e instanceof Error?e.message:"Falha ao carregar PDF.");}})();return()=>{active=false;};},[courseId,lessonId,preview,retry]);
 return <section className="lesson-pdf">{url?<><a className="button button-secondary" href={url} target="_blank" rel="noopener noreferrer">Abrir PDF: {name}</a><iframe src={url} title={name}/></>:<p role="status">{error||"Carregando PDF…"}</p>}<button className="button button-ghost" onClick={()=>setRetry(n=>n+1)}>Recarregar PDF</button></section>;
}
