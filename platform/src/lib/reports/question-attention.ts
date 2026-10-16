import type { ReportRow } from "./contracts";
export function questionAttention(rows: ReportRow[]) {
  const groups = new Map<string,{ id:string; course:string; activity:string; question:string; position:number; correct:number; incorrect:number; partial:number; pending:number; unavailable:number }>();
  for (const row of rows) if (row.type === "assessment" && row.diagnostic) for (const [index, question] of row.diagnostic.questions.entries()) {
    const id = JSON.stringify([row.courseId,row.courseVersion,row.activityId,question.questionId]);
    const group = groups.get(id) ?? {id,course:`${row.courseTitle ?? row.courseId} · v${row.courseVersion ?? "legada"}`,activity:row.activityId ?? "Legada",question:question.questionId,position:index+1,correct:0,incorrect:0,partial:0,pending:0,unavailable:0};
    group[question.outcome]++; groups.set(id,group);
  }
  return [...groups.values()].map(group=>({...group,graded:group.correct+group.incorrect+group.partial,rate:group.correct+group.incorrect+group.partial ? group.incorrect/(group.correct+group.incorrect+group.partial)*100 : null})).sort((a,b)=>b.incorrect-a.incorrect || a.id.localeCompare(b.id));
}
