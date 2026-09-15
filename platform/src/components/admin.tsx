"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, ClipboardCheck, FileText, Plus, Search, Settings2, Users } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { Button } from "./ui/button";
import { PageHeading } from "./shared";
import { AdminCourses } from "./admin/admin-courses";
import { AdminPeople } from "./admin/admin-people";
import { AdminArticles } from "./admin/admin-articles";
import { AdminReviews } from "./admin/admin-reviews";
import { AdminConfig, ConfigList } from "./admin/admin-config";

export { AdminCourses } from "./admin/admin-courses";
export { AdminPeople } from "./admin/admin-people";
export { AdminArticles } from "./admin/admin-articles";
export { AdminReviews } from "./admin/admin-reviews";
export { AdminConfig, ConfigList } from "./admin/admin-config";

const tabs = [
  { id: "cursos", label: "Cursos", icon: BookOpen },
  { id: "pessoas", label: "Pessoas", icon: Users },
  { id: "conhecimento", label: "Conhecimento", icon: FileText },
  { id: "correcoes", label: "Correções", icon: ClipboardCheck },
  { id: "configuracoes", label: "Cadastros", icon: Settings2 },
];

export function Admin({ initialTab = "cursos" }: { initialTab?: string }) {
  const { state } = useAcademy();
  const [tab, setTab] = useState(tabs.some(item => item.id === initialTab) ? initialTab : "cursos");
  const [search, setSearch] = useState("");

  const countPending = state.attempts.filter(attempt => attempt.status === "pending").length;
  const resource = ["cursos", "pessoas", "conhecimento"].includes(tab) ? tab : null;

  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="CONSTRUA NOVAS POSSIBILIDADES"
        title="Cuidar do conhecimento."
        description="Um espaço para criar, organizar e acompanhar cada jornada."
      >
        {resource && (
          <Button asChild>
            <Link href={`/admin/${resource}/novo`}>
              <Plus size={16} />
              {tab === "cursos" ? "Criar curso" : tab === "pessoas" ? "Cadastrar pessoa" : "Criar artigo"}
            </Link>
          </Button>
        )}
      </PageHeading>

      <div className="admin-stats">
        {[
          {
            label: "Cursos publicados",
            value: state.courses.filter(course => course.status === "published").length,
            hint: "Prontos para explorar",
            icon: BookOpen,
          },
          {
            label: "Pessoas cadastradas",
            value: state.people.length,
            hint: "Contas de demonstração",
            icon: Users,
          },
          {
            label: "Materiais publicados",
            value: state.articles.filter(article => article.status === "published").length,
            hint: "Conhecimento compartilhado",
            icon: FileText,
          },
          {
            label: "Aguardando correção",
            value: countPending,
            hint: "Um feedback faz diferença",
            icon: ClipboardCheck,
          },
        ].map(item => (
          <div className="panel stat-card" key={item.label}>
            <span>
              {item.label}
              <item.icon size={17} />
            </span>
            <strong>{item.value}</strong>
            <small>{item.hint}</small>
          </div>
        ))}
      </div>

      <div className="tabs">
        {tabs.map(item => (
          <button
            key={item.id}
            className={tab === item.id ? "selected" : ""}
            aria-pressed={tab === item.id}
            onClick={() => {
              setTab(item.id);
              setSearch("");
            }}
          >
            <item.icon size={16} />
            {item.label}
            {item.id === "correcoes" && countPending > 0 ? ` (${countPending})` : ""}
          </button>
        ))}
      </div>

      {resource && (
        <div className="filter-bar">
          <div className="field-search">
            <Search size={17} />
            <input
              aria-label="Pesquisar registros"
              placeholder="Buscar pelo nome..."
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>
          <span className="pill">Ambiente local</span>
        </div>
      )}

      {tab === "cursos" && <AdminCourses search={search} />}
      {tab === "pessoas" && <AdminPeople search={search} />}
      {tab === "conhecimento" && <AdminArticles search={search} />}
      {tab === "correcoes" && <AdminReviews />}
      {tab === "configuracoes" && <AdminConfig />}
    </div>
  );
}
