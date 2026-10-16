import {previewContext,previewMediaAllowed} from "@/lib/kb/pilot-preview";
import {readMedia} from "@/lib/kb/media-server";
import {fail,privateHeaders} from "@/lib/kb/server";
import {localRequest} from "@/lib/kb/local-db";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!localRequest(request))return new Response(null,{status:404,headers:privateHeaders});
 try{const {id}=await params;if(!await previewMediaAllowed(request,id))return new Response(null,{status:404,headers:privateHeaders});const media=await readMedia(await previewContext(request),id);return new Response(new Uint8Array(media.bytes),{headers:{...privateHeaders,"Content-Type":media.mime,"X-Content-Type-Options":"nosniff"}});}catch(error){return fail(error);}
}
