"use client";
import { useEffect, useState } from "react";
import { knowledgeFilter, knowledgePageNumber, type KnowledgeFilter } from "@/lib/knowledge/search";

export type KnowledgeArea = "biblioteca" | "consulta" | "anotacoes" | "materiais";
export const tabNames = { biblioteca: "Biblioteca", consulta: "Consulta assistida", anotacoes: "Anotações", materiais: "Materiais técnicos" } as const;
type Tab = typeof tabNames[KnowledgeArea];
type Navigation = { area: KnowledgeArea; search: string; source: KnowledgeFilter; page: number; materialId?: string };

function normalizedNavigation(area: string | undefined, search: string, source: string | undefined, page: unknown, materialId: string | undefined, audience?: "internal" | "client"): Navigation {
  const filter = knowledgeFilter(source, audience);
  return {
    area: area === "anotacoes" || area === "consulta" || (area === "materiais" && audience !== "client") ? area : audience === "client" ? "consulta" : "biblioteca",
    search: search.slice(0, 120), source: filter, page: filter !== "all" ? knowledgePageNumber(page) : 1,
    materialId: audience !== "client" && materialId && /^[a-f0-9-]{36}$/i.test(materialId) ? materialId : undefined,
  };
}
function writeNavigation(next: Navigation, push: boolean) {
  const url = new URL(window.location.href);
  url.searchParams.set("aba", next.area);
  for (const key of ["busca", "tipo", "pagina", "material"]) url.searchParams.delete(key);
  if (next.search.trim()) {
    url.searchParams.set("busca", next.search.trim());
    if (next.source !== "all") url.searchParams.set("tipo", next.source);
    if (next.source !== "all" && next.page > 1) url.searchParams.set("pagina", String(next.page));
  }
  if (next.materialId) url.searchParams.set("material", next.materialId);
  if (url.href !== window.location.href) window.history[push ? "pushState" : "replaceState"](null, "", url);
}

export function useKnowledgeNavigation({ initialTab, initialSearch = "", initialSource, initialPage, initialMaterialId, audience }: {
  initialTab?: KnowledgeArea; initialSearch?: string; initialSource?: string; initialPage?: number; initialMaterialId?: string; audience?: "internal" | "client";
}) {
  const [state, setState] = useState<Navigation>(() => normalizedNavigation(initialTab, initialSearch, initialSource, initialPage, initialMaterialId, audience));
  useEffect(() => {
    setState(normalizedNavigation(initialTab, initialSearch, initialSource, initialPage, initialMaterialId, audience));
    // Incoming RSC props cover route navigation; native history below covers local refinements.
  }, [initialTab, initialSearch, initialSource, initialPage, initialMaterialId, audience]);
  useEffect(() => {
    const timer = setTimeout(() => writeNavigation(state, false), 250);
    return () => clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      setState(normalizedNavigation(params.get("aba") ?? undefined, params.get("busca") ?? "", params.get("tipo") ?? undefined, params.get("pagina"), params.get("material") ?? undefined, audience));
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [audience]);
  const change = (next: Navigation, push = true) => { setState(next); writeNavigation(next, push); };
  return {
    ...state, tab: tabNames[state.area],
    setSearch: (search: string) => setState(current => ({ ...current, search: search.slice(0, 120), page: 1, materialId: undefined })),
    setTab: (tab: Tab) => change({ ...state, area: (Object.keys(tabNames) as KnowledgeArea[]).find(key => tabNames[key] === tab)!, materialId: undefined }),
    setSource: (source: KnowledgeFilter) => change({ ...state, source: knowledgeFilter(source, audience), page: 1 }),
    setPage: (page: number) => change({ ...state, page: knowledgePageNumber(page) }),
    clearSearch: () => change({ ...state, search: "", source: "all", page: 1 }),
  };
}
