"use client";

import { useAcademy } from "../academy-provider";
import { EmptyState } from "../shared";
import dynamic from "next/dynamic";

const loading = () => <div className="empty-state" role="status">Preparando o editor…</div>;
const CourseEditor = dynamic(() => import("./course-editor").then(module => module.CourseEditor), { ssr: false, loading });
const ArticleEditor = dynamic(() => import("./article-editor").then(module => module.ArticleEditor), { ssr: false, loading });
const PersonEditor = dynamic(() => import("./person-editor").then(module => module.PersonEditor), { ssr: false, loading });

export function ResourceEditor({ kind, id }: { kind: string; id: string }) {
  const { ready } = useAcademy();

  if (!ready) {
    return <div className="empty-state">Preparando o editor…</div>;
  }

  if (kind === "cursos") return <CourseEditor id={id} />;
  if (kind === "conhecimento") return <ArticleEditor id={id} />;
  if (kind === "pessoas") return <PersonEditor id={id} />;

  return (
    <EmptyState
      title="Página não encontrada"
      description="Volte ao painel administrativo para continuar."
    />
  );
}
