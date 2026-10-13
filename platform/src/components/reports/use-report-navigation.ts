"use client";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { readReportLocation, reportLocationParams, type ReportLocation } from "@/lib/reports/navigation";
export function useReportNavigation() {
  const params = useSearchParams();
  const serialized = params.toString();
  const parsed = useMemo(() => {
    try { return { location: readReportLocation(new URLSearchParams(serialized)), error: undefined }; }
    catch (error) { return { location: undefined, error: error instanceof Error && error.name !== "ZodError" ? error.message : "Filtros da URL inválidos. Restaure os filtros para continuar." }; }
  }, [serialized]);
  const change = (next: ReportLocation) => { const url = new URL(window.location.href); url.search = reportLocationParams(next).toString(); window.history.pushState(null, "", url); };
  return { ...parsed, change };
}
