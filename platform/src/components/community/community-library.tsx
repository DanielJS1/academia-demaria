"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, FileText, Flame, Heart, MessageCircle, Plus, Search } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { EmptyState } from "../shared";
import { normalize } from "@/lib/utils";
import { articleDate } from "./article-client";
import { CommunityXpRules } from "./article-content";

export function CommunityLibrary({ search, clearSearch }: { search: string; clearSearch: () => void }) {
  const { state, me } = useAcademy();
  const [scope, setScope] = useState("all");
  const [sort, setSort] = useState("recent");
  const drafts = state.articleDrafts.filter(article => article.authorId === me.id || (!article.authorId && me.role === "admin"));
  const published = state.articles.filter(article => article.status === "published");
  const mine = published.filter(article => article.authorId === me.id && !drafts.some(draft => draft.id === article.id));
  const source = scope === "mine" ? [...drafts, ...mine] : published;
  const q = normalize(search);
  const articles = source.filter(article => normalize(`${article.title} ${article.summary || article.content} ${article.product} ${article.category} ${article.author}`).includes(q)).sort((a, b) => sort === "popular" ? ((b.likeCount || 0) + (b.hypeCount || 0) * 2) - ((a.likeCount || 0) + (a.hypeCount || 0) * 2) : b.updatedAt.localeCompare(a.updatedAt));
  const awaiting = published.filter(article => article.authorId === me.id && article.updateRequest).length;

  return <section className="community-library" aria-label="Biblioteca colaborativa">
    <div className="community-library-heading"><div><span className="eyebrow">FEITO PELA NOSSA EQUIPE</span><h2>Uma descoberta sua pode ajudar muita gente.</h2><p>Passo a passo, boas práticas e soluções de quem vive o dia a dia.</p></div>{me.audience !== "client" && <Button asChild><Link href="/conhecimento/novo"><Plus size={17} /> Criar artigo</Link></Button>}</div>
    {awaiting > 0 && <div className="notice-bar"><span>{awaiting} {awaiting === 1 ? "artigo seu precisa" : "artigos seus precisam"} de atualização.</span><Button variant="ghost" size="sm" onClick={() => setScope("mine")}>Ver meus artigos</Button></div>}
    <div className="community-filters"><div className="tabs"><button type="button" className={scope === "all" ? "selected" : ""} aria-pressed={scope === "all"} onClick={() => setScope("all")}>Toda a biblioteca ({published.length})</button><button type="button" className={scope === "mine" ? "selected" : ""} aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>Meus artigos e rascunhos ({drafts.length + mine.length})</button></div><label className="community-sort">Ordenar<select value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Mais recentes</option><option value="popular">Mais reconhecidos</option></select></label></div>
    {search && <p className="community-result-count" role="status">{articles.length} resultados para “{search}”</p>}
    {articles.length ? <div className="article-grid">{articles.map(article => <Link href={article.status === "draft" ? `/conhecimento/${article.id}/editar` : `/conhecimento/${article.id}`} key={article.id} className="article-card panel community-card">
      <div className="community-card-top"><span className="article-icon"><FileText size={22} /></span><span className="pill">{article.category}</span></div>
      {article.status === "draft" && <span className="community-status">Rascunho privado</span>}{article.updateRequest && <span className="community-status">Atualização solicitada</span>}
      <h3>{article.title}</h3><p>{article.summary || article.content || "Continue o seu rascunho."}</p><div className="community-card-author">{article.author} · {article.product}</div>
      <div className="community-card-stats"><span><Heart size={14} aria-hidden="true" /> {article.likeCount || 0}<span className="sr-only"> curtidas</span></span><span><Flame size={14} aria-hidden="true" /> {article.hypeCount || 0}<span className="sr-only"> hypes</span></span><span><MessageCircle size={14} aria-hidden="true" /> {article.commentCount || 0}<span className="sr-only"> comentários</span></span></div>
      <div className="article-footer"><span>Atualizado em {articleDate(article.updatedAt)}</span><ArrowRight size={16} /></div>
    </Link>)}</div> : <EmptyState icon={<Search size={28} />} title={scope === "mine" ? "Seu próximo aprendizado pode virar um artigo" : "Nenhum artigo encontrado"} description={search ? "Experimente outro termo ou limpe a busca." : "Compartilhe uma solução útil e construa a biblioteca com a equipe."}>{search ? <Button variant="secondary" onClick={clearSearch}>Limpar busca</Button> : <Button asChild><Link href="/conhecimento/novo"><Plus size={16} /> Criar primeiro artigo</Link></Button>}</EmptyState>}
    <CommunityXpRules />
  </section>;
}
