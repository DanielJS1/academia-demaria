import { describe, expect, it } from "vitest";
import { readAcademy, executeCommand, type Profile } from "./pilot-server";
import { initialState } from "./seed";
const studentId="11111111-1111-4111-8111-111111111111", otherId="22222222-2222-4222-8222-222222222222", managerId="33333333-3333-4333-8333-333333333333";
function fixture(){
 const me:Profile={id:studentId,name:"Aluno",email:"a@example.test",department:"Comercial",manager_id:managerId,role:"student",status:"active"};
 const tables:Record<string,Record<string,any>[]>={
  academy_resources:[{id:"course",kind:"course",revision:1,published:{...initialState.courses[0],id:"course",lessons:initialState.courses[0].lessons.map(l=>({...l,questions:l.type==="quiz"?initialState.courses[0].questions:undefined}))},draft:{...initialState.courses[0],title:"Rascunho privado"}}],
  academy_profiles:[me,{...me,id:otherId,name:"Outra pessoa",email:"b@example.test",manager_id:"other-manager"},{...me,id:managerId,role:"manager",manager_id:null}],
  academy_settings:[{departments:["Comercial"],products:["DOC-Windows"]}],
  academy_progress:[{user_id:otherId,course_id:"course",version:1,lesson_id:initialState.courses[0].lessons[0].id,done:true}],
  academy_attempts:[{id:"answer",user_id:otherId,course_id:"course",version:1,snapshot:initialState.courses[0],answers:{private:"Resposta de outra pessoa"},status:"pending",submitted_at:"2026-09-15"}],
  academy_xp:[],academy_preferences:[],
 };
 const db={rpc:async(name:string,args:{actor:string})=>({data:name==="academy_read_quiz_notifications"?{userId:args.actor,quizNotifications:{enabled:false,since:null},readNotices:[],notifications:[]}:{articles:[],articleDrafts:[]},error:null}),from(table:string){let rows=tables[table]??[];let single=false;const chain={select(){return chain;},eq(key:string,value:unknown){rows=rows.filter(row=>row[key]===value);return chain;},range(){return chain;},order(){return chain;},single(){single=true;return chain;},maybeSingle(){single=true;return chain;},then(resolve:(value:unknown)=>unknown){return Promise.resolve({data:single?rows[0]??null:rows,error:null}).then(resolve);}};return chain;}};
 return {me,db:db as unknown as Parameters<typeof readAcademy>[0],tables};
}
describe("API: isolamento de dados",()=>{
 it("não expõe cursos ou colaboradores internos ao cartório",async()=>{
  const {db,me}=fixture();
  const {state}=await readAcademy(db,{...me,audience:"client",cartorio_id:"cartorio"});
  expect(state.courses).toHaveLength(0);
  expect(state.people.map(p=>p.id)).toEqual([me.id]);
  expect(state.departments).toEqual([]);
  expect(state.cartorios).toEqual([]);
 });
 it("não entrega gabaritos, rascunhos ou avaliações de terceiros ao aluno",async()=>{
  const {db,me}=fixture();const {state}=await readAcademy(db,me);
  expect(state.courseDrafts).toHaveLength(0);expect(state.courses[0].questions.every(q=>q.correct==="")).toBe(true);
  const questions=state.courses[0].lessons.flatMap(l=>l.questions??[]);
  expect(questions.length).toBeGreaterThan(0);expect(questions.every(q=>q.correct==="")).toBe(true);
  expect(state.attempts).toHaveLength(0);expect(state.people.find(p=>p.id===otherId)?.email).toBe("");
  expect(state.people.find(p=>p.id===otherId)?.progress).toBe(0);
 });
 it("não entrega relatórios de outra equipe ao gestor",async()=>{
  const {db,me}=fixture();const {state}=await readAcademy(db,{...me,id:managerId,role:"manager"});
  expect(state.people.find(p=>p.id===studentId)?.email).toBe("a@example.test");
  expect(state.people.find(p=>p.id===otherId)?.email).toBe("");expect(state.people.find(p=>p.id===otherId)?.progress).toBe(0);
 });
 it("entrega somente a posição de vídeo do aluno autenticado",async()=>{
  const {db,me,tables}=fixture();
  tables.academy_progress.push({user_id:me.id,course_id:"course",version:1,lesson_id:initialState.courses[0].lessons[1].id,done:false,position:92,duration:480,updated_at:new Date().toISOString()});
  tables.academy_progress.push({user_id:otherId,course_id:"course",version:1,lesson_id:initialState.courses[0].lessons[3].id,done:false,position:145,duration:720,updated_at:new Date().toISOString()});
  const {state}=await readAcademy(db,me);
  expect(state.videoProgress.course[initialState.courses[0].lessons[1].id].position).toBe(92);
  expect(Object.keys(state.videoProgress.course)).toHaveLength(1);
  expect(state.people.find(p=>p.id===otherId)?.performance).toBeGreaterThan(0);
  expect(state.people.find(p=>p.id===me.id)?.streak).toBe(1);
 });
 it("recusa comandos administrativos antes de acessar o banco",async()=>{
  const {db,me}=fixture();await expect(executeCommand(db,me,{type:"course-availability",courseId:"course",availability:"inactive",expectedAvailability:"active",expectedVersion:1})).rejects.toMatchObject({status:403});
 });
 it.each(["inactive", "development"])("oculta cursos %s dos alunos e mantém a gestão administrativa",async availability=>{
  const {db,me,tables}=fixture();tables.academy_resources[0].published.availability=availability;
  expect((await readAcademy(db,me)).state.courses).toHaveLength(0);
  expect((await readAcademy(db,{...me,role:"admin"})).state.courses).toHaveLength(1);
  await expect(executeCommand(db,me,{type:"complete",courseId:"course",version:1,lessonId:initialState.courses[0].lessons[0].id})).rejects.toMatchObject({status:403});
 });
 it("exige conteúdo válido para reativar um curso",async()=>{
  const {db,me,tables}=fixture();tables.academy_resources[0].published.lessons=[];
  await expect(executeCommand(db,{...me,role:"admin"},{type:"course-availability",courseId:"course",availability:"active",expectedAvailability:"development",expectedVersion:1})).rejects.toThrow("Adicione ao menos uma aula");
 });
 it("recusa convites administrativos feitos por alunos",async()=>{
  const {db,me}=fixture();await expect(executeCommand(db,me,{type:"invite",name:"Teste",email:"test@example.test",department:"Geral",managerId:"",role:"admin"})).rejects.toMatchObject({status:403});
 });
 it("executa prova de proficiência e aprova com dispensa integral de aulas",async()=>{
  const {db,me,tables}=fixture();
  const course=tables.academy_resources[0].published;
  course.hasProficiencyTest=true;
  course.proficiencyScore=80;
  course.proficiencyQuestions=[
   {id:"q1",prompt:"Q1",type:"choice",options:["A","B"],correct:"A"}
  ];
  const dbAny=db as any;
  dbAny.from=(table:string)=>{
   let rows=tables[table]??[];let single=false;
   const chain:any={
    select(){return chain;},
    eq(key:string,value:unknown){rows=rows.filter(r=>r[key]===value);return chain;},
    single(){single=true;return chain;},
    maybeSingle(){single=true;return chain;},
    async upsert(row:any){tables[table]=tables[table]??[];const idx=tables[table].findIndex(r=>r.lesson_id===row.lesson_id&&r.course_id===row.course_id);if(idx>=0)tables[table][idx]=row;else tables[table].push(row);return {error:null};},
    async insert(row:any){tables[table]=tables[table]??[];tables[table].push(row);return {error:null};},
    then(resolve:any){return Promise.resolve({data:single?rows[0]??null:rows,error:null}).then(resolve);}
   };
   return chain;
  };
  dbAny.rpc=async()=>({error:null});

  await executeCommand(dbAny,me,{
   type:"proficiency",
   courseId:"course",
   version:1,
   score:100,
   answers:{q1:"A"}
  });

  expect(tables.academy_progress.filter(p=>p.user_id===me.id&&p.done)).toHaveLength(course.lessons.length);
  expect(tables.academy_attempts.some(a=>a.user_id===me.id&&a.status==="approved"&&a.quiz_id==="proficiency")).toBe(true);
 });
});
