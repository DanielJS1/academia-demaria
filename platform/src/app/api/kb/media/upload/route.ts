import {z} from "zod";
import {context,fail,privateHeaders} from "@/lib/kb/server";
import {prepareDirectUpload,completeDirectUpload} from "@/lib/kb/media-server";
export async function POST(request:Request){try{
 const ctx=await context(request,true),input=await request.json();
 const result=input.action==="complete"
  ? await completeDirectUpload(ctx,z.strictObject({action:z.literal("complete"),ticket:z.string().max(2000)}).parse(input).ticket)
  : await prepareDirectUpload(ctx,input);
 return Response.json(result,{headers:privateHeaders});
}catch(error){return fail(error);}}
