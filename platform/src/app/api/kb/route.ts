import { context, editorialList, fail, mutate, privateHeaders, publicSearch } from "@/lib/kb/server";
export const runtime = "nodejs";
export async function GET(request: Request) { try {
  const params=new URL(request.url).searchParams;
  if(params.get("editorial")==="1") { const ctx=await context(request,true); const page=Math.max(1,Math.min(10000,Math.floor(Number(params.get("pagina")))||1)); const filter=params.get("filter")||"all";if(!["mine","all","draft","review","changes","published","archived","deleted"].includes(filter))throw new Error("Filtro inválido."); return Response.json({ ...await editorialList(ctx,page,filter,(params.get("q")||"").slice(0,200)), me: ctx.me },{headers:privateHeaders}); }
  return Response.json({ results: await publicSearch(await context(request),params) },{headers:privateHeaders});
} catch(error) {return fail(error);} }
export async function POST(request: Request) { try { const ctx=await context(request,true); const { limitedJson }=await import("@/lib/kb/request"); const id=await mutate(ctx,await limitedJson(request));return Response.json({id},{headers:privateHeaders});}catch(error){return fail(error);} }
