"use client";
import { useEffect, useState } from "react";
import { browserAuth } from "@/lib/supabase-browser";
import { reportDatasetSchema, reportQuerySchema, type ReportDataset, type ReportQuery } from "@/lib/reports/contracts";
export function useReportData(query: ReportQuery | undefined, userId: string, scopeKey: string, enabled: boolean) {
  const serialized = query ? JSON.stringify(reportQuerySchema.parse(query)) : "";
  const key = `${scopeKey}:${serialized}`;
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; revision: number; data?: ReportDataset; error?: string }>();
  useEffect(() => {
    if (!enabled || !serialized) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const session = (await browserAuth()?.auth.getSession())?.data.session;
        if (!session || session.user.id !== userId) throw new Error("Entre novamente para consultar os relatórios.");
        const response = await fetch(`/api/reports?query=${encodeURIComponent(serialized)}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Não foi possível consultar este relatório.");
        const parsed = reportDatasetSchema.safeParse(body);
        if (!parsed.success) throw new Error("O relatório recebido está incompleto ou em formato inválido. Tente novamente.");
        const data = parsed.data;
        if (data.meta.actorId !== userId || JSON.stringify(data.query) !== serialized) throw new Error("A resposta não corresponde à conta e aos filtros atuais.");
        if (!controller.signal.aborted) setResult({ key, revision, data });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, revision, error: error instanceof Error ? error.message : "Relatório indisponível." });
      }
    })();
    return () => controller.abort();
  }, [serialized, userId, key, revision, enabled]);
  const current = enabled && result?.key === key && result.revision === revision ? result : undefined;
  return { key, data: current?.data, error: current?.error, loading: enabled && !!serialized && !current, retry: () => setRevision(value => value + 1) };
}
