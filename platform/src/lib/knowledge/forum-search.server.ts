import type { database } from "../pilot-server";
import { normalize } from "../utils";
import { paginateKnowledge, searchExcerpt, type KnowledgeHit } from "./search";

export async function searchPublishedForum(db: ReturnType<typeof database>, query: string, page = 1) {
  const results: KnowledgeHit[] = [];
  const term = normalize(query.trim());
  if (term.trim().length < 2) return paginateKnowledge([], page);
  // Read a bounded body batch at a time; never include article bodies in the response.
  for (let offset = 0; ; offset += 200) {
    const metadata = await db.from("academy_community_articles").select("article_id").is("deleted_at", null).order("article_id").range(offset, offset + 199);
    if (metadata.error) throw new Error("Busca do fórum indisponível.");
    const ids = (metadata.data ?? []).map(row => row.article_id);
    if (ids.length) {
      const resources = await db.from("academy_resources").select("id,published").eq("kind", "article").in("id", ids).not("published", "is", null);
      if (resources.error) throw new Error("Busca do fórum indisponível.");
      for (const row of resources.data ?? []) {
        const article = row.published as { title?: string; content?: string; summary?: string; product?: string; category?: string; tags?: string[]; status?: string };
        if (!article?.title || (article.status && article.status !== "published") || !normalize(`${article.title} ${article.content ?? ""} ${article.product ?? ""} ${article.category ?? ""} ${(article.tags ?? []).join(" ")}`).includes(term)) continue;
        const bodyMatch = normalize(article.content ?? "").includes(term);
        results.push({ id: row.id, source: "forum", title: article.title, product: article.product ?? "",
          excerpt: searchExcerpt(bodyMatch ? article.content ?? "" : article.summary ?? article.content ?? "", query),
          snippetKind: bodyMatch ? "excerpt" : "summary", href: `/conhecimento/${encodeURIComponent(row.id)}` });
      }
    }
    if (ids.length < 200) break;
  }
  return paginateKnowledge(results.sort((a, b) => a.title.localeCompare(b.title, "pt-BR") || a.id.localeCompare(b.id)), page);
}
