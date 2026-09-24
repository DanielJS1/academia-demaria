"use client";

import { useState } from "react";
import { Bookmark, BookOpen, CheckCircle2, Clock3, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { CourseCard, EmptyState, PageHeading } from "./shared";
import { Button } from "./ui/button";
import { isCourseAvailableForCartorio } from "@/lib/model";
import { isCourseComplete } from "@/lib/rewards";
import { normalize } from "@/lib/utils";

export type CatalogTab = "all" | "in_progress" | "available" | "completed" | "saved";

export function Catalog({ initialSearch = "" }: { initialSearch?: string }) {
  const { state, isClientEnvironment, activeCartorio, me } = useAcademy();
  const [search, setSearch] = useState(initialSearch);
  const [product, setProduct] = useState("Todos");
  const [selectedTab, setTab] = useState<CatalogTab | null>(null);
  const [level, setLevel] = useState("Todos");

  const published = state.courses.filter(course => {
    if (course.status !== "published") return false;
    if (isClientEnvironment) {
      if (!activeCartorio) return course.audience === "client" || course.audience === "both";
      return isCourseAvailableForCartorio(course, activeCartorio);
    }
    return course.audience !== "client";
  });

  const inProgressCount = published.filter(
    c => ((state.completed[c.id] || []).length > 0 || Object.values(state.videoProgress[c.id] || {}).some(progress => progress.position > 0)) && !isCourseComplete(c, state, me.id)
  ).length;

  const availableCount = published.filter(
    c => (state.completed[c.id] || []).length === 0 && !Object.values(state.videoProgress[c.id] || {}).some(progress => progress.position > 0)
  ).length;

  const completedCount = published.filter(
    c => isCourseComplete(c, state, me.id)
  ).length;

  const savedCount = published.filter(
    c => state.bookmarks.includes(c.id)
  ).length;
  const tab = selectedTab ?? (inProgressCount > 0 ? "in_progress" : "all");

  const tabs: { id: CatalogTab; label: string; icon: typeof BookOpen; count: number }[] = [
    { id: "in_progress", label: "Em andamento", icon: Clock3, count: inProgressCount },
    { id: "available", label: "Disponíveis", icon: Sparkles, count: availableCount },
    { id: "completed", label: "Concluídos", icon: CheckCircle2, count: completedCount },
    { id: "saved", label: "Salvos", icon: Bookmark, count: savedCount },
    { id: "all", label: "Todos os cursos", icon: BookOpen, count: published.length },
  ];

  const courses = published.filter(course => {
    if (product !== "Todos" && course.product !== product) return false;
    if (level !== "Todos" && course.level !== level) return false;
    if (
      search.trim() &&
      !normalize(`${course.title} ${course.product} ${course.description}`).includes(normalize(search))
    ) {
      return false;
    }

    const isCompleted = isCourseComplete(course, state, me.id);
    const hasStarted = (state.completed[course.id] || []).length > 0 || Object.values(state.videoProgress[course.id] || {}).some(progress => progress.position > 0);

    if (tab === "in_progress") return hasStarted && !isCompleted;
    if (tab === "available") return !hasStarted;
    if (tab === "completed") return isCompleted;
    if (tab === "saved") return state.bookmarks.includes(course.id);
    return true;
  });

  return (
    <div className="page-enter">
      <PageHeading
        eyebrow={
          isClientEnvironment
            ? `CAPACITAÇÃO DE CLIENTES · ${activeCartorio?.uf || "DEMARIA"}`
            : "APRENDER É EXPLORAR"
        }
        title={isClientEnvironment ? "Trilha Técnica Contratada." : "Encontre seu próximo passo."}
        description={
          isClientEnvironment
            ? "Cursos oficiais liberados conforme a contratação de módulos da sua serventia."
            : "Cursos e experiências para transformar conhecimento em possibilidades."
        }
      >
        <span className="round-heading-icon">
          <BookOpen size={26} />
        </span>
      </PageHeading>

      <div className="catalog-banner">
        <span className="mini-icon">
          <Sparkles size={22} />
        </span>
        <div>
          <strong>
            {isClientEnvironment
              ? `Capacitação · ${activeCartorio?.name || "Cartório Parceiro"}`
              : "Uma jornada para cada descoberta."}
          </strong>
          <p>
            {isClientEnvironment
              ? `${published.length} curso(s) habilitado(s) para os módulos ativos.`
              : "Explore os produtos DeMaria e desenvolva novas habilidades."}
          </p>
        </div>
        <span className="catalog-count">
          {published.length}
          <small>cursos disponíveis</small>
        </span>
      </div>

      <div className="tabs" role="tablist" aria-label="Filtrar cursos por status de aprendizado">
        {tabs.map(item => {
          const isSelected = tab === item.id;
          const Icon = item.icon;
          return (
            <button
              type="button"
              role="tab"
              className={isSelected ? "selected" : ""}
              aria-selected={isSelected}
              key={item.id}
              onClick={() => setTab(item.id)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              <span className="tab-count">{item.count}</span>
            </button>
          );
        })}
      </div>

      <div className="filter-bar">
        <div className="field-search">
          <Search size={18} />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar curso, assunto ou produto..."
            aria-label="Pesquisar no catálogo"
          />
        </div>
        <label className="select-field">
          <SlidersHorizontal size={16} />
          <select
            value={product}
            onChange={event => setProduct(event.target.value)}
            aria-label="Filtrar por produto"
          >
            <option>Todos</option>
            {state.products.map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <select
          className="select-standalone"
          value={level}
          onChange={event => setLevel(event.target.value)}
          aria-label="Filtrar por nível"
        >
          <option value="Todos">Todos os níveis</option>
          <option>Essencial</option>
          <option>Intermediário</option>
          <option>Avançado</option>
        </select>
      </div>

      <div className="results-label">
        <strong>{courses.length}</strong>{" "}
        {courses.length === 1 ? "curso encontrado" : "cursos encontrados"}
        <span>Seu ritmo. Suas descobertas.</span>
      </div>

      {courses.length ? (
        <div className="course-grid catalog-grid">
          {courses.map(course => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={
            tab === "completed" ? (
              <CheckCircle2 size={30} />
            ) : tab === "in_progress" ? (
              <Clock3 size={30} />
            ) : tab === "saved" ? (
              <Bookmark size={30} />
            ) : tab === "available" ? (
              <Sparkles size={30} />
            ) : (
              <BookOpen size={30} />
            )
          }
          title={
            search.trim() || product !== "Todos" || level !== "Todos"
              ? "Nenhum curso encontrado com esses filtros"
              : tab === "completed"
              ? "Você ainda não concluiu nenhum curso"
              : tab === "in_progress"
              ? "Nenhum curso em andamento no momento"
              : tab === "available"
              ? "Você já iniciou todos os cursos disponíveis!"
              : tab === "saved"
              ? "Nenhum curso salvo nos seus favoritos"
              : "Nenhum curso encontrado"
          }
          description={
            search.trim() || product !== "Todos" || level !== "Todos"
              ? "Experimente buscar por outros termos ou redefinir os filtros acima."
              : tab === "completed"
              ? "Conclua as aulas e avaliações de um curso para vê-lo aqui na sua galeria de concluídos."
              : tab === "in_progress"
              ? "Escolha um dos cursos novos na aba 'Disponíveis' para começar seu próximo aprendizado."
              : tab === "available"
              ? "Excelente ritmo de estudos! Revise os cursos em andamento ou confira seus concluídos."
              : tab === "saved"
              ? "Salve cursos clicando no ícone de marcador para organizá-los e estudar quando quiser."
              : "Experimente outro termo ou ajuste os filtros para encontrar um curso."
          }
        >
          <Button
            variant="secondary"
            onClick={() => {
              setSearch("");
              setProduct("Todos");
              setLevel("Todos");
              setTab("all");
            }}
          >
            {tab !== "all" || search.trim() || product !== "Todos" || level !== "Todos"
              ? "Ver todos os cursos"
              : "Limpar busca"}
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
