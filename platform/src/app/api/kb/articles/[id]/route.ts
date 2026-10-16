import { context, editorialDetail, fail, privateHeaders } from "@/lib/kb/server";
export async function GET(request: Request,{params}:{params:Promise<{id:string}>}) {try{return Response.json(await editorialDetail(await context(request,true),(await params).id),{headers:privateHeaders});}catch(error){return fail(error);}}
