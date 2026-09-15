"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { normalize } from "@/lib/utils";

export function AdminArticles({ search }: { search: string }) {
  const { state } = useAcademy();
  const articles = [
    ...state.articles,
    ...state.articleDrafts.filter(draft => !state.articles.some(article => article.id === draft.id)),
  ];

  const filtered = articles.filter(article => normalize(article.title).includes(normalize(search)));

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>MATERIAL</th>
            <th>PRODUTO</th>
            <th>STATUS</th>
            <th>VERSÃO</th>
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(article => (
            <tr key={article.id}>
              <td>
                <strong>{article.title}</strong>
                <small>{article.category}</small>
              </td>
              <td>{article.product}</td>
              <td>
                <span className={`pill ${article.status === "published" ? "green" : "amber"}`}>
                  {article.status === "published" ? "Publicado" : "Rascunho"}
                </span>
                {state.articleDrafts.some(draft => draft.id === article.id) && article.status === "published" && (
                  <small>Alterações em rascunho</small>
                )}
              </td>
              <td>v{article.revision}</td>
              <td>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/admin/conhecimento/${article.id}`}>
                    <Pencil size={13} /> Editar
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
