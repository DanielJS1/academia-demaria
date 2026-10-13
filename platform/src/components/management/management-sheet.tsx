"use client";
import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { Person } from "@/lib/model";
import { managementReportLink, type ManagementAction, type ManagementSignal } from "@/lib/management";
import { formatReportDate } from "@/lib/reports/presentation";
import { deadlineKind, formatTrailDate } from "@/lib/trails";
import { useTrails } from "../trails/trails-provider";
import { DataState } from "../layout/data-state";
import { Button } from "../ui/button";
import { ManagementForms } from "./management-forms";
export function ManagementSheet({ person, action, assignmentId, signal, back, onAction, onClose }: { person: Person; action: ManagementAction; assignmentId?: string; signal?: ManagementSignal; back?: string | null; onAction: (action: ManagementAction) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), titleId = useId(); const trails = useTrails();
  useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; dialog.current?.showModal(); return () => { document.body.style.overflow = previous; }; }, []);
  const assignments = trails.data?.assignments.filter(a => a.userId === person.id) ?? [];
  const reportReturn = back ? `&retorno=${encodeURIComponent(managementReportLink(person.id, back))}` : "";
  const invalidAssignment = !!assignmentId && !assignments.some(a => a.id === assignmentId);
  return <dialog ref={dialog} className="management-sheet" aria-labelledby={titleId} onClose={onClose}><header><div><h2 id={titleId}>{person.name}</h2><p>{person.department} · {person.email}</p></div><Button type="button" variant="ghost" size="icon" aria-label="Fechar ficha" onClick={() => dialog.current?.close()}><X aria-hidden="true" /></Button></header>
    <nav aria-label="Seções da ficha">{([["pdi","Acompanhamento"],["conquista","Conquistas"],["trilhas","Trilhas"]] as const).map(([id,label]) => <Button key={id} type="button" variant={action === id ? "default" : "secondary"} aria-pressed={action === id} onClick={() => onAction(id)}>{label}</Button>)}</nav>
    {action === "pdi" && <p className="management-presence">Último acesso conhecido: {signal?.lastAccessAt ? formatReportDate(signal.lastAccessAt) : "Sem histórico verificável"}. {signal?.reason}</p>}
    {action !== "trilhas" ? <ManagementForms key={action} person={person} kind={action} /> : trails.loading ? <DataState state="loading" title="Carregando atribuições…" /> : trails.error ? <DataState state="error" description={trails.error} onRetry={() => void trails.refresh()} /> : invalidAssignment ? <DataState state="error" description="Atribuição inexistente ou fora do escopo deste colaborador." /> : <section aria-label="Trilhas do colaborador"><h3>Trilhas atribuídas</h3><p>Gerencie prazos e lembretes no fluxo existente. Abrir esta ficha não envia avisos.</p>{assignments.length ? <ul className="management-assignment-list">{assignments.filter(a => !assignmentId || a.id === assignmentId).map(a => <li key={a.id}><strong>{a.title}</strong><p>{!a.active ? "Cancelada" : a.complete ? "Concluída" : deadlineKind(a, true) === "overdue" ? "Prazo vencido" : "Em acompanhamento"} · prazo: {formatTrailDate(a.dueDate)}</p><Button asChild variant="secondary"><Link href={`/equipe/trilhas?aba=assignments&pessoa=${encodeURIComponent(person.id)}&atribuicao=${encodeURIComponent(a.id)}${reportReturn}`}>Gerir esta atribuição</Link></Button></li>)}</ul> : <p>Nenhuma trilha atribuída.</p>}<Button asChild variant="secondary"><Link href={`/equipe/trilhas?aba=assignments&pessoa=${encodeURIComponent(person.id)}${reportReturn}`}>Atribuir trilha e administrar lembretes</Link></Button></section>}
    <footer><Button asChild variant="secondary"><Link href={managementReportLink(person.id, back)}>Ver relatório individual</Link></Button><Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>Fechar ficha</Button></footer>
  </dialog>;
}
