"use client";

import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { EmptyState } from "../shared";
import { normalize } from "@/lib/utils";

export function AdminCourses({ search }: { search: string }) {
  const { state } = useAcademy();
  const courses = [
    ...state.courses,
    ...state.courseDrafts.filter(draft => !state.courses.some(course => course.id === draft.id)),
  ];

  const filtered = courses.filter(course => normalize(course.title).includes(normalize(search)));

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>CURSO</th>
            <th>PRODUTO</th>
            <th>STATUS</th>
            <th>ATIVIDADES</th>
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(course => (
            <tr key={course.id}>
              <td>
                <Link href={`/admin/cursos/${course.id}`}>
                  <strong>{course.title}</strong>
                  <small>
                    {course.category} · v{course.version}
                  </small>
                </Link>
              </td>
              <td>{course.product}</td>
              <td>
                <span className={`pill ${course.status === "published" ? "green" : "amber"}`}>
                  {course.status === "published" ? "Publicado" : "Rascunho"}
                </span>
                {state.courseDrafts.some(draft => draft.id === course.id) && course.status === "published" && (
                  <small>Alterações em rascunho</small>
                )}
              </td>
              <td>{course.lessons.length}</td>
              <td>
                <div className="table-actions">
                  <Button asChild variant="ghost" size="icon">
                    <Link href={`/aprender/${course.id}/aula?previa=1`} aria-label={`Prévia de ${course.title}`}>
                      <Eye size={16} />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/admin/cursos/${course.id}`}>
                      <Pencil size={13} /> Editar
                    </Link>
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!filtered.length && (
        <EmptyState title="Nenhum curso encontrado" description="Ajuste a pesquisa ou crie seu primeiro curso." />
      )}
    </div>
  );
}
