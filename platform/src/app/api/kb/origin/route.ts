import { z } from "zod";
import { context,editorialDetail,fail,privateHeaders } from "@/lib/kb/server";
import { limitedJson } from "@/lib/kb/request";
import { ApiError } from "@/lib/api-error";
const timestamp=z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
export async function POST(request:Request){try{
 const ctx=await context(request,true);
 if(!ctx.local||process.env.KB_PILOT_NAMESPACE!=="wordpress-100")throw new ApiError("Importação restrita ao lote local.",403);
 const i=z.object({articleId:z.string().uuid(),wpId:z.number().int().positive(),author:z.string().min(1).max(300),created:timestamp,createdGmt:timestamp,modified:timestamp,views:z.number().int().nonnegative().safe().nullable()}).strict().parse(await limitedJson(request));
 const a=await editorialDetail(ctx,i.articleId) as {status:string;owner_id:string;origin_wp_id?:number};
 if(a.status!=="draft"||a.owner_id!==ctx.actor||(a.origin_wp_id&&a.origin_wp_id!==i.wpId))throw new ApiError("Artigo incompatível com este lote.",409);
 await ctx.db.query("update kb_articles set origin_wp_id=$2,origin_author_name=$3,origin_created_at=case when $4='0000-00-00 00:00:00' then $5::timestamp at time zone 'America/Sao_Paulo' else $4::timestamp at time zone 'UTC' end,origin_modified_at=$6::timestamp at time zone 'America/Sao_Paulo',origin_views=$7 where id=$1",[i.articleId,i.wpId,i.author,i.createdGmt,i.created,i.modified,i.views]);
 return Response.json({ok:true},{headers:privateHeaders});
 }catch(e){return fail(e);}}
