"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, FileText, Save } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { EmptyState, PageHeading } from "../shared";
import { articleSchema, type Article } from "@/lib/model";

const uuid = () => crypto.randomUUID();

export function ArticleEditor({ id }: { id: string }) {
  const { state, update, notify } = useAcademy();
  const router = useRouter();
  const existing = state.articleDrafts.find(item => item.id === id) || state.articles.find(item => item.id === id);
  const [article, setArticle] = useState<Article>(() =>
    existing
      ? structuredClone(existing)
      : {
          id: uuid(),
          title: "",
          product: state.products[0] || "DOC-Academy",
          category: "Guia",
          content: "",
          status: "draft",
          revision: 1,
          author: "Equipe DOC-Academy",
          updatedAt: new Date().toISOString().slice(0, 10),
        }
  );
  const [error, setError] = useState("");

  if (id !== "novo" && !existing) {
    return <EmptyState title="Material não encontrado" description="Volte ao painel de conhecimento." />;
  }

  const save = (publish: boolean) => {
    if (!articleSchema.safeParse(article).success || (publish && !article.content.trim())) {
      setError("Informe um título com pelo menos três caracteres e conteúdo antes de publicar.");
      return;
    }

    update(current => {
      if (!publish) {
        return {
          ...current,
          articleDrafts: [...current.articleDrafts.filter(item => item.id !== article.id), { ...article, status: "draft" }],
        };
      }
      const published: Article = {
        ...article,
        status: "published",
        updatedAt: new Date().toISOString().slice(0, 10),
        revision: (current.articles.find(item => item.id === article.id)?.revision || 0) + 1,
      };
      return {
        ...current,
        articles: current.articles.some(item => item.id === article.id)
          ? current.articles.map(item => (item.id === article.id ? published : item))
          : [...current.articles, published],
        articleDrafts: current.articleDrafts.filter(item => item.id !== article.id),
      };
    });

    notify(publish ? "Artigo publicado na biblioteca." : "Rascunho salvo. A versão publicada foi preservada.");
    setError("");
    if (publish) router.push("/admin?aba=conhecimento");
    else if (id === "novo") router.replace(`/admin/conhecimento/${article.id}`);
  };

  return (
    <div className="page-enter">
      <Link href="/admin?aba=conhecimento" className="back-link">
        <ArrowLeft size={15} /> Voltar aos materiais
      </Link>
      <PageHeading
        title="Compartilhe uma descoberta."
        description="Transforme informações em conhecimento acessível para toda a equipe."
      />
      <div className="editor-grid">
        <section className="panel form-panel">
          {error && <div className="form-error" role="alert">{error}</div>}
          <label className="field">
            <span>Título do artigo</span>
            <input
              value={article.title}
              maxLength={150}
              onChange={event => setArticle({ ...article, title: event.target.value })}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Produto</span>
              <select
                value={article.product}
                onChange={event => setArticle({ ...article, product: event.target.value })}
              >
                {state.products.map(item => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Categoria</span>
              <input
                value={article.category}
                onChange={event => setArticle({ ...article, category: event.target.value })}
              />
            </label>
          </div>
          <label className="field">
            <span>Responsável</span>
            <input
              value={article.author}
              onChange={event => setArticle({ ...article, author: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Conteúdo</span>
            <textarea
              style={{ minHeight: 360 }}
              value={article.content}
              placeholder="Escreva o material que deseja compartilhar..."
              onChange={event => setArticle({ ...article, content: event.target.value })}
            />
            <small>
              Texto simples com parágrafos. A importação de documentos e a indexação para IA serão integradas posteriormente.
            </small>
          </label>
        </section>

        <aside className="panel form-panel editor-aside">
          <FileText size={28} color="var(--primary)" />
          <h2 style={{ marginTop: 16 }}>Conhecimento compartilhado</h2>
          <p>A publicação fica disponível para todos os colaboradores.</p>
          <Button variant="secondary" onClick={() => save(false)}>
            <Save size={15} /> Salvar rascunho
          </Button>
          <Button onClick={() => save(true)}>
            <Check size={15} /> Publicar artigo
          </Button>
          <div className="info-note">
            Demonstração local. Use materiais de teste; ainda não há banco compartilhado nem controle de acesso real.
          </div>
        </aside>
      </div>
    </div>
  );
}
