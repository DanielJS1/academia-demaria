"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { EmptyState, PageHeading } from "../shared";
import { personSchema, type Person } from "@/lib/model";
import { normalize } from "@/lib/utils";
import { DEPARTMENTS } from "@/lib/departments";

const uuid = () => crypto.randomUUID();

export function PersonEditor({ id }: { id: string }) {
  const { state, me, update, mutate, notify, busy } = useAcademy();
  const router = useRouter();
  const existing = state.people.find(person => person.id === id);
  const [person, setPerson] = useState<Person>(() =>
    existing
      ? { ...existing }
      : {
          id: uuid(),
          name: "",
          email: "",
          department: "",
          managerId: me?.id || "daniel",
          role: "student",
          status: "pending",
          xp: 0,
          progress: 0,
        }
  );
  const [error, setError] = useState("");
  const [method, setMethod] = useState("invite");
  const [initialPassword, setInitialPassword] = useState("");

  if (id !== "novo" && !existing) {
    return <EmptyState title="Cadastro não encontrado" description="Volte à lista de pessoas." />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!personSchema.safeParse(person).success) {
      setError("Confira o nome e o endereço de e-mail.");
      return;
    }
    if (state.people.some(item => item.id !== person.id && normalize(item.email) === normalize(person.email))) {
      setError("Este e-mail já está cadastrado.");
      return;
    }

    const success = existing
      ? await update(current => ({
          ...current,
          people: current.people.map(item => (item.id === person.id ? person : item)),
        }))
      : await mutate({
          type: "invite",
          name: person.name,
          email: person.email,
          department: person.department,
          managerId: person.managerId,
          role: person.role,
          ...(method === "password" ? { temporaryPassword: initialPassword } : {}),
        });

    if (!success) return;
    setInitialPassword("");
    notify(
      existing
        ? "Cadastro atualizado."
        : method === "password"
        ? "Acesso criado. Compartilhe a senha inicial diretamente com a pessoa."
        : "Convite enviado. A pessoa receberá um e-mail para definir sua senha."
    );
    router.push("/admin?aba=pessoas");
  };

  return (
    <div className="page-enter">
      <Link className="back-link" href="/admin?aba=pessoas">
        <ArrowLeft size={15} /> Voltar às pessoas
      </Link>
      <PageHeading
        title={existing ? "Cada pessoa, uma jornada." : "Abra espaço para uma nova jornada."}
        description="Cadastre a pessoa e organize seu vínculo com a equipe."
      />
      <form className="panel form-panel" style={{ maxWidth: 760 }} onSubmit={handleSubmit}>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-grid">
          <label className="field">
            <span>Nome</span>
            <input
              required
              minLength={2}
              value={person.name}
              onChange={event => setPerson({ ...person, name: event.target.value })}
            />
          </label>
          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              required
              disabled={!!existing}
              value={person.email}
              onChange={event => setPerson({ ...person, email: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Departamento</span>
            <select
              value={person.department}
              onChange={event => {
                const newDept = event.target.value;
                const deptManager = state.people.find(
                  p => p.department === newDept && p.role === "manager" && p.status === "active" && p.id !== person.id
                );
                setPerson(current => ({
                  ...current,
                  department: newDept,
                  managerId: current.role === "student" && deptManager ? deptManager.id : current.managerId,
                }));
              }}
            >
              <option value="">Selecione o setor</option>
              {person.department && !DEPARTMENTS.some(d => d === person.department) && <option value={person.department}>{person.department} (atualizar)</option>}
              {DEPARTMENTS.map(item => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Gestor responsável direto</span>
            <select
              value={person.managerId}
              onChange={event => setPerson({ ...person, managerId: event.target.value })}
            >
              <option value="">Nenhum (Gestão automática por setor)</option>
              {state.people
                .filter(item => item.role !== "student")
                .map(item => (
                  <option value={item.id} key={item.id}>
                    {item.name} ({item.department})
                  </option>
                ))}
            </select>
            <small>Gestores do mesmo setor do colaborador também o visualizam automaticamente na tela Minha equipe.</small>
          </label>
          <label className="field">
            <span>Perfil</span>
            <select
              value={person.role}
              onChange={event => setPerson({ ...person, role: event.target.value as Person["role"] })}
            >
              <option value="student">Colaborador</option>
              <option value="manager">Gestor de Setor / Equipe</option>
              <option value="admin">Administrador Geral</option>
            </select>
            {person.role === "manager" && (
              <small style={{ color: "var(--primary)", fontWeight: 600, marginTop: 4 }}>
                ✓ Como Gestor(a), terá acesso à tela &ldquo;Minha equipe&rdquo; e acompanhará os colaboradores do setor {person.department ? `"${person.department}"` : "(selecione o departamento)"}.
              </small>
            )}
          </label>
          <label className="field">
            <span>Situação do acesso</span>
            <select
              value={person.status}
              onChange={event => setPerson({ ...person, status: event.target.value as Person["status"] })}
            >
              <option value="pending">Pendente</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>
        </div>

        {!existing && (
          <>
            <label className="field">
              <span>Como criar o acesso</span>
              <select value={method} onChange={e => setMethod(e.target.value)}>
                <option value="invite">Enviar convite por e-mail</option>
                <option value="password">Criar com senha inicial (piloto)</option>
              </select>
            </label>
            {method === "password" && (
              <label className="field">
                <span>Senha inicial · mínimo 12 caracteres</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  value={initialPassword}
                  onChange={e => setInitialPassword(e.target.value)}
                />
                <small>Entregue a senha diretamente à pessoa. Ela poderá trocá-la em Minha senha.</small>
              </label>
            )}
          </>
        )}

        <div className="info-note" style={{ margin: "0 0 20px" }}>
          Todos os perfis mantêm a área de aprendizado. Escolha entre convite por e-mail ou senha inicial para testar o piloto.
        </div>
        <Button disabled={busy} type="submit">
          <Save size={16} /> Salvar cadastro
        </Button>
      </form>
    </div>
  );
}
