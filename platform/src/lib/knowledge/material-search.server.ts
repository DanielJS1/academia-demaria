import type { database } from "../pilot-server";
import { normalize } from "../utils";
import { paginateKnowledge, searchExcerpt, type KnowledgeHit } from "./search";

export async function searchMaterialMetadata(db: ReturnType<typeof database>, query: string, page = 1) {
  const results: KnowledgeHit[] = [];
  const term = normalize(query.trim());
  if (term.length < 2) return paginateKnowledge([], page);
  for (let offset = 0; ; offset += 500) {
    const response = await db.from("academy_technical_materials").select("id,title,description,topic,kind").order("id").range(offset, offset + 499);
    if (response.error) throw new Error("Busca de materiais indisponível.");
    for (const item of response.data ?? []) {
      if (!normalize(`${item.title} ${item.description} ${item.topic}`).includes(term)) continue;
      results.push({ id: item.id, source: "materials", title: item.title, product: item.topic,
        excerpt: searchExcerpt(item.description, query), snippetKind: "metadata",
        href: `/conhecimento?aba=materiais&material=${encodeURIComponent(item.id)}` });
    }
    if ((response.data?.length ?? 0) < 500) break;
  }
  return paginateKnowledge(results.sort((a, b) => a.title.localeCompare(b.title, "pt-BR") || a.id.localeCompare(b.id)), page);
}
