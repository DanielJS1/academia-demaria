import { context,fail,privateHeaders } from "@/lib/kb/server";
import { readMedia,deleteMedia } from "@/lib/kb/media-server";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const m=await readMedia(await context(request),(await params).id);return new Response(new Uint8Array(m.bytes),{headers:{...privateHeaders,"Content-Type":m.mime,"X-Content-Type-Options":"nosniff"}});}catch(error){return fail(error);}}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){try{await deleteMedia(await context(request,true),(await params).id);return Response.json({ok:true},{headers:privateHeaders});}catch(error){return fail(error);}}
