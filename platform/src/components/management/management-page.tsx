"use client";
import { useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { managedPeople } from "@/lib/team-scope";
import { managementAction, type ManagementAction } from "@/lib/management";
import { normalize } from "@/lib/utils";
import { formatReportDate } from "@/lib/reports/presentation";
import { useAcademy } from "../academy-provider";
import { PageHeading } from "../layout/page-heading";
import { MetricCard } from "../layout/metric-card";
import { FilterBar } from "../layout/filter-bar";
import { DataState } from "../layout/data-state";
import { Button } from "../ui/button";
import { ReportSelect } from "../reports/report-filters";
import { useManagementSignals } from "./use-management-signals";
import { ManagementSheet } from "./management-sheet";
export function ManagementPage() {
  const { state, me, isClientEnvironment } = useAcademy(); const params = useSearchParams();
  const focus = useRef<HTMLDivElement>(null), opener = useRef<HTMLElement | null>(null);
  const people = managedPeople(state.people, me, "operational"), active = people.filter(p => p.status === "active");
  const forbidden = isClientEnvironment || me.audience === "client" || me.role === "student" || state.people.some(p => p.id === me.id && p.status !== "active");
  const data = useManagementSignals(people, !forbidden);
  const pending = params.get("lista") === "pendentes", filter = params.get("filtro") ?? "all", department = params.get("setor") ?? "all", search = params.get("busca") ?? "", page = Number(params.get("pagina") ?? 1);
  const selectedId = params.get("pessoa"), assignmentId = params.get("atribuicao") ?? undefined;
  let action: ManagementAction = "pdi", error: string | undefined;
  try { action = managementAction(params.get("acao")); } catch { error = "Ação de gestão inválida."; }
  const known = ["pessoa","acao","atribuicao","retorno","lista","filtro","setor","busca","pagina"];
  for (const key of params.keys()) if (!known.includes(key) || params.getAll(key).length !== 1) error = "Parâmetros de gestão inválidos.";
  if (!["all","late","contact"].includes(filter) || ![null,"ativos","pendentes"].includes(params.get("lista")) || !Number.isInteger(page) || page < 1 || page > 400 || search.length > 200) error = "Filtros de gestão inválidos.";
  const selected = active.find(p => p.id === selectedId);
  if (selectedId && !selected) error = "Colaborador inexistente, inativo, pendente ou fora da equipe autorizada.";
  if ((params.has("acao") || assignmentId) && !selectedId) error = "Selecione um colaborador ativo para abrir a ficha.";
  if (assignmentId && action !== "trilhas") error = "Atribuições são abertas na seção Trilhas.";
  const departments = [...new Set(people.map(p => p.department.trim()))].sort((a,b) => a.localeCompare(b,"pt-BR"));
  if (department !== "all" && !departments.some(d => d.toLowerCase() === department.toLowerCase())) error = "Departamento fora do escopo autorizado.";
  const change = (values: Record<string,string | undefined>, replace = false) => { const next = new URLSearchParams(params); for (const [key,value] of Object.entries(values)) value === undefined ? next.delete(key) : next.set(key,value); const url = `/equipe${next.size ? `?${next}` : ""}`; replace ? history.replaceState(null,"",url) : history.pushState(null,"",url); };
  const metricHref = (value: string) => { const next = new URLSearchParams(params); next.set("filtro",value); next.delete("lista"); next.delete("pagina"); return `/equipe?${next}`; };
  const shown = people.filter(p => p.status === (pending ? "pending" : "active") && (department === "all" || p.department.trim().toLowerCase() === department.toLowerCase()) && normalize(`${p.name} ${p.email}`).includes(normalize(search)) && (pending || filter === "all" || (filter === "late" ? data.signals.get(p.id)?.overdue : data.signals.get(p.id)?.contact) === true)).sort((a,b) => a.name.localeCompare(b.name,"pt-BR") || a.id.localeCompare(b.id));
  const pages = Math.max(1,Math.ceil(shown.length/25)); const visible = shown.slice((page-1)*25,page*25);
  const signals = active.map(p => data.signals.get(p.id));
  const cards = [{label:"Equipe",value:active.length,filter:"all",unknown:0}, {label:"Com atrasos",value:signals.filter(s => s?.overdue === true).length,filter:"late",unknown:signals.filter(s => s?.overdue == null).length}, {label:"Precisam de contato",value:signals.filter(s => s?.contact === true).length,filter:"contact",unknown:signals.filter(s => s?.contact == null).length}];
  if (forbidden) return <DataState state="error" title="Acesso restrito" description="Minha gestão é exclusiva para gestores internos ativos." />;
  return <div className="management-page page-enter" ref={focus} tabIndex={-1}>
    <PageHeading variant="compact" title="Minha gestão" description={departments.length === 1 ? `Equipe de ${departments[0]}. Acompanhe combinados e reconheça entregas.` : "Gerencie sua equipe, os combinados e as conquistas."}><Button asChild><Link href="/equipe/trilhas">Trilhas e avisos</Link></Button><Button asChild variant="secondary"><Link href="/equipe/relatorios">Ver relatórios</Link></Button></PageHeading>
    <div className="management-metrics">{cards.map(card => <a key={card.filter} href={metricHref(card.filter)} aria-label={`Filtrar ${card.label.toLowerCase()}`} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); change({filtro:card.filter,lista:undefined,pagina:undefined}); } }}><MetricCard label={card.label} context={card.filter === "all" ? "Colaboradores ativos autorizados" : "Pessoas, sem somar alertas sobrepostos"} {...(card.unknown ? {state:"partial" as const,value:card.unknown === active.length ? null : card.value,reason:`${card.unknown} pessoa(s) sem cobertura suficiente.`} : {value:card.value})} /></a>)}</div>
    <nav className="management-population" aria-label="Situação dos colaboradores"><Button type="button" variant={!pending ? "default" : "secondary"} aria-pressed={!pending} onClick={() => change({lista:undefined,pagina:undefined})}>Ativos ({active.length})</Button><Button type="button" variant={pending ? "default" : "secondary"} aria-pressed={pending} onClick={() => change({lista:"pendentes",filtro:"all",pagina:undefined})}>Pendentes ({people.filter(p=>p.status==="pending").length})</Button></nav>
    <FilterBar><label className="management-search">Buscar colaborador<input type="search" value={search} maxLength={200} placeholder="Nome ou e-mail" onChange={event=>change({busca:event.target.value||undefined,pagina:undefined},true)} /></label>{departments.length>1 && <ReportSelect label="Departamento" value={departments.find(d=>d.toLowerCase()===department.toLowerCase()) ?? department} onChange={value=>change({setor:value==="all"?undefined:value,pagina:undefined})}><option value="all">Todos os departamentos</option>{departments.map(d=><option key={d} value={d}>{d}</option>)}</ReportSelect>}<ReportSelect label="Acompanhamento" disabled={pending} value={filter} onChange={value=>change({filtro:value,pagina:undefined})}><option value="all">Toda a equipe</option><option value="late">Com atrasos</option><option value="contact">Precisam de contato</option></ReportSelect></FilterBar>
    {error && <section><DataState state="error" description={error} /><Button variant="secondary" type="button" onClick={()=>history.replaceState(null,"","/equipe")}>Restaurar gestão</Button></section>}
    {data.error && <DataState state="error" title="Parte dos sinais está indisponível" description={data.error} onRetry={data.retry} />}
    {data.loading && <p role="status">Atualizando os sinais operacionais…</p>}
    <p className="management-help">Uma pessoa pode ter atraso e precisar de contato. Falta de histórico não comprova inatividade. {pending ? "Aprovação de cadastros continua na administração." : "PDI e conquistas ficam em Gerir; análises detalhadas ficam em Relatórios."}</p>
    {!error && <section className="panel management-list" aria-label="Equipe operacional"><p>{shown.length} colaboradores neste recorte · 25 por página</p><div className="management-table-scroll" role="region" tabIndex={0} aria-label="Colaboradores, com rolagem horizontal"><table><thead><tr><th scope="col">Colaborador / departamento</th><th scope="col">Acompanhamento</th><th scope="col">Último acesso conhecido</th><th scope="col">Ação</th></tr></thead><tbody>{visible.map(person=>{const signal=data.signals.get(person.id);return <tr key={person.id}><td><strong>{person.name}</strong><small>{person.department}</small></td><td>{person.status==="pending"?"Aguardando aprovação":<><span>{signal?.overdue===true?"Prazo vencido":signal?.overdue===null?"Prazos indisponíveis":"Sem atraso confirmado"}</span><small>{signal?.reason??"Consultando presença"}</small></>}</td><td>{signal?.lastAccessAt?formatReportDate(signal.lastAccessAt):"Sem histórico verificável"}</td><td><Button type="button" variant="secondary" disabled={person.status!=="active"} aria-label={`Gerir ${person.name}`} onClick={event=>{opener.current=event.currentTarget;change({pessoa:person.id,acao:"pdi",atribuicao:undefined});}}>Gerir</Button></td></tr>;})}</tbody></table></div>{!visible.length && <DataState state="empty" title="Nenhum colaborador neste recorte" description="Revise a busca e os filtros. Sem registros disponíveis não significa ausência de participação." />}<nav className="management-pagination" aria-label="Páginas dos colaboradores"><Button variant="secondary" disabled={page<=1} onClick={()=>change({pagina:String(page-1)})}>Anterior</Button><span>Página {page} de {pages}</span><Button variant="secondary" disabled={page>=pages} onClick={()=>change({pagina:String(page+1)})}>Próxima</Button></nav></section>}
    {!error && selected && <ManagementSheet key={`${me.id}:${me.role}:${me.department}:${selected.id}`} person={selected} action={action} assignmentId={assignmentId} signal={data.signals.get(selected.id)} back={params.get("retorno")} onAction={acao=>change({acao,atribuicao:undefined})} onClose={()=>{change({pessoa:undefined,acao:undefined,atribuicao:undefined,retorno:undefined});requestAnimationFrame(()=>{(opener.current?.isConnected?opener.current:focus.current)?.focus();});}} />}
  </div>;
}
