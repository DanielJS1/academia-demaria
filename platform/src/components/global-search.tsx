"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { BookOpen, Search, StickyNote, X } from "lucide-react";
import type { Course } from "@/lib/model";
import { normalize } from "@/lib/utils";
import { getAllUserNotes } from "./lesson-notepad";
import { searchArticles } from "./community/article-client";

type Scope = "courses" | "notes" | "library";
type Result = { id: string; title: string; detail: string; href: string };

export function GlobalSearch({ courses, userId }: { courses: Course[]; userId: string }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scope, setScope] = useState<Scope>("courses");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [notesSnapshot, setNotes] = useState<{ userId: string; data: Record<string, Record<string, string>> }>();
  const notes = notesSnapshot?.userId === userId ? notesSnapshot.data : {};
  const [librarySnapshot, setLibrarySnapshot] = useState<{ userId: string; query: string; results?: Result[]; error?: string }>();
  const currentLibrary = librarySnapshot?.userId === userId && librarySnapshot.query === query.trim() ? librarySnapshot : undefined;
  const libraryResults = currentLibrary?.results ?? [];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (scope === "notes" && open) setNotes({ userId, data: getAllUserNotes(userId) });
  }, [scope, open, userId]);

  useEffect(() => {
    setLibrarySnapshot(undefined);
    if (scope !== "library" || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => { void searchArticles(query.trim(), controller.signal, userId)
      .then(results => { if (!controller.signal.aborted) setLibrarySnapshot({ userId, query: query.trim(), results }); })
      .catch(error => { if (!controller.signal.aborted) setLibrarySnapshot({ userId, query: query.trim(), error: error instanceof Error ? error.message : "Busca indisponível." }); }); }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [scope, query, userId]);

  const term = normalize(query.trim());
  const results: Result[] = !term ? [] : scope === "library" ? libraryResults.slice(0, 6) : scope === "courses"
    ? courses.filter(course => course.status === "published" && normalize(`${course.title} ${course.product} ${course.description}`).includes(term))
        .slice(0, 6).map(course => ({ id: course.id, title: course.title, detail: course.product, href: `/aprender/${encodeURIComponent(course.id)}/aula` }))
    : courses.flatMap(course => course.lessons.flatMap(lesson => {
        const note = notes[course.id]?.[lesson.id];
        return note && normalize(`${course.title} ${lesson.title} ${note}`).includes(term)
          ? [{ id: `${course.id}:${lesson.id}`, title: lesson.title, detail: course.title, href: `/aprender/${encodeURIComponent(course.id)}/aula?aula=${encodeURIComponent(lesson.id)}` }]
          : [];
      })).slice(0, 6);

  const submit = () => {
    if (activeIndex >= 0 && results[activeIndex]) {
      router.push(results[activeIndex].href);
    } else if (scope === "notes") {
      router.push(`/conhecimento?aba=anotacoes&tipo=notes&busca=${encodeURIComponent(query.trim())}`);
    } else if (scope === "library") {
      router.push(`/conhecimento?aba=biblioteca&tipo=forum&busca=${encodeURIComponent(query.trim())}`);
    } else {
      router.push(`/aprender?busca=${encodeURIComponent(query.trim())}`);
    }
    setOpen(false);
  };

  return (
    <form className="global-search" role="search" onSubmit={event => { event.preventDefault(); submit(); }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActiveIndex(-1); } }}>
      <div className="global-search-field">
        <Search size={18} aria-hidden="true" />
        <input ref={inputRef} role="combobox" aria-label={scope === "courses" ? "Buscar em Aprender" : scope === "library" ? "Buscar no Fórum" : "Buscar em Minhas Anotações"}
          aria-autocomplete="list" aria-expanded={open && !!term} aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 && results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          placeholder={scope === "courses" ? "O que você quer aprender?" : scope === "library" ? "Buscar no Fórum" : "Buscar nas minhas anotações"}
          value={query} onFocus={() => setOpen(true)}
          onChange={event => { setQuery(event.target.value); setActiveIndex(-1); setOpen(true); }}
          onKeyDown={event => {
            if (event.key === "ArrowDown" && results.length) { event.preventDefault(); setActiveIndex(index => Math.min(index + 1, results.length - 1)); setOpen(true); }
            if (event.key === "ArrowUp" && results.length) { event.preventDefault(); setActiveIndex(index => Math.max(index - 1, 0)); setOpen(true); }
            if (event.key === "Escape") { setOpen(false); setActiveIndex(-1); }
          }} />
        {query && <button type="button" className="global-search-clear" aria-label="Limpar busca"
          onClick={() => { setQuery(""); setActiveIndex(-1); inputRef.current?.focus(); }}><X size={16} /></button>}
        <select className="global-search-scope" aria-label="Onde buscar" value={scope}
          onChange={event => { setScope(event.target.value as Scope); setActiveIndex(-1); setOpen(true); inputRef.current?.focus(); }}>
          <option value="courses">Aprender</option>
          <option value="library">Fórum</option>
          <option value="notes">Minhas Anotações</option>
        </select>
      </div>
      {open && !!term && (
        <div className="global-search-results" id={listId} role="listbox" aria-label="Sugestões de busca">
          {results.length ? results.map((result, index) => (
            <Link key={result.id} id={`${listId}-${index}`} role="option" aria-selected={activeIndex === index}
              className={activeIndex === index ? "is-active" : ""} href={result.href}
              onMouseEnter={() => setActiveIndex(index)} onClick={() => setOpen(false)}>
              {scope === "notes" ? <StickyNote size={17} aria-hidden="true" /> : <BookOpen size={17} aria-hidden="true" />}
              <span><strong>{result.title}</strong><small>{result.detail}</small></span>
            </Link>
          )) : <p className="global-search-empty" role="status">{scope === "library" ? query.trim().length < 2 ? "Digite pelo menos 2 caracteres." : currentLibrary?.error ?? (!currentLibrary ? "Pesquisando no fórum…" : "Nenhum resultado. Tente outro termo.") : "Nenhum resultado. Tente outro termo."}</p>}
          <button type="submit" className="global-search-all" onMouseEnter={() => setActiveIndex(-1)}>
            {scope === "courses" ? "Ver busca em Aprender" : scope === "library" ? "Ver busca no Fórum" : "Ver minhas anotações"}
          </button>
        </div>
      )}
    </form>
  );
}
