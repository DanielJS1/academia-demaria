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
    return Response.json(await readCommunityArticle(db, me, id, new URL(request.url).searchParams.get("draft") === "1"), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof ApiError ? error.message : "Não foi possível consultar o artigo." }, { status: error instanceof ApiError ? error.status : 500, headers });
  }
}
