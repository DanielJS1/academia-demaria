import "server-only";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {context,editorialDetail} from "./server";
import {localRequest} from "./local-db";
import {mediaIds,type KbDocument} from "./document";

// Explicit local review of the five supplied originals; never a production bypass.
export async function previewCatalog(request:Request){
 if(!localRequest(request))return [];
 let ids:string[];try{ids=Object.values(JSON.parse(await readFile(path.resolve(".kb-pilot/pilot-map.json"),"utf8")));}catch{return [];}
 const ctx=await previewContext(request);
 const articles=[];
 for(const id of ids){const article=await editorialDetail(ctx,id);articles.push({id:article.id as string,slug:article.slug as string,document:article.document as KbDocument});}
 return articles;
}
export function previewContext(request:Request){
 if(!localRequest(request))throw new Error("Prévia local indisponível.");
 return context(new Request(request.url,{headers:{Cookie:"kb-pilot=11111111-1111-4111-8111-111111111111"}}),true);
}
export async function previewMediaAllowed(request:Request,id:string){
 const articles=await previewCatalog(request);return articles.some(a=>mediaIds(a.document).includes(id));
}
