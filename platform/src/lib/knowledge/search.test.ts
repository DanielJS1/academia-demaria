import { afterEach, describe, expect, it, vi } from "vitest";
import { initialState } from "../seed";
import { highlightedParts, knowledgeFilter, knowledgeSources, paginateKnowledge, searchExcerpt, searchOwnNotes } from "./search";
import { searchPublishedForum } from "./forum-search.server";
import { searchMaterialMetadata } from "./material-search.server";
import { searchAssistants } from "@/components/knowledge/assistants";
import { readUserNotes } from "@/components/lesson-notepad";
import { GET as forumGET } from "@/app/api/community/search/route";
import { GET as materialsGET } from "@/app/api/technical-materials/route";

const auth = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock("../pilot-server", async () => ({ authenticate: auth.authenticate, ApiError: (await import("../api-error")).ApiError }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

function databaseFixture(tables: Record<string, Record<string, unknown>[]>, failing?: string) {
  return { from(table: string) {
    let data = tables[table] ?? [];
    const builder = {
      select: () => builder,
      is: (key: string, value: unknown) => { data = data.filter(row => (row[key] ?? null) === value); return builder; },
      eq: (key: string, value: unknown) => { data = data.filter(row => row[key] === value); return builder; },
      order: () => builder,
      range: (start: number, end: number) => { data = data.slice(start, end + 1); return builder; },
      in: (key: string, ids: string[]) => { data = data.filter(row => ids.includes(row[key] as string)); return builder; },
      not: (key: string) => { data = data.filter(row => row[key] !== null); return builder; },
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data, error: table === failing ? { message: "offline" } : null }).then(resolve),
    };
    return builder;
  } } as unknown as Parameters<typeof searchPublishedForum>[0];
}
const course = { ...initialState.courses[0], id: "course", lessons: [{ ...initialState.courses[0].lessons[0], id: "lesson", title: "Instalação" }] };

describe("federated knowledge adapters", () => {
  it("finds a note by body/lesson/course, never by someone else's browser key", () => {
    const notes = { course: { lesson: "Recuperar DLL com o roteiro particular." } };
    expect(searchOwnNotes([course], notes, "dll").results[0]).toMatchObject({ source: "notes", snippetKind: "note", href: "/aprender/course/aula?aula=lesson" });
    expect(searchOwnNotes([course], notes, "instalacao").total).toBe(1);
    expect(searchOwnNotes([{ ...course, status: "draft" }], notes, "dll").total).toBe(0);
    const storage = new Map([["doc-academy.notes.user-a", JSON.stringify(notes)], ["doc-academy.notes.user-b", JSON.stringify({})]]);
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null });
    expect(searchOwnNotes([course], readUserNotes("user-b"), "dll").total).toBe(0);
    storage.set("doc-academy.notes.user-b", "[]");
    expect(() => readUserNotes("user-b")).toThrow();
  });
  it("supports assistant metadata, explicit client sources, exact pagination and safe text snippets", () => {
    expect(searchAssistants("Pernambuco").results[0].external).toBe(true);
    expect(searchAssistants("comercial").total).toBe(1);
    expect(knowledgeSources("client")).not.toContain("forum");
    expect(knowledgeSources("client")).not.toContain("materials");
    expect(knowledgeFilter("forum", "client")).toBe("all");
    const hits = Array.from({ length: 25 }, (_, i) => ({ id: String(i), source: "forum" as const, title: "Title", excerpt: "", href: "/", snippetKind: "summary" as const }));
    expect(paginateKnowledge(hits, 2)).toMatchObject({ total: 25, page: 2, hasMore: false });
    expect(paginateKnowledge(hits, 2).results).toHaveLength(5);
    expect(searchExcerpt("<p>Texto <b>DLL</b> e orientações.</p>", "dll")).not.toContain("<");
    expect(highlightedParts("instalação e instalac\u0327a\u0303o", "instalacao").filter(part => part.matched).map(part => part.text)).toEqual(["instalação", "instalac\u0327a\u0303o"]);
  });
  it("finds DLL in article body beyond the first database batch, without returning bodies, drafts or tombstones", async () => {
    const metadata = Array.from({ length: 405 }, (_, i) => ({ article_id: `article-${i}`, deleted_at: i === 404 ? "deleted" : null }));
    const resources = metadata.map((item, i) => ({ id: item.article_id, kind: "article", published: i === 403 ? null : { title: `Article ${i}`, content: i >= 201 ? `Procedimento com DLL ${"x".repeat(300)}` : "Outro texto", status: "published" } }));
    const result = await searchPublishedForum(databaseFixture({ academy_community_articles: metadata, academy_resources: resources }), "DLL", 2);
    expect(result.total).toBe(202);
    expect(result.results).toHaveLength(20);
    expect(result.results.every(hit => hit.excerpt.includes("DLL"))).toBe(true);
    expect(JSON.stringify(result)).not.toContain('"content"');
    expect(result.results.every(hit => hit.excerpt.length <= 222)).toBe(true);
  });
  it("finds materials by topic after 1,000 records, without exposing storage paths", async () => {
    const rows = Array.from({ length: 1005 }, (_, i) => ({ id: String(i), title: "Manual", description: "Descrição do procedimento", topic: i === 1004 ? "Selo Digital Maranhão" : "DOC-Windows", kind: "manual", pdf_path: "secret.pdf" }));
    const result = await searchMaterialMetadata(databaseFixture({ academy_technical_materials: rows }), "maranhao");
    expect(result.total).toBe(1);
    expect(result.results[0].href).toContain("material=1004");
    expect(JSON.stringify(result)).not.toContain("secret.pdf");
  });
});

describe("search route authorization and failures", () => {
  it("rejects client access to forum and technical materials before any database call", async () => {
    auth.authenticate.mockResolvedValue({ me: { audience: "client" }, db: { from: () => { throw new Error("Must not query"); } } });
    expect((await forumGET(new Request("http://localhost/api/community/search?q=DLL"))).status).toBe(403);
    expect((await materialsGET(new Request("http://localhost/api/technical-materials?q=DLL"))).status).toBe(403);
  });
  it("returns a source failure instead of a false zero result", async () => {
    auth.authenticate.mockResolvedValue({ me: { audience: "internal" }, db: databaseFixture({}, "academy_community_articles") });
    const response = await forumGET(new Request("http://localhost/api/community/search?q=DLL"));
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("results");
    expect(response.headers.get("cache-control")).toContain("private");
  });
  it("returns a paginated result through the authorized route", async () => {
    auth.authenticate.mockResolvedValue({ me: { audience: "internal" }, db: databaseFixture({ academy_community_articles: [{ article_id: "article", deleted_at: null }], academy_resources: [{ id: "article", kind: "article", published: { title: "Correção", content: "DLL somente no corpo", status: "published" } }] }) });
    const response = await forumGET(new Request("http://localhost/api/community/search?q=DLL&pagina=1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ total: 1, page: 1, results: [{ source: "forum", title: "Correção" }] });
  });
});
