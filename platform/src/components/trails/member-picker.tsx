"use client";
import { useState } from "react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { canManagePerson } from "@/lib/trails";

export function MemberPicker({ ids, setIds }: { ids: string[]; setIds: (value: string[]) => void }) {
  const { state, me } = useAcademy();
  const [sector, setSector] = useState(""), [search, setSearch] = useState(""), [includeManagers, setIncludeManagers] = useState(false);
  const people = state.people.filter(p => canManagePerson({ ...me, department: me.department ?? "" }, p));
  const visible = people.filter(p => (includeManagers || p.role !== "manager") && (!sector || p.department === sector) && `${p.name} ${p.email}`.toLowerCase().includes(search.toLowerCase()));
  const selected = people.filter(p => ids.includes(p.id));
  return <fieldset className="trail-member-picker">
    <legend>Quem vai receber? ({selected.length} selecionados)</legend>
    <p className="trail-help">Marque os nomes desejados. O setor e a busca servem apenas para encontrar pessoas.</p>
    <div className="trail-form-grid"><label>Filtrar por setor<select value={sector} onChange={e => setSector(e.target.value)}><option value="">Todos os setores da minha equipe</option>{[...new Set(people.map(p => p.department))].sort().map(d => <option key={d}>{d}</option>)}</select></label><label>Buscar pelo nome<input value={search} placeholder="Digite o nome do colaborador" onChange={e => setSearch(e.target.value)}/></label></div>
    <div className="trail-picker-toolbar"><label className="trail-check"><input type="checkbox" checked={includeManagers} onChange={e => setIncludeManagers(e.target.checked)}/> Incluir gestores na lista</label><Button type="button" variant="secondary" disabled={!visible.length} onClick={() => setIds([...new Set([...ids, ...visible.map(p => p.id)])])}>Marcar todos os {visible.length} nomes exibidos</Button></div>
    <div className="trail-course-picker">{visible.map(p => <label className={`trail-check trail-member-row ${ids.includes(p.id) ? "is-selected" : ""}`} key={p.id}><input type="checkbox" checked={ids.includes(p.id)} onChange={e => setIds(e.target.checked ? [...new Set([...ids, p.id])] : ids.filter(id => id !== p.id))}/><span>{p.name}<small>{p.department} · {p.role === "manager" ? "Gestor" : p.role === "admin" ? "Administrador" : "Colaborador"}</small></span></label>)}{!visible.length && <p>Nenhuma pessoa encontrada com esses filtros.</p>}</div>
    <div className="trail-selection-summary" aria-live="polite"><strong>{selected.length ? `Pessoas selecionadas: ${selected.length}` : "Nenhuma pessoa selecionada"}</strong><p className="trail-help">A lista abaixo mostra todos os selecionados, inclusive de outros setores.</p><div className="trail-selected-names">{selected.map(p => <Button key={p.id} type="button" variant="secondary" onClick={() => setIds(ids.filter(id => id !== p.id))} aria-label={`Remover ${p.name} da seleção`}>{p.name} · {p.department} ×</Button>)}</div>{ids.length > 0 && <Button type="button" variant="ghost" onClick={() => setIds([])}>Desmarcar todos</Button>}</div>
  </fieldset>;
}
