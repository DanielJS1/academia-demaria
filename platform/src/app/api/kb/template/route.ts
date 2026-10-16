import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { context, fail, mutate, privateHeaders } from "@/lib/kb/server";
import { limitedJson } from "@/lib/kb/request";
import { upload } from "@/lib/kb/media-server";
import { institutionalTemplate } from "@/lib/kb/institutional-template";
import { newDocument } from "@/lib/kb/document";

export const runtime="nodejs";
export async function POST(request:Request){try{
 const ctx=await context(request,true);
 const input=z.object({templateId:z.enum(["procedimento","novidade","atualizacao"])}).strict().parse(await limitedJson(request));
 const base=newDocument(input.templateId);
 const id=await mutate(ctx,{action:"create",document:institutionalTemplate(base)});
 const bytes=await readFile(path.resolve("public/demaria-logo.png"));
 const media=await upload(ctx,id,new File([new Uint8Array(bytes)],"Logo DeMaria.png",{type:"image/png"}));
 const document=institutionalTemplate(base,media.id);
 await mutate(ctx,{action:"save",articleId:id,expectedVersion:1,document,visibility:"private"});
 return Response.json({id,document},{headers:privateHeaders});
}catch(error){return fail(error);}}
