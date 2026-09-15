"use client";
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { stateSchema, type AcademyState } from "@/lib/model";
import { initialState } from "@/lib/seed";
const key = "doc-academy.demo.v1";
type Context = { state: AcademyState; update: (change: (current: AcademyState) => AcademyState) => void; ready: boolean; notify: (message: string) => void; theme: string; toggleTheme: () => void; storageError: boolean };
const AcademyContext = createContext<Context | null>(null);
export function AcademyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AcademyState>(initialState);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState("light");
  const [toast, setToast] = useState("");
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const result = stateSchema.safeParse(JSON.parse(saved));
        if (result.success) setState(result.data);
        else { setStorageError(true); setToast("Dados locais incompatíveis. Exibindo exemplos sem sobrescrever seu armazenamento."); }
      }
      const preference = localStorage.getItem("doc-academy.theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      setTheme(preference === "dark" ? "dark" : "light");
    } catch { setStorageError(true); }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || storageError) return;
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { setStorageError(true); }
  }, [state, ready, storageError]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 5000); return () => clearTimeout(timer); }, [toast]);
  const update = useCallback((change: (current: AcademyState) => AcademyState) => setState(current => change(current)), []);
  const toggleTheme = () => setTheme(current => { const next = current === "light" ? "dark" : "light"; try { localStorage.setItem("doc-academy.theme", next); } catch {} return next; });
  return <AcademyContext.Provider value={{ state, update, ready, notify: setToast, theme, toggleTheme, storageError }}>{children}{toast && <div className="toast" role="status">{toast}</div>}</AcademyContext.Provider>;
}
export function useAcademy() { const context = useContext(AcademyContext); if (!context) throw new Error("AcademyProvider ausente"); return context; }
