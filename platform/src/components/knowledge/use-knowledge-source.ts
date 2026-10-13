"use client";
import { useEffect, useState } from "react";
import type { Course } from "@/lib/model";
import { searchOwnNotes, type KnowledgeSource, type KnowledgePage } from "@/lib/knowledge/search";
import { searchAssistants } from "./assistants";
import { searchRemoteKnowledge } from "./search-client";
import { readUserNotes, getUserNotesStorageKey } from "../lesson-notepad";

export function useKnowledgeSource(source: KnowledgeSource, { query, page, userId, audience, enabled, courses }: {
  query: string; page: number; userId: string; enabled: boolean;
  audience?: "internal" | "client";
  courses?: readonly Course[];
}) {
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([source, query, page, userId, audience]);
  const [result, setResult] = useState<{ key: string; revision: number; data?: KnowledgePage; error?: string }>();
  useEffect(() => {
    if (!enabled || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const load = async () => {
        try {
          const data = source === "assistants" ? searchAssistants(query, page) : source === "notes" ? searchOwnNotes(courses ?? [], readUserNotes(userId), query, page) :
            await searchRemoteKnowledge(source, query, page, userId, controller.signal);
          if (!controller.signal.aborted) setResult({ key, revision, data });
        } catch (error) {
          if (!controller.signal.aborted) setResult({ key, revision, error: error instanceof Error ? error.message : "Fonte indisponível." });
        }
      };
      void load();
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [source, query, page, userId, enabled, key, revision, courses]);
  useEffect(() => {
    if (source !== "notes") return;
    const changed = (event: Event) => {
      if (event instanceof StorageEvent ? event.key === getUserNotesStorageKey(userId) : (event as CustomEvent).detail?.userId === userId) setRevision(value => value + 1);
    };
    window.addEventListener("storage", changed); window.addEventListener("academy:notes-changed", changed);
    return () => { window.removeEventListener("storage", changed); window.removeEventListener("academy:notes-changed", changed); };
  }, [source, userId]);
  const current = result?.key === key && result.revision === revision && enabled ? result : undefined;
  return { data: current?.data, error: current?.error, loading: enabled && query.trim().length >= 2 && !current, retry: () => setRevision(value => value + 1) };
}
