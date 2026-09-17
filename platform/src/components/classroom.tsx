"use client";
import { activityQuestions } from "@/lib/course-activities";
import { LessonPdf } from "./lesson-pdf";
import Link from "next/link";
import { lessonXp } from "@/lib/rewards";
import { VimeoLesson } from "./vimeo-lesson";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Award, Check, CheckCircle2, ChevronLeft, Clock3, Eye, FileText, LockKeyhole, Maximize2, Minimize2, PanelRightClose, PanelRightOpen, PlayCircle, Send } from "lucide-react";
import { useAcademy } from "./academy-provider";
import { Button } from "./ui/button";
import { EmptyState, Progress } from "./shared";
import { completeActivity, courseProgress, vimeoEmbed, type Attempt } from "@/lib/model";
import { LessonNotepad } from "./lesson-notepad";
import { QuizRunner } from "./quiz-runner";
export function Classroom({ id, initialLesson, preview = false }: { id: string; initialLesson?: string; preview?: boolean }) {
  const { state, me, ready, update, mutate, notify, busy, activeCartorio } = useAcademy();
  const rawCourse = (preview ? state.courseDrafts.find(item => item.id === id) : undefined) || state.courses.find(item => item.id === id && (item.status === "published" || preview));
  const cartorioUf = activeCartorio?.uf;
  const course = rawCourse ? {
    ...rawCourse,
    lessons: rawCourse.lessons.filter(l => !l.ufFilter || l.ufFilter.length === 0 || !cartorioUf || l.ufFilter.includes(cartorioUf))
  } : undefined;
  const [selected, setSelected] = useState(initialLesson || ""); const [answers, setAnswers] = useState<Record<string, string>>({}); const [retrying, setRetrying] = useState(false); const [focusMode, setFocusMode] = useState(false); const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  if (!ready) return <div className="empty-state">Abrindo sua sala de aula…</div>;
  if (!course || !course.lessons.length) return <EmptyState title="Uma jornada em preparação" description="Este curso ainda não possui atividades publicadas para sua região ou módulos."><Button asChild variant="secondary"><Link href="/aprender">Voltar ao catálogo</Link></Button></EmptyState>;
  const lesson = course.lessons.find(item => item.id === selected) || course.lessons[0]; const index = course.lessons.findIndex(item => item.id === lesson.id);
  const done = state.completed[id] || []; const progress = courseProgress(course, done, cartorioUf);
  const questions = activityQuestions(course,lesson);
  const matchesQuiz = (attempt: Attempt) => attempt.quizId===lesson.id || (!attempt.quizId && course.lessons.find(l=>l.type==="quiz")?.id===lesson.id);
  const prerequisitesDone = course.lessons.slice(0,index).every(l=>l.type!=="quiz" ? done.includes(l.id) : state.attempts.some(a=>a.courseId===id&&a.courseVersion===course.version&&a.userId===me.id&&a.status==="approved"&&(a.quizId===l.id||(!a.quizId&&course.lessons.find(x=>x.type==="quiz")?.id===l.id))));
  const latest = [...state.attempts].reverse().find(attempt => attempt.courseId === id && attempt.userId === me.id && attempt.courseVersion === course.version && matchesQuiz(attempt));
  const canRetry = latest?.status === "retry" && (latest.retryPolicy !== "admin" || latest.retryAllowed) && prerequisitesDone;
  const activityDone = (item: typeof lesson) => item.type!=="quiz" ? done.includes(item.id) : state.attempts.some(a=>a.courseId===id&&a.courseVersion===course.version&&a.userId===me.id&&a.status==="approved"&&(a.quizId===item.id||(!a.quizId&&course.lessons.find(l=>l.type==="quiz")?.id===item.id)));
  const embed = vimeoEmbed(lesson.videoUrl);
  const select = (lessonId: string) => { setSelected(lessonId); setAnswers({}); setRetrying(false); const url = new URL(window.location.href); url.searchParams.set("aula", lessonId); window.history.replaceState({}, "", url); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (preview) { notify("Prévia: nenhuma resposta, nota ou experiência foi registrada."); return; }
    if (!prerequisitesDone || !questions.length || questions.some(question => !answers[question.id]?.trim())) { notify("Conclua as aulas e responda todas as questões antes de enviar."); return; }
    const success=await mutate({type:"submit",courseId:id,version:course.version,quizId:lesson.id,answers:{...answers}});
    if(!success)return;setRetrying(false);notify("Avaliação enviada. A correção aparecerá nesta atividade.");
  };
  return <div className="page-enter"><div className="classroom-top-actions"><Link className="back-link" href={preview ? `/admin/cursos/${id}` : `/aprender/${id}`}><ArrowLeft size={15}/>{preview ? "Voltar ao editor" : course.title}</Link><Button variant="ghost" size="sm" className="focus-toggle-btn" onClick={() => setFocusMode(v => !v)} title={focusMode ? "Exibir a lateral completa" : "Modo foco (encolher lateral)"}>{focusMode ? <PanelRightOpen size={16}/> : <PanelRightClose size={16}/>}<span>{focusMode ? "Exibir a lateral" : "Modo foco (encolher lateral)"}</span></Button></div>{preview && <div className="notice-bar"><Eye size={17}/><span>Pré-visualização. Sua participação, XP e avaliações não serão alterados.</span></div>}<div className={`player-grid ${focusMode ? "focus-mode" : ""}`}><div>
    {lesson.type === "quiz" ? latest && !retrying && !preview ? <section className="result-card"><span className="pill">AVALIAÇÃO</span><div style={{ marginTop: 20 }}>{latest.status === "pending" ? <Clock3 size={31}/> : <Award size={31}/>}</div><h2 style={{ marginTop: 16 }}>{latest.status === "pending" ? "Mais um passo concluído." : latest.status === "approved" ? "Seu aprendizado merece uma conquista." : "Toda evolução tem uma nova tentativa."}</h2><p>{latest.status === "pending" ? "Suas respostas estão aguardando correção. Assim que o resultado for publicado, você poderá consultar o feedback aqui." : latest.status === "approved" ? "Você foi aprovado nesta avaliação. Seu XP já foi registrado." : "Confira o feedback e siga as orientações para continuar."}</p>{latest.score !== null && <div className="result-score">{latest.score}<small style={{ fontSize: 15, color: "var(--muted)", letterSpacing: 0 }}> / 100</small></div>}{latest.feedback && <div className="feedback">{latest.feedback}</div>}{latest.status === "pending" && me.role === "admin" && <Button asChild variant="secondary"><Link href="/admin?aba=correcoes">Abrir correções <ArrowRight size={15}/></Link></Button>}{latest.status === "approved" && (index < course.lessons.length-1 ? <Button onClick={()=>select(course.lessons[index+1].id)}>Próxima atividade <ArrowRight size={16}/></Button> : <Button asChild><Link href="/conquistas">Ver minha evolução <Award size={16}/></Link></Button>)}{latest.status === "retry" && <><div className="info-note">{latest.retryPolicy === "admin" && !latest.retryAllowed ? "Uma nova tentativa depende de liberação pelo administrador." : latest.retryPolicy === "review" && !prerequisitesDone ? "Revise e conclua novamente as aulas deste curso antes da próxima tentativa." : "Conclua as atividades anteriores para realizar uma nova tentativa."}</div><Button style={{ marginTop: 18 }} disabled={!canRetry} onClick={() => { setRetrying(true); setAnswers({}); }}>Iniciar nova tentativa</Button></>}</section> : !prerequisitesDone && !preview ? <div className="panel reading-card"><div className="info-note"><LockKeyhole size={15}/> Conclua as aulas anteriores e obtenha aprovação nas avaliações anteriores para enviar esta etapa.</div></div> : <QuizRunner course={course} questions={questions} quizId={lesson.id} preview={preview} onComplete={() => setRetrying(false)}/>
    : lesson.type === "video" ? <>{embed ? <VimeoLesson key={lesson.id} course={course} lesson={lesson} preview={preview} nextTitle={course.lessons[index + 1]?.title} onNext={index < course.lessons.length - 1 ? () => select(course.lessons[index + 1].id) : undefined}/> : <div className="video-placeholder"><PlayCircle size={55} strokeWidth={1}/><h2>Um novo aprendizado vem aí.</h2><p>Este espaço está pronto para receber o vídeo da aula. Adicione um link do Vimeo no editor do curso.</p><Link href={`/admin/cursos/${id}`}>Cadastrar vídeo <ArrowRight size={14}/></Link></div>}</> : <article className="reading-card"><span className="eyebrow">PAUSA PARA APRENDER</span><h2>{lesson.title}</h2><div className="prose">{lesson.content}</div>{lesson.attachmentPath&&<LessonPdf key={lesson.id} courseId={id} lessonId={lesson.id} preview={preview} name={lesson.attachmentName||"Material da aula"}/>}</article>}
    <div className="activity-summary"><span className={`pill ${activityDone(lesson) ? "green" : ""}`}>{activityDone(lesson) ? <><CheckCircle2 size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}/>Atividade concluída · XP registrado</> : lesson.type === "quiz" ? "Acertos: +5 / +8 XP · aprovação: +30 XP ou +10 XP na recuperação" : `+${lessonXp(lesson.minutes)} XP nesta aula`}</span><span className="eyebrow">{lesson.module}</span><h1>{lesson.title}</h1><p><Clock3 size={12} style={{ display: "inline", verticalAlign: "middle" }}/> {lesson.minutes} min · {lesson.type === "quiz" ? "Avaliação" : lesson.type === "video" ? "Videoaula" : "Leitura"}</p></div><div className="activity-actions"><Button variant="secondary" disabled={index === 0} onClick={() => select(course.lessons[index - 1].id)}><ArrowLeft size={15}/> Anterior</Button>{lesson.type !== "quiz" && <Button disabled={busy || (!preview && lesson.type === "video" && !done.includes(lesson.id))} onClick={async () => { if (!preview && lesson.type === "reading") { const saved = await update(current => completeActivity(current, id, lesson.id)); if (!saved) return; } if (index < course.lessons.length - 1) select(course.lessons[index + 1].id); }}><Check size={16}/>{done.includes(lesson.id) && !preview ? "Continuar" : "Concluir e continuar"}</Button>}</div><LessonNotepad courseId={id} courseTitle={course.title} lesson={lesson} allLessons={course.lessons} /></div>
    {focusMode ? (
      <aside
        className="curriculum-dock"
        onMouseLeave={() => setHoveredIndex(null)}
        aria-label="Atividades do curso (modo foco)"
      >
        <div className="dock-header">
          <button
            type="button"
            className="dock-expand-btn"
            onClick={() => setFocusMode(false)}
            title="Exibir lateral completa"
            aria-label="Exibir lateral completa"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="dock-progress-pill">{progress}%</span>
        </div>
        <div className="dock-items-wrap">
          {course.lessons.map((item, position) => {
            const isCurrent = item.id === lesson.id;
            const isDone = activityDone(item);
            const dist = hoveredIndex === null ? null : Math.abs(hoveredIndex - position);

            let scale = 1;
            let transX = 0;
            let zIndex = 1;

            if (dist === 0) {
              scale = 1.34;
              transX = -12;
              zIndex = 20;
            } else if (dist === 1) {
              scale = 1.18;
              transX = -7;
              zIndex = 10;
            } else if (dist === 2) {
              scale = 1.08;
              transX = -3;
              zIndex = 5;
            }

            const Icon = isDone
              ? CheckCircle2
              : item.type === "video"
              ? PlayCircle
              : item.type === "quiz"
              ? Award
              : FileText;

            return (
              <div
                key={item.id}
                className="dock-item-container"
                style={{
                  transform: `scale(${scale}) translateX(${transX}px)`,
                  zIndex,
                  transition: "transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
                onMouseEnter={() => setHoveredIndex(position)}
              >
                <button
                  type="button"
                  className={`dock-item-btn ${isCurrent ? "is-current" : ""} ${isDone ? "is-done" : ""}`}
                  onClick={() => select(item.id)}
                  aria-label={`${item.title} (${item.type})`}
                >
                  <Icon size={18} />
                </button>
                {hoveredIndex === position && (
                  <div className="dock-floating-tooltip" role="tooltip">
                    <span className="dock-tooltip-title">{item.title}</span>
                    <span className="dock-tooltip-meta">
                      {isDone ? (
                        <span style={{ color: "#5bcea9" }}>✓ Concluída</span>
                      ) : (
                        `${item.minutes} min · ${item.type === "video" ? "Vídeo" : item.type === "quiz" ? "Avaliação" : "Leitura"}`
                      )}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    ) : (
      <aside className="curriculum panel">
        <h2>Seu caminho</h2>
        <span className="pill">+30 XP ao concluir o curso</span>
        <p>{course.title}</p>
        <div className="card-progress">
          <div>
            <span>Aulas concluídas</span>
            <strong>{progress}%</strong>
          </div>
          <Progress value={progress} />
        </div>
        {course.lessons.map((item, position) => (
          <div key={item.id}>
            {item.module && course.lessons[position - 1]?.module !== item.module && (
              <h3 className="module-title">{item.module}</h3>
            )}
            <button
              key={item.id}
              className={`lesson-button ${item.id === lesson.id ? "current" : ""} ${activityDone(item) ? "done" : ""}`}
              onClick={() => select(item.id)}
              aria-current={item.id === lesson.id ? "step" : undefined}
            >
              {activityDone(item) ? (
                <CheckCircle2 size={17} />
              ) : item.type === "video" ? (
                <PlayCircle size={17} />
              ) : (
                <FileText size={17} />
              )}
              <span>
                {item.title}
                <small>
                  {item.minutes} min · {item.type !== "quiz" && `+${lessonXp(item.minutes)} XP · `}
                  {item.type === "quiz" ? "Avaliação" : item.type === "reading" ? "Leitura" : "Vídeo"}
                </small>
              </span>
            </button>
          </div>
        ))}
      </aside>
    )}</div></div>;
}
