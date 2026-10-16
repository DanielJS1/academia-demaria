import { authenticate, ApiError } from "@/lib/pilot-server";
import { searchPublishedForum } from "@/lib/knowledge/forum-search.server";
import { knowledgePageNumber } from "@/lib/knowledge/search";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    if (me.audience === "client") throw new ApiError("A biblioteca é exclusiva dos colaboradores.", 403);
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120) || "";
    const page = knowledgePageNumber(new URL(request.url).searchParams.get("pagina"));
    return Response.json(await searchPublishedForum(db, query, page), { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    return Response.json({ error: error instanceof ApiError ? error.message : "Busca indisponível." }, { status: error instanceof ApiError ? error.status : 503, headers: { "Cache-Control": "no-store, private" } });
  }
}
