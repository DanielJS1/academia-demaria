import { z } from "zod";
import { browserAuth } from "@/lib/supabase-browser";
import { searchArticlePage } from "../community/article-client";
import { knowledgePageSchema, type KnowledgePage } from "@/lib/knowledge/search";

async function sessionFetch(path: string, userId: string, signal: AbortSignal, required = true) {
  const session = (await browserAuth()?.auth.getSession())?.data.session;
  if ((session && session.user.id !== userId) || (required && !session)) throw new Error("Entre novamente para pesquisar.");
  const response = await fetch(path, { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {}, cache: "no-store", signal });
  if (!response.ok) throw new Error("Não foi possível consultar esta fonte. Tente novamente.");
  return response.json();
}

const officialRowSchema = z.object({ slug: z.string().min(1), title: z.string().min(1), summary: z.string(), product: z.string(), total: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional() });

export async function searchOfficial(query: string, page: number, userId: string, signal: AbortSignal): Promise<KnowledgePage> {
  const data = await sessionFetch(`/api/kb?q=${encodeURIComponent(query)}&pagina=${page}`, userId, signal, false);
  const rows = z.array(officialRowSchema).parse(data.results);
  const total = rows[0]?.total === undefined ? page === 1 && !rows.length ? 0 : null : Number(rows[0].total);
  return { results: rows.map(row => ({ id: row.slug, source: "official", title: row.title, excerpt: row.summary, product: row.product,
    snippetKind: "summary", href: `/conhecimento/base/${encodeURIComponent(row.slug)}` })), total, page, hasMore: total === null ? rows.length === 20 : page * 20 < total };
}
export async function searchRemoteKnowledge(source: "forum" | "official" | "materials", query: string, page: number, userId: string, signal: AbortSignal): Promise<KnowledgePage> {
  if (source === "forum") return searchArticlePage(query, page, signal, userId);
  if (source === "official") return searchOfficial(query, page, userId, signal);
  return knowledgePageSchema.parse(await sessionFetch(`/api/technical-materials?q=${encodeURIComponent(query)}&pagina=${page}`, userId, signal));
}
