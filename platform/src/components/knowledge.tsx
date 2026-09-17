"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Briefcase, Clock3, Download, ExternalLink, FileText, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { Button } from "./ui/button";
import { EmptyState, SectionHeading } from "./shared";
import { normalize } from "@/lib/utils";
import { getAllUserNotes, exportCourseNotesTxt } from "./lesson-notepad";

const salesAssistants = [
  {
    title: "Assistente de Vendas",
    tag: "COMERCIAL",
    description: "Auxílio a consultores e colaboradores para tirar dúvidas sobre produtos e responder clientes",
    href: "https://chatgpt.com/g/g-6848257ecf708191b1934dad5ec8719f-assistente-de-vendas-demaria",
  },
];

const sealAssistants = [
  { uf: "PE", state: "Pernambuco", href: "https://chatgpt.com/g/g-68a91bfa0f3c8191848220e103b92286-selo-digital-de-pe" },
  { uf: "AL", state: "Alagoas", href: "https://chatgpt.com/g/g-68a92b5ed904819187b4881f8efc9366-selo-digital-de-al" },
  { uf: "SP", state: "São Paulo", href: "https://chatgpt.com/g/g-68addbc7209c8191ab9790c3931d9f22-selo-digital-de-sp" },
  { uf: "BA", state: "Bahia", href: "https://chatgpt.com/g/g-68ade97d7b6881919b7bbb268a857440-selo-digital-de-ba" },
  { uf: "PB", state: "Paraíba", href: "https://chatgpt.com/g/g-68af66930f3c81918a284c26b4cdf264-selo-digital-de-pb" },
  { uf: "RJ", state: "Rio de Janeiro", href: "https://chatgpt.com/g/g-68d581cf1d6c81919d7664a561d7f902-selo-digital-de-rj" },
  { uf: "PI", state: "Piauí", href: "https://chatgpt.com/g/g-6931930e09ec8191b9abeae7fd8b99ab-selo-digital-do-pi" },
];

const windowsAssistants = [
  { title: "Procurações e Escrituras", href: "https://chatgpt.com/g/g-68b7aa636fc88191a6b20baf55ad5425-procuracoes-e-escrituras" },
  { title: "Preferências", href: "https://chatgpt.com/g/g-68b85c218248819192b205d84bf879bc-preferencias" },
];

export function Knowledge() {
  const { state, me, notify } = useAcademy();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"Consulta assistida" | "Biblioteca" | "Anotações">("Consulta assistida");
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  const userNotes = getAllUserNotes(me.id);
  const coursesWithNotes = state.courses.filter(c => userNotes[c.id] && Object.values(userNotes[c.id]).some(t => t && t.trim()));

  const q = normalize(search);
  const filteredSales = salesAssistants.filter(a => normalize(`${a.title} ${a.tag} ${a.description}`).includes(q));
  const filteredWindows = windowsAssistants.filter(a => normalize(a.title).includes(q));
  const filteredSeals = sealAssistants.filter(a => normalize(`${a.uf} ${a.state}`).includes(q));
  const hasResults = filteredSales.length > 0 || filteredWindows.length > 0 || filteredSeals.length > 0;

  const published = state.articles.filter(article => article.status === "published");
  const articles = published.filter(article => normalize(`${article.title} ${article.content} ${article.product}`).includes(q));

  return (
    <div className="page-enter">
      <section className="knowledge-hero">
        <span className="knowledge-symbol"><Sparkles size={29}/></span>
        <div className="eyebrow">SABER MAIS, IR ALÉM</div>
        <h1>Todo conhecimento começa<br/>com uma boa pergunta.</h1>
        <p>Consulte nossos assistentes especializados de IA e encontre orientações para o seu dia a dia.</p>
        <div className="field-search knowledge-search">
          <Search size={20}/>
          <input
            aria-label="Pesquisar assistentes e temas"
            placeholder="Busque por assunto, produto ou estado (ex: Vendas, SP, Escrituras)..."
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>
        <div className="knowledge-hints">
          {["Vendas", "DOC-Windows", "São Paulo", "Pernambuco"].map(term => (
            <button key={term} onClick={() => setSearch(term)}>{term}</button>
          ))}
          {search && (
            <button type="button" onClick={() => setSearch("")} style={{ color: "var(--primary)", fontWeight: 600 }}>
              Limpar busca
            </button>
          )}
        </div>
      </section>

      <div className="tabs">
        <button
          type="button"
          className={tab === "Consulta assistida" ? "selected" : ""}
          aria-pressed={tab === "Consulta assistida"}
          onClick={() => setTab("Consulta assistida")}
        >
          <Sparkles size={16}/> Consulta assistida
        </button>
        <button
          type="button"
          className={tab === "Anotações" ? "selected" : ""}
          aria-pressed={tab === "Anotações"}
          onClick={() => setTab("Anotações")}
        >
          <FileText size={16}/> Minhas Anotações ({coursesWithNotes.length})
        </button>
        <button
          type="button"
          className="tab-disabled"
          disabled
          aria-disabled="true"
          title="Biblioteca de materiais em breve"
        >
          <BookOpen size={16}/> Biblioteca <span className="tab-pill-soon">Em breve</span>
        </button>
      </div>

      {tab === "Anotações" ? (
        <section className="notes-directory">
          <SectionHeading
            title="Seu Caderno de Estudos"
            description="Anotações feitas durante as aulas, organizadas por curso com opção de download em arquivo .txt"
          />
          {coursesWithNotes.length ? (
            <div style={{ display: "grid", gap: 20 }}>
              {coursesWithNotes.map(course => {
                const notes = userNotes[course.id] || {};
                const lessonsWithNotes = course.lessons.filter(l => notes[l.id] && notes[l.id].trim());
                const isExpanded = expandedCourseId === course.id || coursesWithNotes.length === 1;

                return (
                  <div className="panel" key={course.id} style={{ padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
                      <div>
                        <span className="pill">{course.product}</span>
                        <h3 style={{ fontSize: 19, margin: "8px 0 4px" }}>{course.title}</h3>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                          {lessonsWithNotes.length} {lessonsWithNotes.length === 1 ? "aula com anotação" : "aulas com anotações"} · {course.lessons.length} aulas no total
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            exportCourseNotesTxt(course.title, me.name || "Colaborador", course.lessons, notes);
                            notify(`Arquivo .txt baixado com sucesso!`);
                          }}
                        >
                          <Download size={14} /> Baixar Caderno (.txt)
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                        >
                          {isExpanded ? "Ocultar anotações" : "Ver anotações"}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)", display: "grid", gap: 14 }}>
                        {lessonsWithNotes.map(l => (
                          <div key={l.id} className="feedback" style={{ margin: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                              <strong style={{ fontSize: 13, color: "var(--ink)" }}>
                                Aula {course.lessons.findIndex(x => x.id === l.id) + 1}: {l.title}
                              </strong>
                              <Link
                                href={`/aprender/${course.id}/aula?aula=${l.id}`}
                                style={{ fontSize: 11, color: "var(--primary)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                Abrir aula no player <ArrowRight size={12} />
                              </Link>
                            </div>
                            <p style={{ margin: 0, fontSize: 12, color: "var(--ink)", whiteSpace: "pre-wrap" }}>
                              {notes[l.id]}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<FileText size={32} />}
              title="Você ainda não fez anotações"
              description="Ao assistir às aulas nos cursos, use o bloco de notas localizado logo abaixo do player para registrar suas considerações e dúvidas."
            >
              <Button asChild variant="secondary">
                <Link href="/aprender">
                  Explorar catálogo de cursos <ArrowRight size={15} />
                </Link>
              </Button>
            </EmptyState>
          )}
        </section>
      ) : tab === "Biblioteca" ? (
        <>
          <SectionHeading
            title={search ? `Resultados para “${search}”` : "Conhecimento para o seu dia a dia"}
            description={`${articles.length} materiais publicados · disponíveis para toda a equipe`}
          />
          {articles.length ? (
            <div className="article-grid">
              {articles.map(article => (
                <Link href={`/conhecimento/${article.id}`} key={article.id} className="article-card panel">
                  <span className="article-icon"><FileText size={24}/></span>
                  <div><span className="pill">{article.category}</span></div>
                  <h3>{article.title}</h3>
                  <p>{article.content}</p>
                  <div className="article-footer">
                    <span>Versão {article.revision} · {article.product}</span>
                    <ArrowRight size={16}/>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Search size={28}/>}
              title="Ainda não encontramos esse assunto"
              description="Experimente outro termo ou cadastre um novo artigo pelo painel administrativo."
            >
              <Button variant="secondary" onClick={() => setSearch("")}>Ver todos os materiais</Button>
            </EmptyState>
          )}
          <div className="info-note section-space">
            <ShieldCheck size={16} style={{ display: "inline", verticalAlign: "middle" }}/> Os materiais desta biblioteca serão incluídos pela DeMaria.
          </div>
        </>
      ) : (
        <section className="assistant-directory">
          <div className="assistant-intro panel">
            <span className="pill"><Sparkles size={13}/> Assistentes especializados</span>
            <h2>Encontre respostas com nossos GPTs.</h2>
            <p>Escolha um tema para continuar a consulta no ChatGPT. O assistente será aberto em uma nova guia e poderá solicitar que você entre na sua conta.</p>
          </div>

          {filteredSales.length > 0 && (
            <>
              <SectionHeading
                title="Comercial e Vendas"
                description="Auxílio para consultores e colaboradores responderem dúvidas sobre os produtos DeMaria"
              />
              <div className="assistant-grid sales-assistant-grid">
                {filteredSales.map(assistant => (
                  <a
                    className="assistant-card panel"
                    href={assistant.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={assistant.title}
                    aria-label={`Abrir assistente ${assistant.title} em nova guia`}
                  >
                    <span className="assistant-brand sales-brand">
                      <Briefcase size={22}/>
                    </span>
                    <span className="assistant-copy">
                      <small>{assistant.tag}</small>
                      <strong>{assistant.title}</strong>
                      <span>{assistant.description}</span>
                    </span>
                    <ExternalLink size={17}/>
                  </a>
                ))}
              </div>
            </>
          )}

          {filteredWindows.length > 0 && (
            <>
              <SectionHeading
                title="DOC-Windows"
                description="Assistentes para rotinas e configurações do produto"
              />
              <div className="assistant-grid windows-assistant-grid">
                {filteredWindows.map(assistant => (
                  <a
                    className="assistant-card panel"
                    href={assistant.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={assistant.title}
                    aria-label={`Abrir assistente ${assistant.title} em nova guia`}
                  >
                    <span className="assistant-brand doc-windows-brand">
                      <img src="/assets/doc-windows.webp" alt="DOC-Windows"/>
                    </span>
                    <span className="assistant-copy">
                      <small>DOC-WINDOWS</small>
                      <strong>{assistant.title}</strong>
                      <span>Consultar assistente especializado</span>
                    </span>
                    <ExternalLink size={17}/>
                  </a>
                ))}
              </div>
            </>
          )}

          {filteredSeals.length > 0 && (
            <>
              <SectionHeading
                title="Selos Digitais"
                description="Orientações especializadas por Unidade da Federação"
              />
              <div className="assistant-grid seal-assistant-grid">
                {filteredSeals.map(assistant => (
                  <a
                    className="assistant-card panel"
                    href={assistant.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={assistant.uf}
                    aria-label={`Abrir assistente de Selo Digital de ${assistant.state} em nova guia`}
                  >
                    <span className="assistant-brand state-flag">
                      <img src={`/assets/state-flags/${assistant.uf.toLowerCase()}.svg`} alt={`Bandeira de ${assistant.state}`}/>
                    </span>
                    <span className="assistant-copy">
                      <small>{assistant.uf}</small>
                      <strong>Selo Digital de {assistant.state}</strong>
                      <span>Consultar assistente especializado</span>
                    </span>
                    <ExternalLink size={17}/>
                  </a>
                ))}
              </div>
            </>
          )}

          {!hasResults && (
            <EmptyState
              icon={<Search size={28}/>}
              title="Nenhum assistente encontrado"
              description={`Não encontramos nenhum assistente para “${search}”. Tente buscar por outro termo ou limpe o campo de busca.`}
            >
              <Button variant="secondary" onClick={() => setSearch("")}>Ver todos os assistentes</Button>
            </EmptyState>
          )}

          <div className="info-note assistant-future-note">
            <ShieldCheck size={16}/> Futuramente, os materiais publicados nesta biblioteca também poderão oferecer respostas diretamente na DOC-Academy.
          </div>
        </section>
      )}
    </div>
  );
}

export function ArticleDetail({ id }: { id: string }) {
  const { state, ready } = useAcademy();
  const article = state.articles.find(item => item.id === id && item.status === "published");
  if (!ready) return <div className="empty-state">Abrindo material…</div>;
  if (!article) return <EmptyState title="Material indisponível" description="Este artigo não está publicado na biblioteca."/>;
  return (
    <article className="article-page page-enter">
      <Link href="/conhecimento" className="back-link"><ArrowLeft size={15}/> Voltar ao conhecimento</Link>
      <div className="panel">
        <span className="pill">{article.category}</span>
        <h1>{article.title}</h1>
        <div className="article-meta">
          <span>{article.author}</span>
          <span>Versão {article.revision}</span>
          <span><Clock3 size={11} style={{ display: "inline" }}/> {new Date(article.updatedAt + "T12:00:00").toLocaleDateString("pt-BR")}</span>
          <span>{article.product}</span>
        </div>
        <div className="prose">{article.content}</div>
        <div className="info-note" style={{ marginTop: 30 }}>Fonte: artigo publicado na DOC-Academy · versão {article.revision}. Conteúdo compartilhado com os colaboradores.</div>
      </div>
    </article>
  );
}
