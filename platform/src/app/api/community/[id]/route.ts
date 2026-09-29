import { ApiError, authenticate } from "@/lib/pilot-server";
import { readCommunityArticle } from "@/lib/community-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "no-store, private" };
  try {
    const { db, me } = await authenticate(request);
    const { id } = await context.params;
    if (!id || id.length > 100) throw new ApiError("Artigo inválido.");
    const params=new URL(request.url).searchParams;
    const proposalId=params.get("proposal") || undefined;
    if(proposalId && !/^[0-9a-f-]{36}$/i.test(proposalId))throw new ApiError("Proposta inválida.");
    return Response.json(await readCommunityArticle(db, me, id, params.get("draft") === "1", proposalId), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof ApiError ? error.message : "Não foi possível consultar o artigo." }, { status: error instanceof ApiError ? error.status : 500, headers });
  }
}
