"use client";

import Link from "next/link";
import { Check, Pencil } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { initials, normalize } from "@/lib/utils";

export function AdminPeople({ search }: { search: string }) {
  const { state, me, update, mutate, notify, busy } = useAcademy();
  const filtered = state.people.filter(person => normalize(person.name).includes(normalize(search)));

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>PESSOA</th>
              <th>SETOR</th>
              <th>PERFIL</th>
              <th>SITUAÇÃO</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(person => (
              <tr key={person.id}>
                <td>
                  <div className="table-person">
                    <span className="avatar">{initials(person.name)}</span>
                    <div>
                      <strong>{person.name}</strong>
                      <small>{person.email}</small>
                    </div>
                  </div>
                </td>
                <td>{person.department}</td>
                <td>
                  {person.role === "admin"
                    ? "Administrador"
                    : person.role === "manager"
                    ? "Gestor"
                    : "Colaborador"}
                </td>
                <td>
                  <span className={`pill ${person.status === "active" ? "green" : person.status === "pending" ? "amber" : ""}`}>
                    {person.status === "active"
                      ? "Ativo"
                      : person.status === "pending"
                      ? "Aguardando aprovação"
                      : "Inativo / reprovado"}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    {person.id !== me.id && <>
                      {person.status === "pending" && <Button size="sm" variant="secondary" disabled={busy} onClick={async () => {
                        if (!window.confirm(`Reprovar o cadastro de ${person.name}? O acesso ficará bloqueado.`)) return;
                        if (await mutate({type:"reject-user",id:person.id})) notify("Cadastro reprovado; acesso bloqueado.");
                      }}>Reprovar</Button>}
                      <Button size="sm" variant="ghost" disabled={busy} onClick={async () => {
                        if (!window.confirm(`Excluir definitivamente ${person.name} (${person.email}), incluindo progresso, avaliações e XP? Esta ação não pode ser desfeita.`)) return;
                        if (await mutate({type:"delete-user",id:person.id})) notify("Usuário excluído.");
                      }}>Excluir</Button>
                    </>}
                    {person.status === "pending" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={async () => {
                          const success = await update(current => ({
                            ...current,
                            people: current.people.map(p =>
                              p.id === person.id ? { ...p, status: "active" } : p
                            ),
                          }));
                          if (success) notify(`Acesso de ${person.name} aprovado com sucesso!`);
                        }}
                      >
                        <Check size={13} /> Aprovar
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="icon">
                      <Link href={`/admin/pessoas/${person.id}`} aria-label={`Editar ${person.name}`}>
                        <Pencil size={16} />
                      </Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="info-note">
        Novos colaboradores cadastrados na tela inicial aparecem como &ldquo;Aguardando aprovação&rdquo;. Clique em &ldquo;Aprovar&rdquo; para liberar o acesso ao catálogo.
      </div>
    </>
  );
}
