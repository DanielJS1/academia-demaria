import { authenticate, ApiError } from "@/lib/pilot-server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    if (me.audience === "client") throw new ApiError("A biblioteca é exclusiva dos colaboradores.", 403);
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120) || "";
    if (query.length < 2) return Response.json({ results: [] });
    const ids: string[] = [];
    for (let offset = 0;; offset += 500) {
      const { data, error } = await db.from("academy_community_articles").select("article_id").is("deleted_at", null).order("article_id").range(offset, offset + 499);
      if (error) throw new ApiError("Busca indisponível.", 503);
      ids.push(...(data || []).map(row => row.article_id));
      if ((data || []).length < 500) break;
    }
    if (!ids.length) return Response.json({ results: [] });
    const articles: { id: string; published: unknown }[] = [];
    for (let index = 0; index < ids.length; index += 200) {
      const { data, error } = await db.from("academy_resources").select("id,published").eq("kind", "article").in("id", ids.slice(index, index + 200)).not("published", "is", null);
      if (error) throw new ApiError("Busca indisponível.", 503);
      articles.push(...(data || []));
    }
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const term = normalize(query);
    const results = articles.filter(row => {
      const article = row.published as { title?: string; content?: string; product?: string; category?: string; tags?: string[] } | null;
      return article && normalize(`${article.title || ""} ${article.content || ""} ${article.product || ""} ${article.category || ""} ${(article.tags || []).join(" ")}`).includes(term);
    }).map(row => ({ id: row.id, title: (row.published as { title: string }).title, detail: (row.published as { category?: string }).category || "Biblioteca", href: `/conhecimento/${encodeURIComponent(row.id)}` }));
    return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof ApiError ? error.message : "Busca indisponível." }, { status: error instanceof ApiError ? error.status : 500 });
  }
}
