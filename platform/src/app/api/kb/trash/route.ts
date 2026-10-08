import { z } from "zod";
import { context,fail,privateHeaders } from "@/lib/kb/server";
import { asLocal } from "@/lib/kb/local-db";
import { limitedJson } from "@/lib/kb/request";
export async function POST(request:Request){try{
 const ctx=await context(request,true);
 const input=z.object({articleId:z.string().uuid(),expectedVersion:z.number().int().positive(),restore:z.boolean().default(false)}).strict().parse(await limitedJson(request));
 const result=ctx.local?await asLocal(ctx.db,ctx.actor,async tx=>(await tx.query<{result:unknown}>("select kb_trash_article($1,$2,$3) as result",[input.articleId,input.expectedVersion,input.restore])).rows[0].result):await(async()=>{const r=await ctx.client.rpc("kb_trash_article",{aid:input.articleId,expected_version:input.expectedVersion,restore:input.restore});if(r.error)throw new Error(r.error.message);return r.data;})();
 return Response.json(result,{headers:privateHeaders});
}catch(error){return fail(error);}}
