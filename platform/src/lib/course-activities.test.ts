import { beforeAll,afterAll,describe,it,expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { initialState } from "./seed";
import { activityQuestions,courseValidationError,normalizeCourse } from "./course-activities";
import { courseXp,isCourseComplete } from "./rewards";
import { type Course,type Lesson } from "./model";
const admin="11111111-1111-4111-8111-111111111111",student="22222222-2222-4222-8222-222222222222";
const reading=(id:string):Lesson=>({id,title:id,module:"",type:"reading",minutes:5,content:"Leitura",videoUrl:""});
const quiz=(id:string):Lesson=>({...reading(id),type:"quiz",questions:[{id:`q-${id}`,prompt:"Pergunta",type:"choice",options:["A","B"],correct:"A"}]});
const course=(id:string,lessons:Lesson[]):Course=>({...initialState.courses[0],id,version:1,retryPolicy:"free",questions:[],lessons});
let db:PGlite;
const cmd=(actor:string,command:unknown)=>db.query("select academy_mutate($1::uuid,$2::jsonb)",[actor,JSON.stringify(command)]);
const publish=(c:Course)=>cmd(admin,{type:"save-resource",kind:"course",data:c,publish:true,expectedVersion:0});
const complete=(id:string,lessonId:string)=>cmd(student,{type:"complete",courseId:id,version:1,lessonId});
const submit=(id:string,quizId:string)=>cmd(student,{type:"submit",courseId:id,version:1,quizId,answers:{[`q-${quizId}`]:"A"}});
const review=async(id:string,quizId:string,score=100)=>{const a=(await db.query<{id:string}>("select id from academy_attempts where course_id=$1 and quiz_id=$2 and status='pending'",[id,quizId])).rows[0];return cmd(admin,{type:"review",id:a.id,score,feedback:"Correção",correctTextIds:[]});};
beforeAll(async()=>{
 db=new PGlite();await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role;");
 for(const f of ["202609150001_pilot.sql","202609160001_learning_rewards.sql"])await db.exec(readFileSync(new URL(`../../supabase/migrations/${f}`,import.meta.url),"utf8"));
 await db.query("insert into auth.users values($1),($2)",[admin,student]);
 await db.query("insert into academy_profiles(id,name,email,role) values($1,'Admin','a@demaria.com.br','admin'),($2,'Aluno','b@demaria.com.br','student')",[admin,student]);
 const old={...course("legacy",[reading("r"),{...quiz("old"),questions:undefined}]),questions:quiz("old").questions!};
 await publish(old);await complete(old.id,"r");await cmd(student,{type:"submit",courseId:old.id,version:1,answers:{"q-old":"A"}});
 await db.exec(readFileSync(new URL("../../supabase/migrations/202609170001_activity_assessments.sql",import.meta.url),"utf8"));
},30000);
afterAll(async()=>{await db?.close();});
describe("editor e avaliações por atividade",()=>{
 it("permite publicar 13 aulas sem módulo e sem avaliação",()=>{
  const c=course("thirteen",Array.from({length:13},(_,i)=>reading(`a${i}`)));
  expect(courseValidationError(c,true)).toBeNull();
  c.lessons[12].content="";
  expect(courseValidationError(c,true)).toContain("Atividade 13");
  expect(courseValidationError(c,false)).toBeNull();
  c.lessons[12].attachmentPath="pdf/11111111-1111-4111-8111-111111111111.pdf";
  expect(courseValidationError(c,true)).toBeNull();
 });
 it("indica alternativas repetidas na pergunta da avaliação",()=>{
  const c=course("duplicated-options",[reading("intro"),quiz("assessment")]);
  c.lessons[1].questions![0].options=["Resposta", "Resposta"];
  expect(courseValidationError(c,true)).toContain("pergunta 1: há alternativas repetidas");
 });
 it("preserva o questionário antigo ao converter o rascunho",()=>{
  const old={...course("old",[{...quiz("q1"),questions:undefined},quiz("q2")]),questions:quiz("q1").questions!};
  const converted=normalizeCourse(old);expect(activityQuestions(converted,converted.lessons[0])).toEqual(old.questions);expect(converted.lessons[1].questions).toEqual(old.lessons[1].questions);
 });
 it("preserva avaliações pendentes existentes na migração",async()=>{
  const result=(await db.query<{quiz_id:string;snapshot:any}>("select quiz_id,snapshot from academy_attempts where course_id='legacy'")).rows[0];
  expect(result.quiz_id).toBe("old");expect(result.snapshot.questions[0].id).toBe("q-old");
  await review("legacy","old");
 });
 it("avaliação intermediária exige apenas atividades anteriores; bônus de curso só no final",async()=>{
  const c=course("middle",[reading("r1"),quiz("q1"),reading("r2"),quiz("q2"),reading("r3")]);await publish(c);
  await expect(submit(c.id,"q1")).rejects.toThrow("aulas anteriores");
  await complete(c.id,"r1");await submit(c.id,"q1");await complete(c.id,"r2");
  await expect(submit(c.id,"q2")).rejects.toThrow("avaliação anterior");
  await review(c.id,"q1");await submit(c.id,"q2");await review(c.id,"q2");
  const totals=async()=> (await db.query<{event_key:string;amount:number}>("select event_key,amount from academy_xp where course_id=$1",[c.id])).rows;
  expect((await totals()).filter(x=>x.event_key.startsWith("approval:"))).toHaveLength(2);
  expect((await totals()).some(x=>x.event_key==="completion")).toBe(false);
  await complete(c.id,"r3");await complete(c.id,"r3");
  expect((await totals()).filter(x=>x.event_key==="completion")).toEqual([{event_key:"completion",amount:30}]);
  expect((await totals()).reduce((sum,x)=>sum+x.amount,0)).toBe(courseXp(c));
  expect((await db.query<{done:boolean}>("select academy_course_completed($1,$2,99) as done",[student,c.id])).rows[0].done).toBe(false);
  await expect(submit(c.id,"missing")).rejects.toThrow("não encontrada");
 });
 it("reprovação e recuperação pertencem à atividade, sem reiniciar o módulo anterior",async()=>{
  const c={...course("retry-step",[reading("r1"),quiz("q1"),reading("r2"),quiz("q2")]),retryPolicy:"review" as const};await publish(c);
  await complete(c.id,"r1");await submit(c.id,"q1");await review(c.id,"q1");await complete(c.id,"r2");await submit(c.id,"q2");await review(c.id,"q2",30);
  expect((await db.query("select lesson_id from academy_progress where course_id=$1",[c.id])).rows).toEqual([{lesson_id:"r1"}]);
  await complete(c.id,"r2");await submit(c.id,"q2");await review(c.id,"q2");
  expect((await db.query("select amount from academy_xp where course_id=$1 and event_key='approval:q2'",[c.id])).rows).toEqual([{amount:10}]);
 });
 it("conclusão na interface depende de todas as avaliações e aulas",()=>{
  const c=course("view",[reading("r1"),quiz("q1"),quiz("q2")]);
  expect(isCourseComplete(c,{...initialState,completed:{view:["r1"]},attempts:[]},student)).toBe(false);
 });
});
