import { z } from "zod";
import { normalize } from "../utils";
import type { Course } from "../model";

export const KNOWLEDGE_PAGE_SIZE = 20;
export const knowledgeSourceSchema = z.enum(["forum", "official", "assistants", "notes", "materials"]);
export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;
export type KnowledgeFilter = KnowledgeSource | "all";
export const knowledgeLabels: Record<KnowledgeSource, string> = {
  forum: "Fórum", official: "Base oficial", assistants: "Assistentes", notes: "Minhas anotações", materials: "Materiais",
};
export const knowledgeHitSchema = z.object({
  id: z.string().min(1), source: knowledgeSourceSchema, title: z.string().min(1),
  excerpt: z.string(), snippetKind: z.enum(["excerpt", "summary", "metadata", "note"]),
  product: z.string().optional(), href: z.string().min(1), external: z.boolean().optional(),
}).strict();
export const knowledgePageSchema = z.object({
  results: z.array(knowledgeHitSchema), total: z.number().int().nonnegative().nullable(),
  page: z.number().int().min(1), hasMore: z.boolean(),
}).strict();
export type KnowledgeHit = z.infer<typeof knowledgeHitSchema>;
export type KnowledgePage = z.infer<typeof knowledgePageSchema>;

export function knowledgePageNumber(value: unknown): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}
export function knowledgeSources(audience?: "internal" | "client"): KnowledgeSource[] {
  return audience === "client" ? ["official", "assistants", "notes"] : ["forum", "official", "assistants", "notes", "materials"];
}
export function knowledgeFilter(value: unknown, audience?: "internal" | "client"): KnowledgeFilter {
  const parsed = knowledgeSourceSchema.safeParse(value);
  return parsed.success && knowledgeSources(audience).includes(parsed.data) ? parsed.data : "all";
}

export function plainSearchText(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
export function searchExcerpt(text: string, term: string, limit = 220): string {
  const plain = plainSearchText(text);
  const position = normalize(plain).indexOf(normalize(term.trim()));
  const start = position < 0 ? 0 : Math.max(0, position - 65);
  return `${start ? "…" : ""}${plain.slice(start, start + limit)}${plain.length > start + limit ? "…" : ""}`;
}
export function highlightedParts(text: string, term: string): { text: string; matched: boolean }[] {
  const query = normalize(term.trim());
  if (!query) return [{ text, matched: false }];
  // Map normalized characters back to original code-unit offsets, including decomposed accents.
  let normalized = "";
  const starts: number[] = [], ends: number[] = [];
  let offset = 0;
  for (const character of text) {
    const next = offset + character.length;
    const value = normalize(character);
    if (!value && ends.length) ends[ends.length - 1] = next;
    for (let index = 0; index < value.length; index++) { normalized += value[index]; starts.push(offset); ends.push(next); }
    offset = next;
  }
  const result: { text: string; matched: boolean }[] = [];
  let cursor = 0, from = 0;
  for (;;) {
    const index = normalized.indexOf(query, from);
    if (index < 0) break;
    const start = starts[index], end = ends[index + query.length - 1];
    if (start > cursor) result.push({ text: text.slice(cursor, start), matched: false });
    result.push({ text: text.slice(start, end), matched: true });
    cursor = end; from = index + query.length;
  }
  if (cursor < text.length) result.push({ text: text.slice(cursor), matched: false });
  return result.length ? result : [{ text, matched: false }];
}
export function paginateKnowledge(results: KnowledgeHit[], page = 1): KnowledgePage {
  page = knowledgePageNumber(page);
  const start = (page - 1) * KNOWLEDGE_PAGE_SIZE;
  return { results: results.slice(start, start + KNOWLEDGE_PAGE_SIZE), page, total: results.length, hasMore: start + KNOWLEDGE_PAGE_SIZE < results.length };
}
export function searchOwnNotes(courses: readonly Course[], notes: Record<string, Record<string, string>>, term: string, page = 1): KnowledgePage {
  const query = normalize(term.trim());
  if (query.length < 2) return paginateKnowledge([], page);
  const results: KnowledgeHit[] = courses.filter(course => course.status === "published").flatMap(course => course.lessons.flatMap(lesson => {
    const note = notes[course.id]?.[lesson.id];
    if (typeof note !== "string" || !note.trim() || !normalize(`${course.title} ${lesson.title} ${note}`).includes(query)) return [];
    return [{ id: JSON.stringify([course.id, lesson.id]), source: "notes" as const, title: lesson.title,
      excerpt: searchExcerpt(note, term), snippetKind: "note" as const, product: course.title,
      href: `/aprender/${encodeURIComponent(course.id)}/aula?aula=${encodeURIComponent(lesson.id)}` }];
  }));
  return paginateKnowledge(results, page);
}
