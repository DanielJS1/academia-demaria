"use client";
import { useState } from "react";
import { Bookmark, BookOpen, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { CourseCard, EmptyState, PageHeading } from "./shared";
import { Button } from "./ui/button";
import { isCourseAvailableForCartorio } from "@/lib/model";
import { normalize } from "@/lib/utils";
export function Catalog({ initialSearch = "" }: { initialSearch?: string }) {
  const { state, isClientEnvironment, activeCartorio } = useAcademy(); const [search, setSearch] = useState(initialSearch); const [product, setProduct] = useState("Todos"); const [tab, setTab] = useState("Todos os cursos"); const [level, setLevel] = useState("Todos");
  const published = state.courses.filter(course => {
    if (course.status !== "published") return false;
    if (isClientEnvironment) {
      if (!activeCartorio) return course.audience === "client" || course.audience === "both";
      return isCourseAvailableForCartorio(course, activeCartorio);
    }
    return course.audience !== "client";
  });
  const courses = published.filter(course => (product === "Todos" || course.product === product) && (level === "Todos" || course.level === level) && normalize(`${course.title} ${course.product} ${course.description}`).includes(normalize(search)) && (tab === "Todos os cursos" || (tab === "Em andamento" && (state.completed[course.id] || []).length > 0) || (tab === "Salvos" && state.bookmarks.includes(course.id))));
  return <div className="page-enter"><PageHeading eyebrow={isClientEnvironment ? `CAPACITAÇÃO DE CLIENTES · ${activeCartorio?.uf || "DEMARIA"}` : "APRENDER É EXPLORAR"} title={isClientEnvironment ? "Trilha Técnica Contratada." : "Encontre seu próximo passo."} description={isClientEnvironment ? "Cursos oficiais liberados conforme a contratação de módulos da sua serventia." : "Cursos e experiências para transformar conhecimento em possibilidades."}><span className="round-heading-icon"><BookOpen size={26}/></span></PageHeading><div className="catalog-banner"><span className="mini-icon"><Sparkles size={22}/></span><div><strong>{isClientEnvironment ? `Capacitação · ${activeCartorio?.name || "Cartório Parceiro"}` : "Uma jornada para cada descoberta."}</strong><p>{isClientEnvironment ? `${published.length} curso(s) habilitado(s) para os módulos ativos.` : "Explore os produtos DeMaria e desenvolva novas habilidades."}</p></div><span className="catalog-count">{published.length}<small>cursos disponíveis</small></span></div>
    <div className="tabs" aria-label="Visualização dos cursos">{["Todos os cursos", "Em andamento", "Salvos"].map(item => <button className={tab === item ? "selected" : ""} aria-pressed={tab === item} key={item} onClick={() => setTab(item)}>{item === "Salvos" ? <Bookmark size={16}/> : item === "Todos os cursos" ? <BookOpen size={16}/> : null}{item}</button>)}</div>
    <div className="filter-bar"><div className="field-search"><Search size={18}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar curso, assunto ou produto..." aria-label="Pesquisar no catálogo"/></div><div className="select-field"><SlidersHorizontal size={16}/><select value={product} onChange={event => setProduct(event.target.value)} aria-label="Filtrar por produto"><option>Todos</option>{state.products.map(item => <option key={item}>{item}</option>)}</select></div><select className="select-standalone" value={level} onChange={event => setLevel(event.target.value)} aria-label="Filtrar por nível"><option value="Todos">Todos os níveis</option><option>Essencial</option><option>Intermediário</option><option>Avançado</option></select></div>
    <div className="results-label"><strong>{courses.length}</strong> {courses.length === 1 ? "curso encontrado" : "cursos encontrados"}<span>Seu ritmo. Suas descobertas.</span></div>
    {courses.length ? <div className="course-grid catalog-grid">{courses.map(course => <CourseCard key={course.id} course={course}/>)}</div> : <EmptyState title="Um novo caminho para sua busca" description="Experimente outro termo ou ajuste os filtros para encontrar um curso."><Button variant="secondary" onClick={() => { setSearch(""); setProduct("Todos"); setLevel("Todos"); setTab("Todos os cursos"); }}>Limpar filtros</Button></EmptyState>}
  </div>;
}
