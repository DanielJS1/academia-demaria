import { z } from "zod";
import { articleSchema, courseSchema, personSchema, type AcademyState } from "./model";
const id = z.string().min(1).max(100);
export const commandSchema = z.discriminatedUnion("type", [
 z.object({ type:z.literal("save-resource"), kind:z.enum(["course","article"]), data:z.union([courseSchema,articleSchema]), publish:z.boolean(), expectedVersion:z.number().int().nonnegative() }),
 z.object({ type:z.literal("complete"), courseId:id, version:z.number().int().positive(), lessonId:id }),
 z.object({ type:z.literal("video"), courseId:id, version:z.number().int().positive(), lessonId:id, duration:z.number().positive().max(86400), position:z.number().nonnegative().max(86400).optional(), ranges:z.array(z.tuple([z.number().nonnegative(),z.number().nonnegative()])).max(2000) }),
 z.object({ type:z.literal("submit"), courseId:id, version:z.number().int().positive(), answers:z.record(id,z.string().max(5000)) }),
 z.object({ type:z.literal("review"), id:z.string().uuid(), score:z.number().min(0).max(100), feedback:z.string().trim().min(1).max(10000), correctTextIds:z.array(id).default([]) }),
 z.object({ type:z.literal("delete-user"), id:z.string().uuid() }),
 z.object({ type:z.literal("reject-user"), id:z.string().uuid() }),
 z.object({ type:z.literal("unlock"), id:z.string().uuid() }),
 z.object({ type:z.literal("profile"), data:personSchema }),
 z.object({ type:z.literal("invite"), temporaryPassword:z.string().min(12).max(128).optional(), name:z.string().trim().min(2).max(120), email:z.string().email(), department:z.string().max(80), managerId:z.string(), role:z.enum(["student","manager","admin"]) }),
 z.object({ type:z.literal("preferences"), bookmarks:z.array(id).max(2000), readNotices:z.array(id).max(2000) }),
 z.object({ type:z.literal("settings"), kind:z.enum(["departments","products"]), oldName:z.string().optional(), name:z.string().trim().min(1).max(80) }),
]);
export type Command = z.infer<typeof commandSchema>;
export function normalizeVimeoRanges(values:unknown[]):[number,number][]{
 return values.flatMap(value=>{
  const parsed=z.union([z.tuple([z.number(),z.number()]),z.object({start:z.number(),end:z.number()})]).safeParse(value);
  if(!parsed.success)return [];
  return [Array.isArray(parsed.data)?parsed.data:[parsed.data.start,parsed.data.end]] as [number,number][];
 });
}
export function mergeWatched(ranges:number[][], duration:number) {
 const sorted = ranges.filter(([a,b]) => Number.isFinite(a) && Number.isFinite(b) && b>a && a<duration).map(([a,b])=>[Math.max(0,a),Math.min(duration,b)]).sort((a,b)=>a[0]-b[0]);
 const result:number[][]=[];
 for(const range of sorted){const last=result[result.length-1]; if(last && range[0]<=last[1]+0.25)last[1]=Math.max(last[1],range[1]);else result.push([...range]);}
 return { ranges:result, seconds:result.reduce((sum,[a,b])=>sum+b-a,0) };
}
const changed = (a:unknown,b:unknown) => JSON.stringify(a)!==JSON.stringify(b);
// Traduz os controles existentes em comandos. A API nunca recebe um estado
// completo para sobrescrever e valida novamente cada operação e permissão.
export function stateCommand(before:AcademyState,after:AcademyState):Command|null {
 for(const kind of ["departments","products"] as const) if(changed(before[kind],after[kind])) {
  const name=after[kind].find(item=>!before[kind].includes(item));
  if(!name)throw new Error("Não é possível remover este cadastro por aqui.");
  return {type:"settings",kind,name,oldName:before[kind].find(item=>!after[kind].includes(item))};
 }
 for(const [key,kind,publish] of [["courseDrafts","course",false],["courses","course",true],["articleDrafts","article",false],["articles","article",true]] as const){
  const item=after[key].find(item=>changed(item,before[key].find(old=>old.id===item.id)));
  if(item){const old=(kind==="course"?before.courses:before.articles).find(old=>old.id===item.id);return {type:"save-resource",kind,publish,data:item,expectedVersion:old?("version" in old?old.version:old.revision):0};}
 }
 const person=after.people.find(item=>changed(item,before.people.find(old=>old.id===item.id)));
 if(person) return before.people.some(item=>item.id===person.id)?{type:"profile",data:person}:{type:"invite",name:person.name,email:person.email,department:person.department,managerId:person.managerId,role:person.role};
 const attempt=after.attempts.find(item=>changed(item,before.attempts.find(old=>old.id===item.id)));
 if(attempt){const old=before.attempts.find(item=>item.id===attempt.id);if(!old)return {type:"submit",courseId:attempt.courseId,version:attempt.courseVersion,answers:attempt.answers};if(old.retryAllowed!==attempt.retryAllowed)return {type:"unlock",id:attempt.id};return {type:"review",id:attempt.id,score:attempt.score??-1,feedback:attempt.feedback,correctTextIds:[]};}
 for(const [courseId,lessons] of Object.entries(after.completed)){const lessonId=lessons.find(id=>!before.completed[courseId]?.includes(id)); if(lessonId)return {type:"complete",courseId,lessonId,version:before.courses.find(course=>course.id===courseId)!.version};}
 if(changed(before.bookmarks,after.bookmarks)||changed(before.readNotices,after.readNotices))return {type:"preferences",bookmarks:after.bookmarks,readNotices:after.readNotices};
 return null;
}
