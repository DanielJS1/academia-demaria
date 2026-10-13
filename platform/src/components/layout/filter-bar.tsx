"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { FieldGroup, FieldLegend, FieldSet } from "../ui/field";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export function FilterBar({ label = "Filtros", children, actions, advanced, busy = false }: {
  label?: string; children: ReactNode; actions?: ReactNode; advanced?: ReactNode; busy?: boolean;
}) {
  return <section className="filter-bar" aria-label={label} aria-busy={busy}>
    <FieldSet><FieldLegend>{label}</FieldLegend><FieldGroup>{children}</FieldGroup></FieldSet>
    {advanced && <details className="filter-bar-advanced"><summary>Mais filtros</summary><FieldGroup>{advanced}</FieldGroup></details>}
    {actions && <div className="filter-bar-actions">{actions}</div>}
  </section>;
}

export type AppliedFilter = { id: string; label: string; value: string; onRemove?: () => void };
export function AppliedFilters({ filters, onClear, disabled = false }: { filters: readonly AppliedFilter[]; onClear?: () => void; disabled?: boolean }) {
  if (!filters.length) return null;
  return <div className="applied-filters" role="group" aria-label="Filtros aplicados">
    <span className="applied-filters-label">Filtros aplicados:</span>
    {filters.map(filter => <div className="applied-filter" key={filter.id}>
      <Badge variant="outline"><span>{filter.label}: {filter.value}</span></Badge>
      {filter.onRemove && <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Remover filtro ${filter.label}: ${filter.value}`} onClick={filter.onRemove}><X aria-hidden="true" data-icon="inline-start" /></Button>}
    </div>)}
    {onClear && <Button type="button" variant="ghost" disabled={disabled} onClick={onClear}>Limpar filtros</Button>}
  </div>;
}
