// Local-only, idempotent pilot. Never connects to the Supabase remote database.
import { readFile,mkdir,writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const origin=process.env.KB_PILOT_URL||"http://127.0.0.1:4174";
if(!["127.0.0.1","localhost"].includes(new URL(origin).hostname))throw new Error("Use apenas localhost.");
const cookie="kb-pilot=11111111-1111-4111-8111-111111111111";
async function api(url,body){const r=await fetch(origin+url,{method:body?"POST":"GET",headers:{Cookie:cookie,...(body instanceof FormData?{}:{"Content-Type":"application/json"})},body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});const data=await r.json();if(!r.ok)throw new Error(data.error);return data;}
const manifest=JSON.parse(await readFile(path.resolve("../docs/references/bc-artigos-manifesto.json"),"utf8"));
const folder=path.resolve(".kb-pilot");await mkdir(folder,{recursive:true});
let map={};try{map=JSON.parse(await readFile(path.join(folder,"pilot-map.json"),"utf8"));}catch{}
let progress={},previous=[];
try{progress=JSON.parse(await readFile(path.join(folder,"pilot-progress.json"),"utf8"));}catch{}
try{previous=JSON.parse(await readFile(path.join(folder,"import-report.json"),"utf8")).results;}catch{}
const checkpoint=()=>writeFile(path.join(folder,"pilot-progress.json"),JSON.stringify(progress,null,2));
const results=[];
for(const entry of manifest.articles){
 const bytes=await readFile(entry.html_path),hash=createHash("sha256").update(bytes).digest("hex");if(hash!==entry.html_analysis.sha256)throw new Error("Hash do original divergente.");
 const pdfHash=createHash("sha256").update(await readFile(entry.pdf_path)).digest("hex");if(pdfHash!==entry.pdf_sha256)throw new Error("Hash do PDF divergente.");
 if(map[hash]){results.push(previous.find(r=>r.articleId===map[hash])||{source:entry.html_analysis.file,articleId:map[hash],status:"already-imported"});continue;}
 const converted=await api("/api/kb/import",{html:bytes.toString("utf8")});
 const slug=`piloto-${hash.slice(0,12)}`;
 let articleId=progress[hash]?.articleId;
 if(!articleId){
  for(let page=1;page<=10000;page++){
   const list=await api(`/api/kb?editorial=1&pagina=${page}`);articleId=list.articles.find(a=>a.slug===slug)?.id;
   if(articleId||list.articles.length<=20)break;
  }
 }
 const created=articleId?{id:articleId}:await api("/api/kb",{action:"create",document:converted.document,slug});
 progress[hash]??={};progress[hash].articleId=created.id;await checkpoint();
 await api("/api/kb/import",{html:bytes.toString("utf8"),articleId:created.id});
 const mediaMap=new Map(Object.entries(progress[hash].media||{})),pending=[];
 for(const media of converted.media){
  if(mediaMap.has(media.id))continue;
  try{
   const u=new URL(media.source);if(u.origin!=="https://bc.demaria.com.br"||!u.pathname.startsWith("/wp-content/uploads/"))throw new Error("Host fora da allowlist.");
   const response=await fetch(u,{redirect:"error",signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);
   const chunks=[];let total=0;for await(const chunk of response.body){total+=chunk.length;if(total>5242880)throw new Error("Acima de 5MB.");chunks.push(chunk);}
   const imageBytes=Buffer.concat(chunks);const form=new FormData();form.set("articleId",created.id);form.set("file",new Blob([imageBytes]),path.basename(u.pathname));
   const stored=await api("/api/kb/media",form);mediaMap.set(media.id,stored.id);progress[hash].media=Object.fromEntries(mediaMap);await checkpoint();
  }catch(e){pending.push({source:media.source,error:e.message});}
 }
 const walk=n=>{if(n.type==="image"&&mediaMap.has(n.attrs.mediaId))n.attrs.mediaId=mediaMap.get(n.attrs.mediaId);n.content?.forEach(walk);};converted.document.sections.forEach(s=>walk(s.content));
 const current=await api(`/api/kb/articles/${created.id}`);
 await api("/api/kb",{action:"save",articleId:created.id,expectedVersion:current.version,document:converted.document,visibility:"private"});
 map[hash]=created.id;await writeFile(path.join(folder,"pilot-map.json"),JSON.stringify(map,null,2));
 results.push({source:entry.html_analysis.file,sourceHash:hash,pdfHash,articleId:created.id,visibility:"private",status:"draft",mediaUploaded:mediaMap.size,mediaPending:pending,normalizations:converted.report});
 console.log(`${entry.html_analysis.file}: rascunho privado, ${mediaMap.size} mídias, ${pending.length} pendências`);
}
await writeFile(path.join(folder,"import-report.json"),JSON.stringify({date:new Date().toISOString(),results},null,2));
console.log("Relatório privado: .kb-pilot/import-report.json");
