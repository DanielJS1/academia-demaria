"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { normalizeCourse, courseValidationError } from "@/lib/course-activities";
import { ActivityQuestions } from "./activity-questions";
import { PdfAttachmentEditor } from "./pdf-attachment-editor";
import { courseXp, lessonXp } from "@/lib/rewards";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Eye, Plus, Save, Trash2, X } from "lucide-react";
import { useAcademy } from "../academy-provider";
import { Button } from "../ui/button";
import { CourseArt, EmptyState, PageHeading } from "../shared";
import { courseSchema, safeImage, vimeoEmbed, type Course } from "@/lib/model";
import { BRAZILIAN_UFS, ALL_MODULES_MAP } from "@/lib/cartorio-modules";

const uuid = () => crypto.randomUUID();

export function CourseEditor({ id }: { id: string }) {
  const { state, me, update, notify, busy } = useAcademy();
  const router = useRouter();
  const existing = state.courseDrafts.find(course => course.id === id) || state.courses.find(course => course.id === id);
  const [course, setCourse] = useState<Course>(() =>
    existing
      ? normalizeCourse(structuredClone(existing))
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
          logoUrl: "",
          author: "Equipe DOC-Academy",
          department: "",
          audience: "internal",
          requiredModules: [],
          isSelagem: false,
          passingScore: 70,
          retryPolicy: "free",
          hasProficiencyTest: false,
          proficiencyScore: 85,
          proficiencyQuestions: [],
          version: 1,
          lessons: [],
          questions: [],
        }
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [restored, setRestored] = useState(false);
  const [hasLocalDraft, setHasLocalDraft] = useState(false);
  const recoveryKey = `doc-academy.course-draft.${me.id}.${id}`;
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(recoveryKey);
      if (raw) {
        const recovered = JSON.parse(raw);
        const serverVersion = existing?.version || 1;
        const draftVersion = recovered?.version || 1;
        // If server version is strictly higher, local draft is obsolete
        if (existing && serverVersion > draftVersion) {
          sessionStorage.removeItem(recoveryKey);
          setCourse(normalizeCourse(structuredClone(existing)));
          setHasLocalDraft(false);
        } else if (courseSchema.safeParse({ ...recovered, title: "Rascunho", product: "Produto",
          lessons: recovered.lessons?.map((lesson: Course["lessons"][number]) => ({...lesson,title:"Aula"})),
          questions: recovered.questions?.map((question: Course["questions"][number]) => ({...question,prompt:"Pergunta"})),
        }).success) {
          setCourse(normalizeCourse(recovered));
          setHasLocalDraft(true);
        }
      } else if (existing) {
        setCourse(normalizeCourse(structuredClone(existing)));
      }
    } catch {}
    setRestored(true);
  }, [recoveryKey, existing]);
  useEffect(() => {
    if (!restored || saved) return;
    try { sessionStorage.setItem(recoveryKey, JSON.stringify(course)); } catch {}
  }, [course, recoveryKey, restored, saved]);

  if (id !== "novo" && !existing) {
    return <EmptyState title="Curso não encontrado" description="Abra um curso pelo painel administrativo." />;
  }

  const field = <K extends keyof Course>(key: K, value: Course[K]) => {
    setCourse(current => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const save = async (publish: boolean) => {
    if(uploads){notify("Aguarde o envio dos PDFs antes de salvar.");return;}
    const problem = courseValidationError(course, publish);
    if(problem){ setError(problem); notify(problem); return; }

    const success = await update(current => {
      const calculatedXp = courseXp(course);
      if (!publish) {
        return {
          ...current,
          courseDrafts: [...current.courseDrafts.filter(item => item.id !== course.id), { ...course, xp: calculatedXp, status: "draft" }],
        };
      }
      const published: Course = {
        ...course,
        status: "published",
        xp: calculatedXp,
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

    if (!success) {
      setError("Não foi possível salvar. Seus dados continuam no editor; confira a mensagem e tente novamente.");
      return;
    }
    try { sessionStorage.removeItem(recoveryKey); } catch {}
    setError("");
    setSaved(true);
    notify(publish ? "Curso publicado no catálogo." : "Rascunho salvo no servidor.");
    if (publish) router.push("/admin");
    else if (id === "novo") router.replace(`/admin/cursos/${course.id}`);
  };

  const addActivity = () => field("lessons", [...course.lessons, {id:uuid(),title:"Nova atividade",module:"",minutes:5,type:"video",content:"",videoUrl:""}]);

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

      {hasLocalDraft && existing && (
        <div className="notice-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span>Você está visualizando um rascunho recuperado localmente do seu navegador.</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              try { sessionStorage.removeItem(recoveryKey); } catch {}
              setCourse(normalizeCourse(structuredClone(existing)));
              setHasLocalDraft(false);
              notify("Rascunho local descartado. Dados do servidor recarregados com sucesso!");
            }}
          >
            Descartar rascunho local e recarregar do servidor
          </Button>
        </div>
      )}

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
              <div className="field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Produto ou assunto</span>
                  {course.product.trim() && !state.products.includes(course.product.trim()) && (
                    <button
                      type="button"
                      style={{ fontSize: 11, background: "none", border: "none", cursor: "pointer", color: "var(--primary)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}
                      onClick={async () => {
                        const name = course.product.trim();
                        const ok = await update(current => ({
                          ...current,
                          products: [...current.products, name],
                        }));
                        if (ok) notify(`"${name}" adicionado à lista de produtos.`);
                      }}
                    >
                      <Plus size={12} /> Salvar como nova opção
                    </button>
                  )}
                </div>
                <input
                  value={course.product}
                  placeholder="Selecione abaixo ou digite um novo assunto..."
                  list="products-autocomplete"
                  onChange={event => field("product", event.target.value)}
                />
                <datalist id="products-autocomplete">
                  {state.products.map(p => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <div className="product-chips-wrap">
                  {state.products.map(p => (
                    <span key={p} className={`product-chip ${course.product === p ? "is-active" : ""}`}>
                      <button
                        type="button"
                        className="product-chip-name"
                        onClick={() => field("product", p)}
                        title={`Selecionar ${p}`}
                      >
                        {p}
                      </button>
                      <button
                        type="button"
                        className="product-chip-remove"
                        title={`Remover "${p}" da lista`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`Remover "${p}" da lista de produtos e assuntos?`)) {
                            const ok = await update(current => ({
                              ...current,
                              products: current.products.filter(item => item !== p),
                            }));
                            if (ok) {
                              notify(`"${p}" removido da lista.`);
                              if (course.product === p) {
                                const remaining = state.products.filter(item => item !== p);
                                field("product", remaining[0] || "");
                              }
                            }
                          }
                        }}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
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
              <label className="field">
                <span>Setor específico (opcional)</span>
                <select value={course.department || ""} onChange={event => field("department", event.target.value || undefined)}>
                  <option value="">Todos os setores (Geral)</option>
                  {state.departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Público-alvo do curso</span>
                <select
                  value={course.audience || "internal"}
                  onChange={event => field("audience", event.target.value as "internal" | "client" | "both")}
                >
                  <option value="internal">Colaboradores DeMaria (Interno)</option>
                  <option value="client">Clientes Cartórios (Certificação)</option>
                  <option value="both">Ambos os Públicos (Interno e Clientes)</option>
                </select>
                <small>Define se o curso aparecerá para colaboradores internos ou cartórios parceiros.</small>
              </label>

              {(course.audience === "client" || course.audience === "both") && (
                <label className="field">
                  <span>Módulo Vinculado (Opcional)</span>
                  <select
                    value={course.requiredModules?.[0] || ""}
                    onChange={event => field("requiredModules", event.target.value ? [event.target.value] : [])}
                  >
                    <option value="">Geral para todos os clientes</option>
                    {Object.values(ALL_MODULES_MAP).map(mod => (
                      <option key={mod.key} value={mod.key}>
                        [{mod.family}] {mod.code} — {mod.name}
                      </option>
                    ))}
                  </select>
                  <small>Apenas cartórios que contrataram este módulo terão acesso ao curso.</small>
                </label>
              )}
            </div>
            <label className="field">
              <span>Link do banner (opcional)</span>
              <input
                type="text"
                value={course.banner}
                placeholder="https://... ou /banners/..."
                onChange={event => field("banner", event.target.value)}
              />
              <small>Deixe vazio para usar a capa visual da DOC-Academy.</small>
            </label>
            <label className="field">
              <span>Logo central do produto (PNG recomendado)</span>
              <input
                type="text"
                list="preset-logos"
                value={course.logoUrl || ""}
                placeholder="Ex: /logos/doc-mobile.png ou https://..."
                onChange={event => field("logoUrl", event.target.value)}
              />
              <datalist id="preset-logos">
                <option value="/logos/doc-mobile.png">DOC Mobile</option>
              </datalist>
              <small>Substitui as folhas no centro do card. Aceita caminho local (/logos/...), link HTTPS ou Base64 (até 64 KB).</small>
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
                onClick={addActivity}
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
                    <span>Módulo (opcional)</span>
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
                      <option value="video">Vídeo (Vimeo ou YouTube)</option>
                      <option value="quiz">Avaliação</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>
                      Duração estimada (minutos) ·{" "}
                      <strong style={{ color: "var(--accent)", fontWeight: 600 }}>
                        +{lessonXp(lesson.minutes)} XP
                      </strong>
                    </span>
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
                  {(course.audience === "client" || course.audience === "both") && (
                    <label className="field">
                      <span>Variação por UF (Selagem / Estadual)</span>
                      <select
                        value={lesson.ufFilter?.[0] || ""}
                        onChange={event =>
                          field(
                            "lessons",
                            course.lessons.map(item =>
                              item.id === lesson.id
                                ? { ...item, ufFilter: event.target.value ? [event.target.value] : undefined }
                                : item
                            )
                          )
                        }
                      >
                        <option value="">Todas as UFs (Padrão)</option>
                        {BRAZILIAN_UFS.map(uf => (
                          <option key={uf.uf} value={uf.uf}>
                            {uf.uf} — {uf.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {lesson.type === "video" && (
                  <label className="field">
                    <span>Link do Vídeo (Vimeo ou YouTube)</span>
                    <input
                      type="url"
                      value={lesson.videoUrl}
                      placeholder="https://vimeo.com/... ou https://youtu.be/..."
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
                {lesson.type === "quiz" && (
                  <ActivityQuestions
                    title={`Avaliação: ${lesson.title || "Atividade"}`}
                    questions={lesson.questions || []}
                    onChange={questions =>
                      field(
                        "lessons",
                        course.lessons.map(item => (item.id === lesson.id ? { ...item, questions } : item))
                      )
                    }
                  />
                )}
                {lesson.type === "reading" && <PdfAttachmentEditor lesson={lesson} onBusyChange={active=>setUploads(n=>Math.max(0,n+(active?1:-1)))} onChange={attachment=>{setCourse(current=>({...current,lessons:current.lessons.map(item=>item.id===lesson.id?{...item,...attachment}:item)}));setSaved(false);}}/>}
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
            {course.lessons.length >= 2 && <Button variant="secondary" onClick={addActivity}><Plus size={14}/> Adicionar atividade</Button>}
            {!course.lessons.length && <div className="info-note">Adicione a primeira atividade para montar seu curso.</div>}
          </section>

          <section className="panel form-panel">
            <div className="section-title">
              <div>
                <h2>Prova de Proficiência (Aceleração de Conteúdo)</h2>
                <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
                  Permite que colaboradores antigos e experientes comprovem conhecimento prévio e liberem todo o XP do curso imediatamente.
                </p>
              </div>
            </div>

            <label className="checkbox-field" style={{ margin: "14px 0" }}>
              <input
                type="checkbox"
                checked={!!course.hasProficiencyTest}
                onChange={event => field("hasProficiencyTest", event.target.checked)}
              />
              <strong>Habilitar Prova de Proficiência neste curso</strong>
            </label>

            {course.hasProficiencyTest && (
              <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
                <label className="field" style={{ maxWidth: 240 }}>
                  <span>Nota mínima para dispensa (%)</span>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={course.proficiencyScore || 85}
                    onChange={event => field("proficiencyScore", Number(event.target.value))}
                  />
                  <small>Padrão: 85%. Com essa pontuação o aluno conclui o curso de imediato.</small>
                </label>

                <div>
                  <h3 style={{ fontSize: 13, marginBottom: 6 }}>Questões da Prova de Proficiência</h3>
                  <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
                    Cadastre as perguntas de validação. Caso nenhuma seja cadastrada aqui, o sistema utilizará as perguntas das avaliações do curso.
                  </p>
                  <ActivityQuestions
                    title="Prova de Proficiência"
                    questions={course.proficiencyQuestions || []}
                    onChange={questions => field("proficiencyQuestions", questions)}
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="editor-aside">
          <CourseArt course={course} />
          <section className="panel form-panel" style={{ marginTop: 18 }}>
            <h2>Regras e publicação</h2>
            <label className="field">
              <span>XP automático · até {courseXp(course)} XP</span>
              <small>Aulas: 15 XP até 5 min; +5 XP por faixa de 5 min. Conclusão: +30 XP. Avaliação opcional: 5 XP por objetiva correta, 8 XP por dissertativa correta; aprovação +30 XP ou +10 XP após reprovação.</small>
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
            <Button disabled={busy || uploads > 0} variant="secondary" onClick={() => save(false)}>
              <Save size={15} /> Salvar rascunho
            </Button>
            {id !== "novo" && (
              <Button asChild variant="secondary">
                <Link href={`/aprender/${course.id}/aula?previa=1`}>
                  <Eye size={15} /> Ver prévia salva
                </Link>
              </Button>
            )}
            {error && <div className="form-error" role="alert">{error}</div>}
            <Button disabled={busy || uploads > 0} onClick={() => save(true)}>
              <Check size={16} /> Publicar curso
            </Button>
            <div className="info-note">
              Todos os colaboradores veem o conteúdo publicado. Salve o rascunho antes de abrir a prévia. As alterações
              são enviadas ao servidor; uma cópia temporária protege o preenchimento nesta aba.
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
