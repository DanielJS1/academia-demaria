import { context, fail, privateHeaders, publication } from "@/lib/kb/server";
import { ApiError } from "@/lib/api-error";
export async function GET(request: Request,{params}:{params:Promise<{slug:string}>}) {try{const article=await publication(await context(request),(await params).slug);if(!article)throw new ApiError("Artigo não encontrado.",404);return Response.json(article,{headers:privateHeaders});}catch(error){return fail(error);}}
