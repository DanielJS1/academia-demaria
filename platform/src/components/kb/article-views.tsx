"use client";
import { useEffect,useState } from "react";
import { Eye } from "lucide-react";
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
 return <div className="kb-article-views" role="status" aria-atomic="true" style={views?undefined:{visibility:"hidden"}}><span className="kb-views-icon"><Eye size={22} aria-hidden="true"/></span><div><span className="kb-views-value">{(views?.total??views?.new??0).toLocaleString("pt-BR")}</span><span className="kb-views-label">{views?.total==null?"novas visualizações":"visualizações"}</span>{views?.total==null?<small>Histórico indisponível</small>:null}</div></div>;
}
