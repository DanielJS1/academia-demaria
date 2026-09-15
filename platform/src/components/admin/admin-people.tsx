"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { initials, normalize } from "@/lib/utils";

export function AdminPeople({ search }: { search: string }) {
  const { state } = useAcademy();
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
                  <span className={`pill ${person.status === "active" ? "green" : "amber"}`}>
                    {person.status === "active"
                      ? "Exemplo ativo"
                      : person.status === "pending"
                      ? "Convite não enviado"
                      : "Inativo"}
                  </span>
                </td>
                <td>
                  <Button asChild variant="ghost" size="icon">
                    <Link href={`/admin/pessoas/${person.id}`} aria-label={`Editar ${person.name}`}>
                      <Pencil size={16} />
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="info-note">
        Os cadastros são locais. Esta versão não cria acessos reais nem envia convites por e-mail.
      </div>
    </>
  );
}
