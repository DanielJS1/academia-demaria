import { createHash,randomUUID } from "node:crypto";
import { mkdir,readFile,writeFile,unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { database } from "../pilot-server";
import { ApiError } from "../api-error";
import { asLocal } from "./local-db";
import { editorialDetail,type KbContext } from "./server";
export interface MediaStorage { put(key:string,bytes:Buffer,mime:string):Promise<void>; read(key:string):Promise<Buffer>; remove(key:string):Promise<void>; }
function storage(ctx:KbContext):MediaStorage{
 if(ctx.local){const root=path.resolve(".kb-pilot/media"); const file=(key:string)=>{if(!/^[a-f0-9-]+\/[a-f0-9-]+$/.test(key))throw new Error("Chave inválida.");return path.join(root,key);}; return {put:async(key,bytes)=>{const f=file(key);await mkdir(path.dirname(f),{recursive:true});await writeFile(f,bytes,{flag:"wx"});},read:key=>readFile(file(key)),remove:key=>unlink(file(key))};}
 const db=database();return {put:async(key,bytes,mime)=>{const r=await db.storage.from("academy-kb").upload(key,bytes,{contentType:mime,upsert:false});if(r.error)throw new Error(r.error.message);},read:async key=>{const r=await db.storage.from("academy-kb").createSignedUrl(key,60);if(r.error)throw new Error(r.error.message);const response=await fetch(r.data.signedUrl,{cache:"no-store"});if(!response.ok)throw new ApiError("Mídia indisponível.",404);return Buffer.from(await response.arrayBuffer());},remove:async key=>{const r=await db.storage.from("academy-kb").remove([key]);if(r.error)throw new Error(r.error.message);}};
}
export async function upload(ctx:KbContext,articleId:string,file:File){
 z.string().uuid().parse(articleId);await editorialDetail(ctx,articleId);
 if(file.size>5*1024*1024||file.size===0)throw new ApiError("Envie uma imagem de até 5 MB.",413);
 const bytes=Buffer.from(await file.arrayBuffer());const info=await sharp(bytes,{limitInputPixels:40000000}).metadata().catch(()=>{throw new ApiError("Arquivo de imagem inválido.");});
 const mime=({png:"image/png",jpeg:"image/jpeg",webp:"image/webp"} as Record<string,string>)[info.format||""];
 if(!mime||!info.width||!info.height||info.pages&&info.pages>1)throw new ApiError("Use PNG, JPEG ou WebP estático.");
 const id=randomUUID(),key=`${articleId}/${id}`,checksum=createHash("sha256").update(bytes).digest("hex"),name=file.name.slice(0,200);
 await storage(ctx).put(key,bytes,mime);
 try{
  if(ctx.local)await ctx.db.query("insert into kb_media(id,article_id,owner_id,provider,storage_key,name,mime,bytes,width,height,checksum,ready) values($1,$2,$3,'local',$4,$5,$6,$7,$8,$9,$10,true)",[id,articleId,ctx.actor,key,name,mime,bytes.length,info.width,info.height,checksum]);
  else {const r=await database().from("kb_media").insert({id,article_id:articleId,owner_id:ctx.actor,provider:"supabase",storage_key:key,name,mime,bytes:bytes.length,width:info.width,height:info.height,checksum,ready:true});if(r.error)throw new Error(r.error.message);}
 }catch(e){await storage(ctx).remove(key);throw e;}
 return {id,name,mime,bytes:bytes.length,width:info.width,height:info.height};
}
export async function readMedia(ctx:KbContext,id:string){
 z.string().uuid().parse(id);
 const row=ctx.local?await asLocal(ctx.db,ctx.actor,async tx=>(await tx.query<{storage_key:string;provider:string;mime:string}>("select * from kb_media_access($1)",[id])).rows[0]):await (async()=>{const r=await ctx.client.rpc("kb_media_access",{mid:id});if(r.error)throw new Error(r.error.message);return r.data?.[0] as {storage_key:string;provider:string;mime:string}|undefined;})();
 if(!row)throw new ApiError("Mídia não encontrada.",404);
 return {bytes:await storage(ctx).read(row.storage_key),mime:row.mime};
}
export async function listMedia(ctx:KbContext,articleId:string){
 await editorialDetail(ctx,articleId);
 if(ctx.local)return asLocal(ctx.db,ctx.actor,async tx=>(await tx.query("select m.id,m.name,m.mime,m.bytes,m.width,m.height,(select count(*)::int from kb_revision_media rm where rm.media_id=m.id) as uses,coalesce((select array_agg(rm.revision_id::text) from kb_revision_media rm where rm.media_id=m.id),array[]::text[]) as revision_ids from kb_media m where article_id=$1 order by created_at desc limit 200",[articleId])).rows);
 const r=await ctx.client.from("kb_media").select("id,name,mime,bytes,width,height,kb_revision_media(revision_id)").eq("article_id",articleId).order("created_at",{ascending:false}).limit(200);if(r.error)throw new Error(r.error.message);return r.data.map(m=>({...m,uses:m.kb_revision_media?.length||0,revision_ids:m.kb_revision_media?.map(r=>r.revision_id)||[],kb_revision_media:undefined}));
}
export async function deleteMedia(ctx:KbContext,id:string){
 z.string().uuid().parse(id);
 const key=ctx.local?await asLocal(ctx.db,ctx.actor,async tx=>(await tx.query<{key:string}>("select kb_delete_media($1) as key",[id])).rows[0].key):await(async()=>{const r=await ctx.client.rpc("kb_delete_media",{mid:id});if(r.error)throw new Error(r.error.message);return r.data as string;})();
 // Metadata revocation is atomic; a storage failure leaves a private orphan for maintenance.
 await storage(ctx).remove(key);
}
