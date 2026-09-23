"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "../ui/button";

export function ArticleCodeBlock({ code, language }: { code: string; language?: string }) {
  const [feedback, setFeedback] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const flash = (message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setFeedback(message);
    timer.current = setTimeout(() => setFeedback(""), 2500);
  };
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Área de transferência indisponível");
      await navigator.clipboard.writeText(code);
      flash("Copiado!");
    } catch { flash("Não foi possível copiar."); }
  };
  const download = () => {
    const sql = language?.toLowerCase() === "sql" || /^\s*(?:--|select\b|update\b|insert\b|create\b|alter\b|delete\b|with\b|begin\b|declare\b)/i.test(code);
    const filename = sql ? "script.sql" : "codigo.txt";
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="community-code-block" aria-label="Bloco de código">
    <div className="community-code-toolbar">
      <span>{language?.toUpperCase() || "Código"}</span>
      <div className="community-code-actions">
        <Button type="button" variant="ghost" size="sm" onClick={() => void copy()} aria-label="Copiar código">{feedback === "Copiado!" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{feedback === "Copiado!" ? "Copiado!" : "Copiar"}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={download} aria-label="Baixar script"><Download size={15} aria-hidden="true" /> Baixar</Button>
      </div>
    </div>
    <pre tabIndex={0} aria-label="Código com rolagem independente"><code>{code}</code></pre>
    <span className="sr-only" role="status">{feedback}</span>
  </section>;
}
