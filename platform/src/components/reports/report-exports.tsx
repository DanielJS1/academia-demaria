"use client";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Download, Printer } from "lucide-react";
import type { ReportDataset, ReportRow } from "@/lib/reports/contracts";
import type { Plot, ReportColumn } from "@/lib/reports/presentation";
import type { ReportLocation } from "@/lib/reports/navigation";
import { reportCsv } from "@/lib/reports/export";
import { reportDay } from "@/lib/reports/periods";
import { Button } from "../ui/button";
import { ReportPrintDocument } from "./report-print-document";
export function ReportExports({ data, columns, rows, requestKey, location, plots }: { data?: ReportDataset; columns: ReportColumn[]; rows: ReportRow[]; requestKey: string; location?: ReportLocation; plots: Plot[] }) {
  const [printKey, setPrintKey] = useState<string>();
  const [error, setError] = useState<{ key: string; message: string }>();
  const printed = useRef<string | null>(null);
  const printing = !!data && printKey === requestKey;
  useEffect(() => {
    const before = () => {
      if (!data || !rows.length || document.querySelector(".cert-modal-overlay")) return;
      printed.current = requestKey;
      flushSync(() => setPrintKey(requestKey));
    };
    const after = () => { setPrintKey(undefined); printed.current = null; };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, [data, requestKey, rows.length]);
  useEffect(() => {
    if (!printing || !data || printed.current === printKey) return;
    printed.current = printKey!;
    const frame = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(frame);
  }, [printing, printKey, data]);
  const exportCsv = () => {
    if (!data || !rows.length || !location) return;
    try {
      const csv = reportCsv(data, columns, rows, location);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = `demaria-${data.query.view}-${reportDay(new Date(data.meta.generatedAt))}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError(undefined);
    } catch (cause) { setError({ key: requestKey, message: cause instanceof Error ? cause.message : "Não foi possível gerar o CSV. Tente novamente." }); }
  };
  return <>
    <div className="reports-export-controls report-controls"><div className="reports-export-actions"><Button type="button" variant="secondary" disabled={!data || !rows.length || !location} onClick={exportCsv}><Download size={16} aria-hidden="true" />Baixar CSV</Button><Button type="button" variant="secondary" title="Abre a impressão do navegador; escolha Salvar como PDF" disabled={!data || !rows.length || !location || printing} onClick={() => { printed.current = null; setPrintKey(requestKey); }}><Printer size={16} aria-hidden="true" />Salvar em PDF</Button></div><p className="reports-export-help">PDF: escolha “Salvar como PDF” na janela de impressão.</p>{error?.key === requestKey && <p role="alert">{error.message}</p>}</div>
    {printing && data && location && <ReportPrintDocument data={data} rows={rows} columns={columns} location={location} plots={plots} />}
  </>;
}
