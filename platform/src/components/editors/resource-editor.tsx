"use client";

import { useAcademy } from "../academy-provider";
import { EmptyState } from "../shared";
import { CourseEditor } from "./course-editor";
import { ArticleEditor } from "./article-editor";
import { PersonEditor } from "./person-editor";

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
