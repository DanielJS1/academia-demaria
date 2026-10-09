"use client";
import { useEffect,useState } from "react";
import { kbJson } from "@/lib/kb/client";
type Count={total:number|null;new:number};
// Share in-flight reads across React Strict Mode mounts, including the first cookie setup.
const requests=new Map<string,{at:number;result:Promise<Count>}>();
function readCount(slug:string){const old=requests.get(slug);if(old&&Date.now()-old.at<5000)return old.result;
 if(requests.size>100)requests.clear();const result=kbJson<Count>(`/api/kb/views/${encodeURIComponent(slug)}`,{method:"POST"});requests.set(slug,{at:Date.now(),result});return result;
}
export function ArticleViews({slug}:{slug:string}){
 const [views,setViews]=useState<{total:number|null;new:number}|null>(null);
 useEffect(()=>{let active=true;setViews(null);void readCount(slug).then(v=>{if(active)setViews(v);}).catch(()=>{});return()=>{active=false;};},[slug]);
 return views?<p>{views.total==null?`${views.new.toLocaleString("pt-BR")} novas visualizações · histórico indisponível`:`${views.total.toLocaleString("pt-BR")} visualizações`}</p>:null;
}
