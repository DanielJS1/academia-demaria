"use client";

import { useEffect, useState, useRef } from "react";
import { Check, Copy, Download, FileText, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { useAcademy } from "./academy-provider";
import type { Lesson } from "@/lib/model";

export function getUserNotesStorageKey(userId: string): string {
  return `doc-academy.notes.${userId || "anon"}`;
}

export function getAllUserNotes(userId: string): Record<string, Record<string, string>> {
  try {
    const raw = localStorage.getItem(getUserNotesStorageKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getCourseNotes(userId: string, courseId: string): Record<string, string> {
  const all = getAllUserNotes(userId);
  return all[courseId] || {};
}

export function saveUserLessonNote(userId: string, courseId: string, lessonId: string, text: string): void {
  try {
    const all = getAllUserNotes(userId);
    if (!all[courseId]) all[courseId] = {};
    if (!text.trim()) {
      delete all[courseId][lessonId];
      if (Object.keys(all[courseId]).length === 0) delete all[courseId];
    } else {
      all[courseId][lessonId] = text;
    }
    localStorage.setItem(getUserNotesStorageKey(userId), JSON.stringify(all));
  } catch {}
}

export function exportCourseNotesTxt(
  courseTitle: string,
  studentName: string,
  lessons: Array<{ id: string; title: string; module?: string; minutes?: number }>,
  notes: Record<string, string>
) {
  const dateStr = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  let content = `============================================================\n`;
  content += `DOC-ACADEMY · CADERNO DE ESTUDOS\n`;
  content += `Curso: ${courseTitle}\n`;
  content += `Aluno: ${studentName}\n`;
  content += `Data da Exportação: ${dateStr}\n`;
  content += `============================================================\n\n`;

  let notesCount = 0;
  for (let i = 0; i < lessons.length; i++) {
    const l = lessons[i];
    const note = notes[l.id];
    if (note && note.trim()) {
      notesCount++;
      content += `AULA ${String(i + 1).padStart(2, "0")}: ${l.title}\n`;
      content += `Módulo: ${l.module || "Geral"} · Duração: ${l.minutes || 0} min\n`;
      content += `------------------------------------------------------------\n`;
      content += `${note.trim()}\n\n\n`;
    }
  }

  if (notesCount === 0) {
    content += `Nenhuma anotação registrada para este curso até o momento.\n`;
  }

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeFilename = courseTitle.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "").trim().replace(/\s+/g, "_");
  a.download = `DOC-Academy_Anotacoes_${safeFilename || "Curso"}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function LessonNotepad({
  courseId,
  courseTitle,
  lesson,
  allLessons,
}: {
  courseId: string;
  courseTitle: string;
  lesson: Lesson;
  allLessons: Lesson[];
}) {
  const { me, notify } = useAcademy();
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedStatus, setSavedStatus] = useState<"saved" | "saving">("saved");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load existing note for current lesson
  useEffect(() => {
    const currentNotes = getCourseNotes(me.id, courseId);
    setNote(currentNotes[lesson.id] || "");
    setSavedStatus("saved");
  }, [me.id, courseId, lesson.id]);

  const handleChange = (value: string) => {
    setNote(value);
    setSavedStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveUserLessonNote(me.id, courseId, lesson.id, value);
      setSavedStatus("saved");
    }, 500);
  };

  const copyNote = () => {
    if (!note.trim()) return;
    void navigator.clipboard.writeText(note);
    setCopied(true);
    notify("Anotação copiada para a área de transferência.");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportTxt = () => {
    const currentNotes = getCourseNotes(me.id, courseId);
    // Include the current unsaved state if any
    const merged = { ...currentNotes, [lesson.id]: note };
    const hasAny = Object.values(merged).some(text => text && text.trim());
    if (!hasAny) {
      notify("Você ainda não fez anotações nas aulas deste curso.");
      return;
    }
    exportCourseNotesTxt(courseTitle, me.name || "Colaborador", allLessons, merged);
    notify("Arquivo .txt do caderno de estudos gerado com sucesso!");
  };

  const totalCourseNotesCount = () => {
    const currentNotes = getCourseNotes(me.id, courseId);
    const count = Object.values(currentNotes).filter(t => t && t.trim()).length;
    return note.trim() && !currentNotes[lesson.id] ? count + 1 : count;
  };

  return (
    <section className="lesson-notepad panel" aria-label="Bloco de Notas da Aula">
      <div className="notepad-header">
        <div className="notepad-title-wrap">
          <span className="notepad-icon">
            <FileText size={16} />
          </span>
          <div>
            <h3>Bloco de Notas da Aula</h3>
            <small>Suas anotações ficam salvas e você pode exportar o caderno completo em .txt</small>
          </div>
        </div>
        <div className="notepad-actions">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={!note.trim()}
            onClick={copyNote}
            title="Copiar anotação desta aula"
          >
            {copied ? <Check size={14} style={{ color: "#48bb78" }} /> : <Copy size={14} />}
            <span>{copied ? "Copiado" : "Copiar"}</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={handleExportTxt}
            title="Baixar todas as anotações deste curso em um arquivo .txt organizado"
          >
            <Download size={14} />
            <span>Baixar caderno ({totalCourseNotesCount()} aulas)</span>
          </Button>
        </div>
      </div>

      <div className="notepad-editor-wrap">
        <textarea
          className="notepad-textarea"
          value={note}
          placeholder={`Faça suas anotações sobre "${lesson.title}" aqui. Seus apontamentos são salvos automaticamente.`}
          onChange={e => handleChange(e.target.value)}
          rows={4}
          maxLength={10000}
        />
        <div className="notepad-footer">
          <span className="notepad-status">
            {savedStatus === "saving" ? (
              <span style={{ color: "var(--muted)" }}>Gravando...</span>
            ) : note.trim() ? (
              <span style={{ color: "#48bb78", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Check size={12} /> Salvo nesta aula
              </span>
            ) : (
              <span style={{ color: "var(--muted)" }}>Pronto para anotar</span>
            )}
          </span>
          <span className="notepad-count">{note.length} caracteres</span>
        </div>
      </div>
    </section>
  );
}
