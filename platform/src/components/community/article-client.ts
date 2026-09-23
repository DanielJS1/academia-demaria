import { browserAuth } from "@/lib/supabase-browser";
import type { Article } from "@/lib/model";

export type ArticleComment = { id: string; articleId: string; userId: string; author: string; content: string; createdAt: string };
export type ArticleDetailData = { article: Article; comments: ArticleComment[] };

export async function searchArticles(query: string, signal?: AbortSignal): Promise<{ id: string; title: string; detail: string; href: string }[]> {
  const token = (await browserAuth()?.auth.getSession())?.data.session?.access_token;
  if (!token) return [];
  const response = await fetch(`/api/community/search?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal });
  if (!response.ok) return [];
  return (await response.json()).results;
}

export async function fetchArticle(id: string, draft = false, signal?: AbortSignal): Promise<ArticleDetailData> {
  const session = await browserAuth()?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("Entre na sua conta para abrir este artigo.");
  const response = await fetch(`/api/community/${encodeURIComponent(id)}${draft ? "?draft=1" : ""}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível carregar o artigo.");
  return data;
}

export function articleDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : date.toLocaleDateString("pt-BR");
}
