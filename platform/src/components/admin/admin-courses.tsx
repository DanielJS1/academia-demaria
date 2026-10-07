"use client";

import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { EmptyState } from "../shared";
import { normalize } from "@/lib/utils";
import { courseAvailabilityLabels, getCourseAvailability, type Course, type CourseAvailability } from "@/lib/model";

export function AdminCourses({ search }: { search: string }) {
  const { state, mutate, busy, notify } = useAcademy();
  const changeAvailability = async (course: Course, availability: CourseAvailability) => {
    const success = await mutate({ type: "course-availability", courseId: course.id, availability,
      expectedAvailability: getCourseAvailability(course),
      expectedVersion: state.courses.find(item => item.id === course.id)?.version ?? 0 });
    if (success) notify(`${course.title}: ${courseAvailabilityLabels[availability].toLowerCase()}.`);
  };
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
                <select className="select-standalone" aria-label={`Disponibilidade de ${course.title}`} value={getCourseAvailability(course)}
                  disabled={busy} onChange={event => changeAvailability(course, event.target.value as CourseAvailability)}>
                  {Object.entries(courseAvailabilityLabels).map(([value, label]) => (
                    <option key={value} value={value} disabled={value === "active" && course.status !== "published"}>{label}</option>
                  ))}
                </select>
                {course.status === "draft" && <small>Rascunho · publique pelo editor para ativar</small>}
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
