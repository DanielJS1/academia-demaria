"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Eye, Plus, Save, Trash2 } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { CourseArt, EmptyState, PageHeading } from "../shared";
import { courseSchema, safeImage, vimeoEmbed, type Course } from "@/lib/model";

const uuid = () => crypto.randomUUID();

export function CourseEditor({ id }: { id: string }) {
  const { state, update, notify } = useAcademy();
  const router = useRouter();
  const existing = state.courseDrafts.find(course => course.id === id) || state.courses.find(course => course.id === id);
  const [course, setCourse] = useState<Course>(() =>
    existing
      ? structuredClone(existing)
      : {
          id: uuid(),
          title: "",
          description: "",
          product: state.products[0] || "Conhecimentos gerais",
          category: "Produtos",
          level: "Essencial",
          accent: "violet",
          status: "draft",
          xp: 200,
          required: false,
          banner: "",
          author: "Equipe DOC-Academy",
          passingScore: 70,
          retryPolicy: "free",
          version: 1,
          lessons: [],
          questions: [],
        }
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  if (id !== "novo" && !existing) {
    return <EmptyState title="Curso não encontrado" description="Abra um curso pelo painel administrativo." />;
  }

  const field = <K extends keyof Course>(key: K, value: Course[K]) => {
    setCourse(current => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const save = (publish: boolean) => {
    const parsed = courseSchema.safeParse(course);
    if (!parsed.success) {
      setError("Preencha título, produto e valores válidos para atividades, nota e XP.");
      return;
    }
    if (!safeImage(course.banner)) {
      setError("Use um endereço HTTPS válido para o banner.");
      return;
    }
    if (course.lessons.some(lesson => lesson.videoUrl && !vimeoEmbed(lesson.videoUrl))) {
      setError("Confira os links de vídeo: use endereços HTTPS do Vimeo.");
      return;
    }
    if (publish && (!course.lessons.length || course.lessons.some(lesson => !lesson.title.trim() || !lesson.module.trim()))) {
      setError("Adicione ao menos uma atividade com título e módulo antes de publicar.");
      return;
    }
    if (
      publish &&
      course.lessons.some(lesson => lesson.type === "quiz") &&
      (!course.questions.length ||
        course.questions.some(
          question =>
            !question.prompt.trim() ||
            (question.type === "choice" &&
              (question.options.filter(option => option.trim()).length < 2 || !question.options.includes(question.correct)))
        ))
    ) {
      setError("Complete as perguntas e selecione o gabarito das questões objetivas antes de publicar.");
      return;
    }

    update(current => {
      if (!publish) {
        return {
          ...current,
          courseDrafts: [...current.courseDrafts.filter(item => item.id !== course.id), { ...course, status: "draft" }],
        };
      }
      const published: Course = {
        ...course,
        status: "published",
        version: (current.courses.find(item => item.id === course.id)?.version || 0) + 1,
      };
      return {
        ...current,
        courses: current.courses.some(item => item.id === course.id)
          ? current.courses.map(item => (item.id === course.id ? published : item))
          : [...current.courses, published],
        courseDrafts: current.courseDrafts.filter(item => item.id !== course.id),
      };
    });

    setError("");
    setSaved(true);
    notify(publish ? "Curso publicado no catálogo desta demonstração." : "Rascunho salvo. A versão publicada foi preservada.");
    if (publish) router.push("/admin");
    else if (id === "novo") router.replace(`/admin/cursos/${course.id}`);
  };

  const reorder = (index: number, direction: number) => {
    const lessons = [...course.lessons];
    const to = index + direction;
    if (to < 0 || to >= lessons.length) return;
    [lessons[index], lessons[to]] = [lessons[to], lessons[index]];
    field("lessons", lessons);
  };

  return (
    <div className="page-enter">
      <Link href="/admin" className="back-link">
        <ArrowLeft size={15} /> Voltar aos cursos
      </Link>
      <PageHeading
        title={id === "novo" ? "Uma nova jornada começa aqui." : "Dê forma ao aprendizado."}
        description="Organize o conteúdo, revise a experiência e publique quando estiver pronto."
      >
        <span className="pill">{saved ? "Rascunho salvo" : "Editor de curso"}</span>
      </PageHeading>

      {error && <div className="form-error" role="alert">{error}</div>}

      <div className="editor-grid">
        <div>
          <section className="panel form-panel">
            <h2>Sobre o curso</h2>
            <label className="field">
              <span>Título do curso</span>
              <input
                value={course.title}
                maxLength={120}
                placeholder="O que sua equipe vai aprender?"
                onChange={event => field("title", event.target.value)}
              />
            </label>
            <label className="field">
              <span>Descrição</span>
              <textarea
                value={course.description}
                rows={3}
                placeholder="Apresente os objetivos desta jornada."
                onChange={event => field("description", event.target.value)}
              />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Produto ou assunto</span>
                <select value={course.product} onChange={event => field("product", event.target.value)}>
                  {state.products.map(product => (
                    <option key={product}>{product}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Categoria</span>
                <input value={course.category} onChange={event => field("category", event.target.value)} />
              </label>
              <label className="field">
                <span>Nível</span>
                <select value={course.level} onChange={event => field("level", event.target.value)}>
                  <option>Essencial</option>
                  <option>Intermediário</option>
                  <option>Avançado</option>
                </select>
              </label>
              <label className="field">
                <span>Responsável pelo conteúdo</span>
                <input value={course.author} onChange={event => field("author", event.target.value)} />
              </label>
            </div>
            <label className="field">
              <span>Link do banner (HTTPS)</span>
              <input
                type="url"
                value={course.banner}
                placeholder="https://..."
                onChange={event => field("banner", event.target.value)}
              />
              <small>Deixe vazio para usar a capa visual da DOC-Academy.</small>
            </label>
            <div className="field">
              <span>Cor da capa</span>
              <div className="color-options">
                {(["violet", "mint", "peach", "blue", "pink", "slate"] as const).map((color, index) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Capa ${["roxa", "menta", "pêssego", "azul", "rosa", "cinza"][index]}`}
                    aria-pressed={course.accent === color}
                    className={course.accent === color ? "selected" : ""}
                    onClick={() => field("accent", color)}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="panel form-panel">
            <div className="section-title">
              <h2>Programa de atividades</h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  field("lessons", [
                    ...course.lessons,
                    {
                      id: uuid(),
                      title: "Nova atividade",
                      module: "01 · Comece por aqui",
                      minutes: 5,
                      type: "reading",
                      content: "",
                      videoUrl: "",
                    },
                  ])
                }
              >
                <Plus size={14} /> Adicionar atividade
              </Button>
            </div>
            <p>Use as setas para organizar a sequência. Os módulos agrupam atividades com o mesmo nome.</p>
            {course.lessons.map((lesson, index) => (
              <div className="editor-lesson" key={lesson.id}>
                <div className="editor-lesson-head">
                  <span className="pill">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{lesson.title}</strong>
                  <span>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={index === 0}
                      aria-label={`Mover atividade ${index + 1} para cima`}
                      onClick={() => reorder(index, -1)}
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={index === course.lessons.length - 1}
                      aria-label={`Mover atividade ${index + 1} para baixo`}
                      onClick={() => reorder(index, 1)}
                    >
                      <ArrowDown size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remover atividade ${index + 1}`}
                      onClick={() => field("lessons", course.lessons.filter(item => item.id !== lesson.id))}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </span>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Título da atividade</span>
                    <input
                      value={lesson.title}
                      onChange={event =>
                        field(
                          "lessons",
                          course.lessons.map(item => (item.id === lesson.id ? { ...item, title: event.target.value } : item))
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Módulo</span>
                    <input
                      value={lesson.module}
                      onChange={event =>
                        field(
                          "lessons",
                          course.lessons.map(item => (item.id === lesson.id ? { ...item, module: event.target.value } : item))
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Tipo</span>
                    <select
                      value={lesson.type}
                      onChange={event =>
                        field(
                          "lessons",
                          course.lessons.map(item =>
                            item.id === lesson.id
                              ? { ...item, type: event.target.value as "video" | "reading" | "quiz" }
                              : item
                          )
                        )
                      }
                    >
                      <option value="reading">Leitura</option>
                      <option value="video">Vídeo do Vimeo</option>
                      <option value="quiz">Avaliação</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Duração estimada (minutos)</span>
                    <input
                      type="number"
                      min={0}
                      value={lesson.minutes}
                      onChange={event =>
                        field(
                          "lessons",
                          course.lessons.map(item =>
                            item.id === lesson.id ? { ...item, minutes: Number(event.target.value) } : item
                          )
                        )
                      }
                    />
                  </label>
                </div>
                {lesson.type === "video" && (
                  <label className="field">
                    <span>Link do Vimeo</span>
                    <input
                      type="url"
                      value={lesson.videoUrl}
                      placeholder="https://vimeo.com/123456789"
                      onChange={event =>
                        field(
                          "lessons",
                          course.lessons.map(item =>
                            item.id === lesson.id ? { ...item, videoUrl: event.target.value } : item
                          )
                        )
                      }
                    />
                  </label>
                )}
                <label className="field">
                  <span>{lesson.type === "reading" ? "Conteúdo da leitura" : "Descrição da atividade"}</span>
                  <textarea
                    rows={3}
                    value={lesson.content}
                    onChange={event =>
                      field(
                        "lessons",
                        course.lessons.map(item => (item.id === lesson.id ? { ...item, content: event.target.value } : item))
                      )
                    }
                  />
                </label>
              </div>
            ))}
            {!course.lessons.length && <div className="info-note">Adicione a primeira atividade para montar seu curso.</div>}
          </section>

          <section className="panel form-panel">
            <div className="section-title">
              <h2>Avaliação</h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  field("questions", [
                    ...course.questions,
                    { id: uuid(), prompt: "", type: "choice", options: ["", ""], correct: "" },
                  ]);
                  if (!course.lessons.some(lesson => lesson.type === "quiz")) {
                    setCourse(current => ({
                      ...current,
                      lessons: [
                        ...current.lessons,
                        {
                          id: uuid(),
                          title: "Avaliação do curso",
                          module: "Avaliação",
                          minutes: 5,
                          type: "quiz",
                          content: "Confira seu aprendizado e envie as respostas para correção.",
                          videoUrl: "",
                        },
                      ],
                    }));
                  }
                }}
              >
                <Plus size={14} /> Adicionar pergunta
              </Button>
            </div>
            <p>As questões abaixo pertencem à avaliação do curso.</p>
            {course.questions.map((question, index) => (
              <div className="editor-lesson" key={question.id}>
                <div className="editor-lesson-head">
                  <strong>Pergunta {index + 1}</strong>
                  <span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover pergunta ${index + 1}`}
                      onClick={() => field("questions", course.questions.filter(item => item.id !== question.id))}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </span>
                </div>
                <label className="field">
                  <span>Enunciado</span>
                  <textarea
                    value={question.prompt}
                    rows={2}
                    onChange={event =>
                      field(
                        "questions",
                        course.questions.map(item => (item.id === question.id ? { ...item, prompt: event.target.value } : item))
                      )
                    }
                  />
                </label>
                <label className="field">
                  <span>Tipo de resposta</span>
                  <select
                    value={question.type}
                    onChange={event =>
                      field(
                        "questions",
                        course.questions.map(item =>
                          item.id === question.id ? { ...item, type: event.target.value as "choice" | "text" } : item
                        )
                      )
                    }
                  >
                    <option value="choice">Múltipla escolha</option>
                    <option value="text">Discursiva</option>
                  </select>
                </label>
                {question.type === "choice" && (
                  <>
                    <label className="field">
                      <span>Alternativas (uma por linha)</span>
                      <textarea
                        rows={3}
                        value={question.options.join("\n")}
                        onChange={event =>
                          field(
                            "questions",
                            course.questions.map(item =>
                              item.id === question.id
                                ? { ...item, options: event.target.value.split("\n"), correct: "" }
                                : item
                            )
                          )
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Resposta correta</span>
                      <select
                        value={question.correct}
                        onChange={event =>
                          field(
                            "questions",
                            course.questions.map(item =>
                              item.id === question.id ? { ...item, correct: event.target.value } : item
                            )
                          )
                        }
                      >
                        <option value="">Selecione o gabarito</option>
                        {question.options
                          .filter(option => option.trim())
                          .map((option, optionIndex) => (
                            <option key={optionIndex}>{option}</option>
                          ))}
                      </select>
                    </label>
                  </>
                )}
              </div>
            ))}
          </section>
        </div>

        <aside className="editor-aside">
          <CourseArt course={course} />
          <section className="panel form-panel" style={{ marginTop: 18 }}>
            <h2>Regras e publicação</h2>
            <label className="field">
              <span>XP por aprovação</span>
              <input
                type="number"
                min={0}
                max={10000}
                value={course.xp}
                onChange={event => field("xp", Number(event.target.value))}
              />
            </label>
            <label className="field">
              <span>Nota mínima (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={course.passingScore}
                onChange={event => field("passingScore", Number(event.target.value))}
              />
            </label>
            <label className="field">
              <span>Após uma reprovação</span>
              <select
                value={course.retryPolicy}
                onChange={event => field("retryPolicy", event.target.value as Course["retryPolicy"])}
              >
                <option value="free">Permitir nova tentativa</option>
                <option value="review">Revisar as aulas antes de tentar</option>
                <option value="admin">Aguardar liberação do administrador</option>
              </select>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={course.required}
                onChange={event => field("required", event.target.checked)}
              />
              Destacar como essencial
            </label>
            <Button variant="secondary" onClick={() => save(false)}>
              <Save size={15} /> Salvar rascunho
            </Button>
            {id !== "novo" && (
              <Button asChild variant="secondary">
                <Link href={`/aprender/${course.id}/aula?previa=1`}>
                  <Eye size={15} /> Ver prévia salva
                </Link>
              </Button>
            )}
            <Button onClick={() => save(true)}>
              <Check size={16} /> Publicar curso
            </Button>
            <div className="info-note">
              Todos os colaboradores veem o conteúdo publicado. Salve o rascunho antes de abrir a prévia. As alterações
              ficam neste navegador.
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
