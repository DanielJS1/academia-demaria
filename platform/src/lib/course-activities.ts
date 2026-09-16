import { courseSchema, safeImage, vimeoEmbed, type Course, type Lesson } from "./model";

export function activityQuestions(course: Pick<Course,"lessons"|"questions">, lesson: Lesson) {
  if (lesson.type !== "quiz") return [];
  return lesson.questions ?? (course.lessons.find(l=>l.type==="quiz")?.id===lesson.id ? course.questions : []);
}
export function normalizeCourse(course: Course): Course {
  return {...course,lessons:course.lessons.map(l=>l.type==="quiz"?{...l,questions:activityQuestions(course,l)}:l),questions:[]};
}
export function courseValidationError(course: Course, publish: boolean): string | null {
  const parsed=courseSchema.safeParse(course);
  if(!parsed.success){const issue=parsed.error.issues[0];const index=issue.path[0]==="lessons"?Number(issue.path[1])+1:null;return `${index?`Atividade ${index}: `:"Curso: "}${issue.message} (${issue.path.join(" → ")}).`;}
  if(!safeImage(course.banner))return "Banner: use um endereço HTTPS válido.";
  if(course.logoUrl && !safeImage(course.logoUrl))return "Logo: use um endereço HTTPS válido.";
  if(publish&&!course.lessons.some(l=>l.type!=="quiz"))return "Adicione ao menos uma aula de vídeo ou leitura.";
  const questionIds=new Set<string>();
  for(const [index,lesson] of course.lessons.entries()){
    const label=`Atividade ${index+1} — ${lesson.title || "Sem título"}`;
    if(publish&&!lesson.title.trim())return `${label}: preencha o título.`;
    if(lesson.type==="video" && ((publish&&!lesson.videoUrl)|| (lesson.videoUrl&&!vimeoEmbed(lesson.videoUrl))))return `${label}: informe um link HTTPS válido do Vimeo.`;
    if(publish&&lesson.type==="reading"&&!lesson.content.trim()&&!lesson.attachmentPath)return `${label}: escreva a leitura ou anexe um PDF.`;
    const questions=activityQuestions(course,lesson);
    if(publish&&lesson.type==="quiz"&&!questions.length)return `${label}: adicione perguntas à avaliação ou altere o tipo da atividade.`;
    for(const [qi,q] of questions.entries()){
      if(questionIds.has(q.id))return `${label}: identificador de pergunta duplicado.`;
      questionIds.add(q.id);
      if(publish&&(!q.prompt.trim()||(q.type==="choice"&&(q.options.length<2||new Set(q.options).size!==q.options.length||q.options.some(o=>!o.trim())||!q.options.includes(q.correct)))))return `${label}, pergunta ${qi+1}: confira enunciado, alternativas e gabarito.`;
    }
  }
  return null;
}
