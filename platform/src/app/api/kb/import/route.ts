import { z } from "zod";
import { context, fail, privateHeaders } from "@/lib/kb/server";
import { importHtml } from "@/lib/kb/import-html";
import { validateDocument } from "@/lib/kb/document";
import { limitedJson } from "@/lib/kb/request";
import { createHash } from "node:crypto";
import { database } from "@/lib/pilot-server";
import { editorialDetail } from "@/lib/kb/server";
export async function POST(request:Request){try{const ctx=await context(request,true);const input=z.object({html:z.string().max(1000000),document:z.unknown().optional(),articleId:z.string().uuid().optional()}).strict().parse(await limitedJson(request));const converted=importHtml(input.html,input.document?validateDocument(input.document):undefined);
 if(input.articleId){await editorialDetail(ctx,input.articleId);const hash=createHash("sha256").update(input.html).digest("hex");
  if(ctx.local)await ctx.db.query("insert into kb_imports(source_hash,article_id,original_html,report) values($1,$2,$3,$4) on conflict(source_hash) do nothing",[hash,input.articleId,input.html,JSON.stringify(converted.report)]);
  else {const r=await database().from("kb_imports").upsert({source_hash:hash,article_id:input.articleId,original_html:input.html,report:converted.report},{onConflict:"source_hash",ignoreDuplicates:true});if(r.error)throw new Error(r.error.message);}
 }
 return Response.json(converted,{headers:privateHeaders});}catch(error){return fail(error);}}
