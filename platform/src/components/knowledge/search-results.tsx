"use client";

import Link from "next/link";
import { useId, useRef } from "react";
import { ExternalLink } from "lucide-react";
import type { Course } from "@/lib/model";
import { highlightedParts, knowledgeLabels, knowledgeSources, type KnowledgeFilter, type KnowledgeHit, type KnowledgeSource } from "@/lib/knowledge/search";
import { Button } from "../ui/button";
import { FieldLegend, FieldSet } from "../ui/field";
import { DataState } from "../layout/data-state";
import { useKnowledgeSource } from "./use-knowledge-source";

const snippetLabels: Record<KnowledgeHit["snippetKind"], string> = { excerpt: "Trecho", summary: "Resumo", metadata: "Descrição", note: "Anotação neste navegador" };
function Highlight({ text, query }: { text: string; query: string }) {
  return <>{highlightedParts(text, query).map((part, index) => part.matched ? <mark key={index}>{part.text}</mark> : part.text)}</>;
}
function SearchResult({ hit, query }: { hit: KnowledgeHit; query: string }) {
  const contents = <><h3><Highlight text={hit.title} query={query} /></h3><span>{hit.external ? "Abrir assistente" : hit.source === "notes" ? "Abrir aula" : hit.source === "materials" ? "Abrir material" : "Abrir artigo"}{hit.external && <ExternalLink size={16} aria-hidden="true" />}</span></>;
  return <li className="knowledge-result-card">
    <p className="knowledge-result-origin">{knowledgeLabels[hit.source]}{hit.product ? ` · ${hit.product}` : ""}</p>
    {hit.external ? <a className="knowledge-result-link" href={hit.href} target="_blank" rel="noopener noreferrer">{contents}<span className="sr-only"> (abre em nova guia)</span></a> : <Link className="knowledge-result-link" href={hit.href}>{contents}</Link>}
    <p className="knowledge-result-excerpt"><span>{snippetLabels[hit.snippetKind]}: </span><Highlight text={hit.excerpt} query={query} /></p>
  </li>;
}

export function KnowledgeSearchResults({ query, source, page, userId, audience, courses, onSource, onPage }: {
  query: string; source: KnowledgeFilter; page: number; userId: string; audience?: "internal" | "client";
  courses: readonly Course[]; onSource: (source: KnowledgeFilter) => void; onPage: (page: number) => void;
}) {
  const prefix = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const focusResults = () => requestAnimationFrame(() => title.current?.focus());
  const allowed = knowledgeSources(audience);
  const options = (kind: KnowledgeSource) => ({ query, page: source === kind ? page : 1, userId, audience, enabled: allowed.includes(kind) });
  const states = {
    forum: useKnowledgeSource("forum", options("forum")), official: useKnowledgeSource("official", options("official")),
    assistants: useKnowledgeSource("assistants", options("assistants")), notes: useKnowledgeSource("notes", { ...options("notes"), courses }),
    materials: useKnowledgeSource("materials", options("materials")),
  };
  const count = allowed.reduce((sum, kind) => sum + (states[kind].data?.total ?? states[kind].data?.results.length ?? 0), 0);
  const partial = allowed.some(kind => !states[kind].data || states[kind].data?.total === null);
  const anyReady = allowed.some(kind => states[kind].data);
  const groups = source === "all" ? allowed : allowed.filter(kind => kind === source);
  return <section className="knowledge-results" aria-labelledby={`${prefix}-title`}>
    <div className="knowledge-results-heading"><h2 ref={title} tabIndex={-1} id={`${prefix}-title`}>Resultados para “{query}”</h2><p role="status">{anyReady ? <>{count}{partial ? "+" : ""} resultados{partial ? " · busca parcial ou em andamento" : ""}</> : "Pesquisando nas fontes de conhecimento…"}</p></div>
    <FieldSet><FieldLegend className="sr-only">Filtrar resultados por fonte</FieldLegend>
      <div className="knowledge-source-options">{(["all", ...allowed] as KnowledgeFilter[]).map(kind => <label key={kind} className="knowledge-source-option">
        <input className="sr-only" type="radio" name={`${prefix}-source`} value={kind} checked={source === kind} onChange={() => onSource(kind)} />
        <span>{kind === "all" ? "Todos" : knowledgeLabels[kind]}{kind !== "all" && <small>{states[kind].data ? ` (${states[kind].data!.total ?? `${states[kind].data!.results.length}+`})` : states[kind].error ? " · indisponível" : "…"}</small>}</span>
      </label>)}</div>
    </FieldSet>
    {groups.map(kind => {
      const state = states[kind];
      const results = source === "all" ? state.data?.results.slice(0, 3) : state.data?.results;
      return <section className="knowledge-result-group" key={kind} aria-label={knowledgeLabels[kind]}>
        <h2>{knowledgeLabels[kind]}</h2>
        {kind === "materials" && <p className="knowledge-source-help">Pesquisa por título, descrição e assunto. O conteúdo dos PDFs e vídeos não é pesquisado.</p>}
        {kind === "notes" && <p className="knowledge-source-help">Anotações privadas salvas neste navegador.</p>}
        {state.loading ? <DataState state="loading" title={`Pesquisando em ${knowledgeLabels[kind].toLowerCase()}…`} /> : state.error ?
          <DataState state="error" description={state.error} onRetry={state.retry} /> : results?.length ? <ul className="knowledge-result-list">{results.map(hit => <SearchResult key={hit.id} hit={hit} query={query} />)}</ul> :
          <p className="knowledge-source-help">{page > 1 && source === kind ? "Nenhum resultado nesta página." : "Nenhum resultado nesta fonte."}</p>}
        {source === "all" && state.data && (state.data.hasMore || state.data.results.length > 3) && <Button type="button" variant="secondary" onClick={() => { onSource(kind); focusResults(); }}>Ver mais em {knowledgeLabels[kind].toLowerCase()}</Button>}
        {source === kind && state.data && (page > 1 || state.data.hasMore) && <nav className="knowledge-pagination" aria-label={`Páginas de ${knowledgeLabels[kind]}`}>
          <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => { onPage(page - 1); focusResults(); }}>Anterior</Button><span>Página {page}</span>
          <Button type="button" variant="secondary" disabled={!state.data.hasMore} onClick={() => { onPage(page + 1); focusResults(); }}>Próxima</Button>
        </nav>}
      </section>;
    })}
  </section>;
}
