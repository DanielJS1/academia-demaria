"use client";

import { useId, type ReactNode } from "react";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";

type MetricValue = string | number | null;
export type MetricCardProps = { label: string; context?: string; action?: ReactNode } & (
  | { state?: "available"; value: MetricValue; reason?: never }
  | { state: "partial"; value: MetricValue; reason: string }
  | { state: "loading"; value?: never; reason?: never }
  | { state: "unavailable"; value?: never; reason: string }
);

export function MetricCard(props: MetricCardProps) {
  const titleId = useId();
  const state = props.state ?? "available";
  const value = state === "loading" || state === "unavailable" ? null : props.value;
  return <article className="metric-card" aria-labelledby={titleId} aria-busy={state === "loading"}>
    <h2 id={titleId} className="metric-card-label">{props.label}</h2>
    {state === "loading" ? <><Skeleton className="metric-card-placeholder" /><span className="sr-only">Carregando {props.label.toLowerCase()}…</span></> :
      <p className="metric-card-value">{value ?? "—"}<span className="sr-only">{value === null ? state === "unavailable" ? " Indisponível" : " Sem dados" : ""}</span></p>}
    {props.context && <p className="metric-card-context">{props.context}</p>}
    {(state === "partial" || state === "unavailable") && <div className="metric-card-coverage"><Badge variant="outline">{state === "partial" ? "Dados parciais" : "Indisponível"}</Badge><p>{props.reason}</p></div>}
    {props.action && <div className="metric-card-action">{props.action}</div>}
  </article>;
}
