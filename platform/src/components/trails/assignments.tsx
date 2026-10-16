"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { managedPeople } from "@/lib/team-scope";
import { DataState } from "../layout/data-state";
import { CheckCircle2, Clock3, AlertTriangle, Users } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { useTrails } from "./trails-provider";
import { MemberPicker } from "./member-picker";
import { Button } from "../ui/button";
import { daysUntil, formatTrailDate, type Assignment } from "@/lib/trails";

export function Assignments() {
  const { data, command, saving } = useTrails(); const { state, me, notify } = useAcademy();
  const params = useSearchParams(), personId = params.get("pessoa"), assignmentId = params.get("atribuicao");
  const person = managedPeople(state.people, me).find(p => p.id === personId);
  const selectedAssignment = data?.assignments.find(a => a.id === assignmentId && a.userId === personId && !!person);
  const [trailId, setTrailId] = useState(""), [ids, setIds] = useState<string[]>([]), [dueDate, setDueDate] = useState("");
  const [learnerDays, setLearnerDays] = useState(data?.policy.learnerDays ?? 7), [managerDays, setManagerDays] = useState(data?.policy.managerDays ?? 2);
  const [review, setReview] = useState(false), [editing, setEditing] = useState<Assignment>();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID()), [success, setSuccess] = useState("");
  const [filterTrail, setFilterTrail] = useState(""), [search, setSearch] = useState(""), [status, setStatus] = useState("active");
  useEffect(() => { setIds(person ? [person.id] : []); setReview(false); setRequestId(crypto.randomUUID()); }, [person?.id]);
  useEffect(() => { setEditing(selectedAssignment); if (selectedAssignment) { setStatus("all"); setFilterTrail(""); setSearch(""); } }, [selectedAssignment?.id]);
  const trail = data?.trails.find(t => t.id === trailId);
  const members = state.people.filter(p => ids.includes(p.id));
  const assignments = data?.assignments ?? [];
  const overdue = assignments.filter(a => a.active && !a.complete && daysUntil(a.dueDate) < 0);
  const visible = assignments.filter(a => (!personId || a.userId === personId) && (!assignmentId || a.id === assignmentId) && (!filterTrail || a.trailId === filterTrail) && (status === "all" || status === "active" && a.active || status === "overdue" && overdue.some(item => item.id === a.id) || status === "complete" && a.active && a.complete || status === "cancelled" && !a.active) && `${state.people.find(p => p.id === a.userId)?.name ?? ""} ${a.title}`.toLowerCase().includes(search.toLowerCase()));
  const changed = () => { setReview(false); setRequestId(crypto.randomUUID()); setSuccess(""); };
  const confirm = async () => {
    if (await command({ type: "assign", requestId, trailId, userIds: ids, dueDate, learnerDays, managerDays })) {
      setSuccess(`Trilha atribuída a ${members.map(p => p.name).join(", ")}.`); setFilterTrail(trailId); setSearch(members.length === 1 ? members[0].name : ""); setStatus("active"); setIds([]); setReview(false); setRequestId(crypto.randomUUID());
    }
  };
  if ((personId && !person) || (assignmentId && !selectedAssignment)) return <DataState state="error" description="Atribuição inexistente ou fora da equipe ativa autorizada."/>;
  return <>
    <div className="trail-metrics"><div><Users size={24}/><strong>{assignments.filter(a => a.active).length}</strong><span>Trilhas atribuídas</span></div><div><Clock3 size={24}/><strong>{assignments.filter(a => a.active && !a.complete).length}</strong><span>Ainda precisam concluir</span></div><div><AlertTriangle size={24}/><strong>{overdue.length}</strong><span>Com prazo vencido</span></div><div><CheckCircle2 size={24}/><strong>{assignments.filter(a => a.active && a.complete).length}</strong><span>Concluídas</span></div></div>
    {success && <p className="trail-success" role="status">{success} Confira o resultado no acompanhamento abaixo.</p>}
    {!review ? <form className="panel trail-form" onSubmit={e => { e.preventDefault(); if (!members.length || !trail) return; if (assignments.some(a => a.active && a.trailId === trailId && ids.includes(a.userId))) { notify("Uma pessoa selecionada já tem esta trilha. Confira o acompanhamento antes de continuar."); return; } setReview(true); }}>
      <h2>Enviar uma trilha para a equipe</h2><p className="trail-help">Escolha a trilha, marque as pessoas e confira os destinatários antes de enviar.</p>
      <h3>1. Escolha o que será aprendido</h3><label>Trilha<select required value={trailId} onChange={e => { setTrailId(e.target.value); changed(); }}><option value="">Escolha uma trilha</option>{data?.trails.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
      {trail && <div className="trail-selection-summary"><strong>{trail.courseIds.length} cursos nesta trilha</strong><ol>{trail.courseIds.map(id => <li key={id}>{state.courses.find(c => c.id === id)?.title ?? "Curso indisponível"}</li>)}</ol></div>}
      <h3>2. Escolha quem deve fazer a trilha</h3><MemberPicker ids={ids} setIds={value => { setIds(value); changed(); }}/>
      <h3>3. Defina o prazo</h3><label>Concluir até<input required type="date" value={dueDate} onChange={e => { setDueDate(e.target.value); changed(); }}/></label>
      <details className="trail-reminders"><summary>Lembretes: colaborador {learnerDays} dia(s) antes · gestor {managerDays} dia(s) antes</summary><p className="trail-help">Defina quando avisar cada pessoa antes do prazo. Zero significa avisar no próprio dia. Os canais são configurados na aba Configurações.</p><div className="trail-form-grid"><NumberField label="Avisar colaborador (dias antes)" value={learnerDays} set={value => { setLearnerDays(value); changed(); }}/><NumberField label="Avisar gestor (dias antes)" value={managerDays} set={value => { setManagerDays(value); changed(); }}/></div></details>
      <p className="trail-help">Cursos já concluídos contam para a trilha. Alterar o setor não atribui a trilha a ninguém.</p><Button type="submit" disabled={saving || !ids.length || !trailId}>Revisar envio para {ids.length} pessoa(s)</Button>
    </form> : <section className="panel trail-form" aria-label="Revisar destinatários"><h2>Confira antes de enviar</h2><div className="trail-selection-summary"><h3>{trail?.title}</h3><p>{trail?.courseIds.length} cursos · Concluir até <strong>{formatTrailDate(dueDate)}</strong></p><p>Lembretes: colaborador {learnerDays} dia(s) antes · gestor {managerDays} dia(s) antes</p></div><h3>Esta trilha será enviada somente a {members.length} pessoa(s):</h3><ul className="trail-review-members">{members.map(p => <li key={p.id}><CheckCircle2 size={20}/><span><strong>{p.name}</strong><small>{p.department} · {p.role === "manager" ? "Gestor" : p.role === "admin" ? "Administrador" : "Colaborador"}</small></span></li>)}</ul><div className="trail-actions"><Button type="button" disabled={saving} onClick={() => void confirm()}>{saving ? "Enviando…" : `Confirmar envio para ${members.length} pessoa(s)`}</Button><Button type="button" variant="secondary" disabled={saving} onClick={() => setReview(false)}>Voltar e corrigir seleção</Button></div></section>}
    <section className="panel trail-table"><h2>Acompanhamento das trilhas enviadas</h2><p className="trail-help">Cada linha corresponde a uma pessoa que já recebeu uma trilha. Use os filtros para localizar o envio desejado.</p><div className="trail-form-grid"><label>Trilha<select value={filterTrail} onChange={e => setFilterTrail(e.target.value)}><option value="">Todas as trilhas</option>{data?.trails.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label><label>Buscar pessoa<input placeholder="Nome do colaborador" value={search} onChange={e => setSearch(e.target.value)}/></label><label>Situação<select value={status} onChange={e => setStatus(e.target.value)}><option value="active">Trilhas ativas</option><option value="overdue">Prazo vencido</option><option value="complete">Concluídas</option><option value="cancelled">Canceladas</option><option value="all">Todas as situações</option></select></label></div><p className="trail-help">{visible.length} atribuição(ões) encontradas</p>
      <div className="trail-assignment-cards">{visible.map(a => <article className="trail-assignment-card" key={a.id}><div><h3>{state.people.find(p => p.id === a.userId)?.name ?? "Colaborador"}</h3><p>{a.title}</p><small>{state.people.find(p => p.id === a.userId)?.department} · Enviada em {new Date(a.createdAt).toLocaleDateString("pt-BR")}</small></div><div><strong>{a.completedCourses} de {a.totalCourses} cursos concluídos · {a.progress}%</strong><progress value={a.progress} max={100} aria-label={`Progresso de ${state.people.find(p => p.id === a.userId)?.name} em ${a.title}`}/></div><div className="trail-actions"><span className={`trail-status ${a.active && !a.complete && daysUntil(a.dueDate) < 0 ? "late" : ""}`}>{!a.active ? "Cancelada" : a.complete ? "Concluída" : daysUntil(a.dueDate) < 0 ? "Prazo vencido" : "Em andamento"}</span><strong>Prazo: {formatTrailDate(a.dueDate)}</strong><Button type="button" variant="secondary" onClick={() => setEditing(a)}>Alterar prazo e avisos</Button></div>{editing?.id === a.id && <AssignmentEditor key={a.id + a.revision} assignment={a} onClose={() => setEditing(undefined)}/>}</article>)}</div>{!visible.length && <p>Nenhuma atribuição encontrada. Tente outro nome, trilha ou situação.</p>}
    </section>
  </>;
}
function AssignmentEditor({ assignment: a, onClose }: { assignment: Assignment; onClose: () => void }) {
  const { command, saving } = useTrails(); const { state, me, notify } = useAcademy();
  const [dueDate, setDueDate] = useState(a.dueDate), [learnerDays, setLearnerDays] = useState(a.learnerDays), [managerDays, setManagerDays] = useState(a.managerDays), [active, setActive] = useState(a.active);
  const name = state.people.find(p => p.id === a.userId)?.name ?? "Colaborador";
  return <form className="trail-form trail-assignment-editor" onSubmit={async e => { e.preventDefault(); if (await command({ type: "assignment", id: a.id, expectedRevision: a.revision, dueDate, learnerDays, managerDays, active })) { notify(`Alterações salvas para ${name}.`); onClose(); } }}><h3>Alterar somente a trilha de {name}</h3><p>{a.title}</p><p className="trail-help">Aqui você altera o prazo e os lembretes desta pessoa. Os cursos e o progresso permanecem registrados.</p><div className="trail-form-grid"><label>Concluir até<input required type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}/></label><NumberField label="Avisar colaborador (dias antes)" value={learnerDays} set={setLearnerDays}/><NumberField label="Avisar gestor (dias antes)" value={managerDays} set={setManagerDays}/><label>Situação da atribuição<select value={active ? "active" : "cancelled"} onChange={e => setActive(e.target.value === "active")}><option value="active">Ativa — manter a trilha e os lembretes</option><option value="cancelled">Cancelar — retirar a cobrança e os lembretes</option></select></label></div>{!active && <p className="trail-help">Ao salvar, a atribuição será cancelada somente para {name}. O aprendizado já realizado será preservado.</p>}<div className="trail-actions"><Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar alterações desta pessoa"}</Button><Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Fechar sem salvar</Button></div></form>;
}
function NumberField({ label, value, set }: { label: string; value: number; set: (value: number) => void }) { return <label>{label}<input required type="number" min={0} max={365} value={Number.isNaN(value) ? "" : value} onChange={e => set(e.target.valueAsNumber)}/></label>; }
