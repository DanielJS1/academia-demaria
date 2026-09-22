import { courseSchema, safeImage, vimeoEmbed, youtubeEmbed, type Course, type Lesson, type Question } from "./model";

export function activityQuestions(course: Pick<Course,"lessons"|"questions">, lesson: Lesson) {
  if (lesson.type !== "quiz") return [];
  return lesson.questions ?? (course.lessons.find(l=>l.type==="quiz")?.id===lesson.id ? course.questions : []);
}
export function normalizeCourse(course: Course): Course {
  return {...course,lessons:course.lessons.map(l=>l.type==="quiz"?{...l,questions:activityQuestions(course,l)}:l),questions:[]};
}
export function isCorrectAnswerValid(question: Pick<Question, "type" | "options" | "correct" | "multiple">): boolean {
  if (question.type !== "choice") return true;
  if (!question.correct || !question.correct.trim()) return false;
  if (question.multiple) {
    try {
      const parsed = JSON.parse(question.correct);
      if (Array.isArray(parsed)) {
        return parsed.length > 0 && parsed.every(ans => typeof ans === "string" && question.options.includes(ans));
      }
    } catch {}
  }
  return question.options.includes(question.correct);
}

export function courseValidationError(course: Course, publish: boolean): string | null {
  const parsed=courseSchema.safeParse(course);
  if(!parsed.success){const issue=parsed.error.issues[0];const index=issue.path[0]==="lessons"?Number(issue.path[1])+1:null;return `${index?`Atividade ${index}: `:"Curso: "}${issue.message} (${issue.path.join(" → ")}).`;}
  if(!safeImage(course.banner))return "Banner: use um link HTTPS, caminho local (/...) ou Base64 de até 64 KB.";
  if(course.logoUrl && !safeImage(course.logoUrl))return "Logo: use um link HTTPS, caminho local (/logos/...) ou Base64 leve (até 64 KB).";
  if(publish&&!course.lessons.some(l=>l.type!=="quiz"))return "Adicione ao menos uma aula de vídeo ou leitura.";
  const questionIds=new Set<string>();
  for(const [index,lesson] of course.lessons.entries()){
    const label=`Atividade ${index+1} — ${lesson.title || "Sem título"}`;
    if(publish&&!lesson.title.trim())return `${label}: preencha o título.`;
    if(lesson.type==="video" && ((publish&&!lesson.videoUrl)|| (lesson.videoUrl&&!vimeoEmbed(lesson.videoUrl)&&!youtubeEmbed(lesson.videoUrl))))return `${label}: informe um link HTTPS válido do Vimeo ou YouTube.`;
    if(publish&&lesson.type==="reading"&&!lesson.content.trim()&&!lesson.attachmentPath)return `${label}: escreva a leitura ou anexe um PDF.`;
    const questions=activityQuestions(course,lesson);
    if(publish&&lesson.type==="quiz"&&!questions.length)return `${label}: adicione perguntas à avaliação ou altere o tipo da atividade.`;
    for(const [qi,q] of questions.entries()){
      if(questionIds.has(q.id))return `${label}: identificador de pergunta duplicado.`;
      questionIds.add(q.id);
      if(publish&&(!q.prompt.trim()||(q.type==="choice"&&(q.options.length<2||new Set(q.options).size!==q.options.length||q.options.some(o=>!o.trim())||!isCorrectAnswerValid(q)))))return `${label}, pergunta ${qi+1}: confira enunciado, alternativas e gabarito.`;
    }
  }
  if (publish && course.hasProficiencyTest && course.proficiencyQuestions && course.proficiencyQuestions.length > 0) {
    for (const [qi, q] of course.proficiencyQuestions.entries()) {
      if (!q.prompt.trim() || (q.type === "choice" && (q.options.length < 2 || new Set(q.options).size !== q.options.length || q.options.some(o => !o.trim()) || !isCorrectAnswerValid(q)))) {
        return `Prova de Proficiência, pergunta ${qi + 1}: confira enunciado, alternativas e gabarito.`;
      }
    }
  }
  return null;
}
