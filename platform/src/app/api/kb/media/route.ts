import { context,fail,privateHeaders } from "@/lib/kb/server";
import { listMedia,upload } from "@/lib/kb/media-server";
export async function GET(request:Request){try{return Response.json({media:await listMedia(await context(request,true),new URL(request.url).searchParams.get("articleId")||"")},{headers:privateHeaders});}catch(error){return fail(error);}}
export async function POST(request:Request){try{
 const ctx=await context(request,true);const reader=request.body?.getReader();if(!reader)throw new Error("Envie uma imagem.");let total=0;const chunks:Uint8Array[]=[];
 while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>5300000){await reader.cancel();throw new Error("Imagem muito grande.");}chunks.push(value);}
 const form=await new Response(Buffer.concat(chunks),{headers:{"Content-Type":request.headers.get("content-type")||""}}).formData();const file=form.get("file");if(!(file instanceof File))throw new Error("Envie uma imagem.");
 return Response.json(await upload(ctx,String(form.get("articleId")),file),{headers:privateHeaders});
}catch(error){return fail(error);}}
