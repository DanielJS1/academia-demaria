"use client";
import Link from "next/link";
import { KB_PUBLIC_SITE } from "@/lib/kb/public-links";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Briefcase, Clock3, Download, ExternalLink, FileText, FolderOpen, PenLine, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { Button } from "./ui/button";
import { EmptyState, SectionHeading, PageHeading } from "./shared";
import { normalize } from "@/lib/utils";
import { getAllUserNotes, exportCourseNotesTxt } from "./lesson-notepad";
import { CommunityLibrary } from "./community/community-library";
import { CommunityArticle } from "./community/community-article";
import { TechnicalMaterials } from "./technical-materials";
import { salesAssistants, sealAssistants, windowsAssistants } from "./knowledge/assistants";
import { KnowledgeSearchResults } from "./knowledge/search-results";
import { useKnowledgeNavigation, type KnowledgeArea } from "./knowledge/use-knowledge-navigation";

export function Knowledge({ initialTab, initialSearch = "", initialSource, initialPage, initialMaterialId }: {
  initialTab?: KnowledgeArea; initialSearch?: string; initialSource?: string; initialPage?: number; initialMaterialId?: string;
}) {
  const { state, me, notify } = useAcademy();
  const navigation = useKnowledgeNavigation({ initialTab, initialSearch, initialSource, initialPage, initialMaterialId, audience: me.audience });
  const { search, setSearch, tab, setTab, clearSearch } = navigation;
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  const [notesSnapshot, setNotesSnapshot] = useState<{ userId: string; notes: Record<string, Record<string, string>> }>();
  useEffect(() => {
    const load = () => setNotesSnapshot({ userId: me.id, notes: getAllUserNotes(me.id) });
    load();
    window.addEventListener("storage", load); window.addEventListener("academy:notes-changed", load);
    return () => { window.removeEventListener("storage", load); window.removeEventListener("academy:notes-changed", load); };
  }, [me.id]);
  const userNotes = notesSnapshot?.userId === me.id ? notesSnapshot.notes : {};
  const coursesWithNotes = state.courses.filter(c => userNotes[c.id] && Object.values(userNotes[c.id]).some(t => t && t.trim()));

  const q = normalize(search);
  const filteredSales = salesAssistants.filter(a => normalize(`${a.title} ${a.tag} ${a.description}`).includes(q));
  const filteredWindows = windowsAssistants.filter(a => normalize(a.title).includes(q));
  const filteredSeals = sealAssistants.filter(a => normalize(`${a.uf} ${a.state}`).includes(q));
  const hasResults = filteredSales.length > 0 || filteredWindows.length > 0 || filteredSeals.length > 0;

  const published = state.articles.filter(article => article.status === "published");
  const isSearching = search.trim().length >= 2;

  return (
    <div className="page-enter knowledge-page">
      <PageHeading variant="compact" title="Conhecimento" description="Encontre respostas e compartilhe experiências.">
        {me.audience !== "client" && <Button asChild variant="secondary"><Link href="/conhecimento/oficial"><PenLine size={16} aria-hidden="true" />Gerenciar base oficial</Link></Button>}
      </PageHeading>
        <div className="field-search knowledge-unified-search" role="search">
          <Search size={20}/>
          <input
            aria-label="Pesquisar no conhecimento"
            placeholder="Busque em todas as fontes de conhecimento..."
            maxLength={120}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          {search && <button type="button" aria-label="Limpar busca" onClick={clearSearch}><X size={17} /></button>}
        </div>
      {isSearching ? <KnowledgeSearchResults query={search.trim()} source={navigation.source} page={navigation.page}
        userId={me.id} audience={me.audience} courses={state.courses} onSource={navigation.setSource} onPage={navigation.setPage} /> : search.trim() ?
        <p className="knowledge-search-help" role="status">Digite pelo menos 2 caracteres para pesquisar.</p> : <>
      <div className="tabs knowledge-tabs" role="group" aria-label="Áreas do conhecimento">
        {me.audience !== "client" &&
        <button
          type="button"
          className={tab === "Biblioteca" ? "selected" : ""}
          aria-pressed={tab === "Biblioteca"}
          onClick={() => setTab("Biblioteca")}
        >
          <BookOpen size={20}/><span><strong>Fórum ({published.length})</strong><small>Artigos da comunidade</small></span>
        </button>}
        <button
          type="button"
          className={tab === "Consulta assistida" ? "selected" : ""}
          aria-pressed={tab === "Consulta assistida"}
          onClick={() => setTab("Consulta assistida")}
        >
          <Sparkles size={20}/><span><strong>Assistentes</strong><small>Consulta especializada</small></span>
        </button>
        <button
          type="button"
          className={tab === "Anotações" ? "selected" : ""}
          aria-pressed={tab === "Anotações"}
          onClick={() => setTab("Anotações")}
        >
          <FileText size={20}/><span><strong>Minhas anotações ({coursesWithNotes.length})</strong><small>Seu caderno de estudos</small></span>
        </button>
        {me.audience !== "client" && <button type="button" className={tab === "Materiais técnicos" ? "selected" : ""} aria-pressed={tab === "Materiais técnicos"} onClick={() => setTab("Materiais técnicos")}>
          <FolderOpen size={20}/><span><strong>Materiais técnicos</strong><small>Manuais e vídeos de consulta</small></span>
        </button>}
        <Link className="knowledge-area-link" href="/conhecimento/base"><span className="knowledge-official-symbol" aria-hidden="true" /><span><strong>Base oficial</strong><small>Procedimentos e orientações</small></span></Link>
      </div>

      <a className="knowledge-public-link" href={KB_PUBLIC_SITE} target="_blank" rel="noopener noreferrer">Base oficial: site público para clientes<ExternalLink size={14} aria-hidden="true"/><span className="sr-only"> (abre em nova aba)</span></a>
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
      ) : tab === "Materiais técnicos" && me.audience !== "client" ? (
        <TechnicalMaterials search="" initialMaterialId={navigation.materialId} />
      ) : tab === "Biblioteca" ? (
        <CommunityLibrary search="" matchedIds={null} clearSearch={clearSearch} />
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
            <ShieldCheck size={16}/> Futuramente, os materiais publicados nesta biblioteca também poderão oferecer respostas diretamente na Academia DeMaria.
          </div>
        </section>
      )}
      </>}
    </div>
  );
}

export function ArticleDetail({ id }: { id: string }) {
  return <CommunityArticle id={id} />;
}
