"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { EmptyState } from "../shared";
import { normalize } from "@/lib/utils";
import { CommunityXpRules } from "./article-content";
import { LibraryArticleCard } from "./library-article-card";

export function CommunityLibrary({ search, matchedIds, clearSearch }: { search: string; matchedIds: string[] | null; clearSearch: () => void }) {
  const { state, me } = useAcademy();
  const [scope, setScope] = useState("all");
  const [sort, setSort] = useState("recent");
  const drafts = state.articleDrafts.filter(article => article.authorId === me.id || (!article.authorId && me.role === "admin"));
  const published = state.articles.filter(article => article.status === "published");
  const mine = published.filter(article => article.authorId === me.id && !drafts.some(draft => draft.id === article.id));
  const source = scope === "mine" ? [...drafts, ...mine] : published;
  const q = normalize(search);
  const articles = source.filter(article => !q || (matchedIds ? matchedIds.includes(article.id) : normalize(`${article.title} ${article.summary || article.content} ${article.product} ${article.category} ${article.author} ${(article.tags || []).join(" ")}`).includes(q))).sort((a, b) => sort === "popular" ? ((b.likeCount || 0) + (b.hypeCount || 0) * 2) - ((a.likeCount || 0) + (a.hypeCount || 0) * 2) : b.updatedAt.localeCompare(a.updatedAt));
  const awaiting = published.filter(article => article.authorId === me.id && article.updateRequest).length;

  return <section className="community-library" aria-label="Biblioteca colaborativa">
    <div className="community-library-heading"><div><span className="eyebrow">FEITO PELA NOSSA EQUIPE</span><h2>Uma descoberta sua pode ajudar muita gente.</h2><p>Passo a passo, boas práticas e soluções de quem vive o dia a dia.</p></div>{me.audience !== "client" && <Button asChild><Link href="/conhecimento/novo"><Plus size={17} /> Criar artigo</Link></Button>}</div>
    {awaiting > 0 && <div className="notice-bar"><span>{awaiting} {awaiting === 1 ? "artigo seu precisa" : "artigos seus precisam"} de atualização.</span><Button variant="ghost" size="sm" onClick={() => setScope("mine")}>Ver meus artigos</Button></div>}
    <div className="community-filters"><div className="tabs"><button type="button" className={scope === "all" ? "selected" : ""} aria-pressed={scope === "all"} onClick={() => setScope("all")}>Toda a biblioteca ({published.length})</button><button type="button" className={scope === "mine" ? "selected" : ""} aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>Meus artigos e rascunhos ({drafts.length + mine.length})</button></div><label className="community-sort">Ordenar<select value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Mais recentes</option><option value="popular">Mais reconhecidos</option></select></label></div>
    {search && <p className="community-result-count" role="status">{articles.length} resultados para “{search}”</p>}
    {articles.length ? <div className="article-grid">{articles.map(article => <LibraryArticleCard key={article.id} article={article} />)}</div> : <EmptyState icon={<Search size={28} />} title={scope === "mine" ? "Seu próximo aprendizado pode virar um artigo" : "Nenhum artigo encontrado"} description={search ? "Experimente outro termo ou limpe a busca." : "Compartilhe uma solução útil e construa a biblioteca com a equipe."}>{search ? <Button variant="secondary" onClick={clearSearch}>Limpar busca</Button> : <Button asChild><Link href="/conhecimento/novo"><Plus size={16} /> Criar primeiro artigo</Link></Button>}</EmptyState>}
    <CommunityXpRules />
  </section>;
}
