"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { normalize } from "@/lib/utils";

export function AdminConfig() {
  return (
    <div className="config-columns">
      <ConfigList
        kind="departments"
        title="Setores e departamentos"
        description="Organize as equipes e seus relatórios."
      />
      <ConfigList
        kind="products"
        title="Produtos e assuntos"
        description="Organize o catálogo e a biblioteca."
      />
    </div>
  );
}

export function ConfigList({
  kind,
  title,
  description,
}: {
  kind: "departments" | "products";
  title: string;
  description: string;
}) {
  const { state, update, notify } = useAcademy();
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState("");

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const name = value.trim();
    if (!name || state[kind].some(item => normalize(item) === normalize(name) && item !== editing)) {
      notify("Use um nome diferente dos cadastros existentes.");
      return;
    }
    update(current => ({
      ...current,
      [kind]: editing ? current[kind].map(item => (item === editing ? name : item)) : [...current[kind], name],
      ...(editing && kind === "departments"
        ? {
            people: current.people.map(person =>
              person.department === editing ? { ...person, department: name } : person
            ),
          }
        : {}),
      ...(editing && kind === "products"
        ? {
            courses: current.courses.map(course =>
              course.product === editing ? { ...course, product: name } : course
            ),
            courseDrafts: current.courseDrafts.map(course =>
              course.product === editing ? { ...course, product: name } : course
            ),
            articles: current.articles.map(article =>
              article.product === editing ? { ...article, product: name } : article
            ),
            articleDrafts: current.articleDrafts.map(article =>
              article.product === editing ? { ...article, product: name } : article
            ),
          }
        : {}),
    }));
    setValue("");
    setEditing("");
    notify("Cadastro atualizado nesta demonstração.");
  };

  return (
    <section className="panel form-panel">
      <h2>{title}</h2>
      <p>{description}</p>
      {state[kind].map(item => (
        <div className="config-item" key={item}>
          <span>{item}</span>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Renomear ${item}`}
              onClick={() => {
                setEditing(item);
                setValue(item);
              }}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Excluir ${item}`}
              title={`Excluir ${item}`}
              onClick={async () => {
                if (confirm(`Remover "${item}" definitivamente desta lista?`)) {
                  const ok = await update(current => ({
                    ...current,
                    [kind]: current[kind].filter(i => i !== item),
                  }));
                  if (ok) notify(`"${item}" removido com sucesso.`);
                }
              }}
            >
              <X size={14} />
            </Button>
          </div>
        </div>
      ))}
      <form className="inline-form" onSubmit={save}>
        <input
          className="input"
          aria-label={editing ? `Novo nome de ${editing}` : `Adicionar em ${title}`}
          placeholder={editing ? "Novo nome" : "Novo cadastro"}
          required
          maxLength={80}
          value={value}
          onChange={event => setValue(event.target.value)}
        />
        <Button type="submit" size="sm">
          {editing ? "Salvar" : "Adicionar"}
        </Button>
      </form>
      {editing && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditing("");
            setValue("");
          }}
        >
          Cancelar alteração
        </Button>
      )}
    </section>
  );
}
