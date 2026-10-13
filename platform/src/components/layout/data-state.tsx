"use client";

import { useId, type ReactNode } from "react";
import { CircleAlert, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { EmptyState } from "./empty-state";

export type DataStateProps =
  | { state: "loading"; title?: string; description?: string }
  | { state: "empty"; title: string; description: string; action?: ReactNode }
  | { state: "error" | "partial"; title?: string; description: string; onRetry?: () => void; retrying?: boolean; children?: ReactNode };

export function DataState(props: DataStateProps) {
  const titleId = useId();
  const descriptionId = useId();
  if (props.state === "empty") return <div className="data-state"><EmptyState title={props.title} description={props.description}>{props.action}</EmptyState></div>;
  if (props.state === "loading") return <section className="data-state data-state-loading" role="status" aria-busy="true" aria-labelledby={titleId}>
    <h2 id={titleId}>{props.title ?? "Carregando dados…"}</h2>
    {props.description && <p>{props.description}</p>}
    <div className="data-state-placeholders" aria-hidden="true"><Skeleton /><Skeleton /><Skeleton /></div>
  </section>;
  const error = props.state === "error";
  const Icon = error ? CircleAlert : Info;
  return <div className="data-state">
    <Alert variant={error ? "destructive" : "default"} role={error ? "alert" : "status"} aria-labelledby={titleId} aria-describedby={descriptionId}>
      <Icon aria-hidden="true" />
      <div className="data-state-message"><AlertTitle id={titleId}>{props.title ?? (error ? "Não foi possível carregar os dados" : "Alguns dados estão indisponíveis")}</AlertTitle>
        <AlertDescription id={descriptionId}>{props.description}</AlertDescription>
        {props.onRetry && <Button type="button" variant="secondary" disabled={props.retrying} onClick={props.onRetry}>{props.retrying ? "Tentando…" : "Tentar novamente"}</Button>}
      </div>
    </Alert>
    {props.state === "partial" && props.children}
  </div>;
}
