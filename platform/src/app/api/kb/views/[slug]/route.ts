import { createHmac,randomUUID,timingSafeEqual } from "node:crypto";
import { context,fail,publication,privateHeaders } from "@/lib/kb/server";
import { database } from "@/lib/pilot-server";
import { ApiError } from "@/lib/api-error";
const localSecret=randomUUID();
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){try{
 const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)throw new ApiError("Origem inválida.",403);
 const ctx=await context(request),slug=(await params).slug;
 if(!await publication(ctx,slug))throw new ApiError("Artigo não encontrado.",404);
 const secret=ctx.local?localSecret:process.env.SUPABASE_SERVICE_ROLE_KEY;if(!secret)throw new ApiError("Contagem indisponível.",503);
 const sign=(v:string)=>createHmac("sha256",secret).update(v).digest("hex");
 const cookie=request.headers.get("cookie")?.match(/(?:^|;\s*)kb-visitor=([a-f0-9-]+)\.([a-f0-9]{64})/);
 const valid=!!cookie&&timingSafeEqual(Buffer.from(sign(cookie[1])),Buffer.from(cookie[2]));
 const visitor=valid?cookie![1]:randomUUID();const hash=sign(ctx.actor?`user:${ctx.actor}`:`browser:${visitor}`);
 let data:unknown;
 if(ctx.local)data=(await ctx.db.query<{result:unknown}>("select kb_record_view($1,$2) as result",[slug,hash])).rows[0].result;
 else {const result=await database().rpc("kb_record_view",{slug,visitor_hash:hash});if(result.error)throw new ApiError("Contagem indisponível.",503);data=result.data;}
 const headers=new Headers(privateHeaders);if(!valid)headers.set("Set-Cookie",`kb-visitor=${visitor}.${sign(visitor)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(request.url).protocol==="https:"?"; Secure":""}`);
 return Response.json(data,{headers});
 }catch(e){return fail(e);}}
