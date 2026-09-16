import { describe, expect, it } from "vitest";
import { readAcademy, executeCommand, type Profile } from "./pilot-server";
import { initialState } from "./seed";
function fixture(){
 const me:Profile={id:"student",name:"Aluno",email:"a@example.test",department:"Comercial",manager_id:"manager",role:"student",status:"active"};
 const tables:Record<string,Record<string,any>[]>={
  academy_resources:[{id:"course",kind:"course",revision:1,published:{...initialState.courses[0],id:"course",lessons:initialState.courses[0].lessons.map(l=>({...l,questions:l.type==="quiz"?initialState.courses[0].questions:undefined}))},draft:{...initialState.courses[0],title:"Rascunho privado"}}],
  academy_profiles:[me,{...me,id:"other",name:"Outra pessoa",email:"b@example.test",manager_id:"other-manager"},{...me,id:"manager",role:"manager",manager_id:null}],
  academy_settings:[{departments:["Comercial"],products:["DOC-Windows"]}],
  academy_progress:[{user_id:"other",course_id:"course",version:1,lesson_id:initialState.courses[0].lessons[0].id,done:true}],
  academy_attempts:[{id:"answer",user_id:"other",course_id:"course",version:1,snapshot:initialState.courses[0],answers:{private:"Resposta de outra pessoa"},status:"pending",submitted_at:"2026-09-15"}],
  academy_xp:[],academy_preferences:[],
 };
 const db={from(table:string){let rows=tables[table]??[];let single=false;const chain={select(){return chain;},eq(key:string,value:unknown){rows=rows.filter(row=>row[key]===value);return chain;},range(){return chain;},order(){return chain;},single(){single=true;return chain;},maybeSingle(){single=true;return chain;},then(resolve:(value:unknown)=>unknown){return Promise.resolve({data:single?rows[0]??null:rows,error:null}).then(resolve);}};return chain;}};
 return {me,db:db as unknown as Parameters<typeof readAcademy>[0]};
}
describe("API: isolamento de dados",()=>{
 it("não entrega gabaritos, rascunhos ou avaliações de terceiros ao aluno",async()=>{
  const {db,me}=fixture();const {state}=await readAcademy(db,me);
  expect(state.courseDrafts).toHaveLength(0);expect(state.courses[0].questions.every(q=>q.correct==="")).toBe(true);
  const questions=state.courses[0].lessons.flatMap(l=>l.questions??[]);
  expect(questions.length).toBeGreaterThan(0);expect(questions.every(q=>q.correct==="")).toBe(true);
  expect(state.attempts).toHaveLength(0);expect(state.people.find(p=>p.id==="other")?.email).toBe("");
  expect(state.people.find(p=>p.id==="other")?.progress).toBe(0);
 });
 it("não entrega relatórios de outra equipe ao gestor",async()=>{
  const {db,me}=fixture();const {state}=await readAcademy(db,{...me,id:"manager",role:"manager"});
  expect(state.people.find(p=>p.id==="student")?.email).toBe("a@example.test");
  expect(state.people.find(p=>p.id==="other")?.email).toBe("");expect(state.people.find(p=>p.id==="other")?.progress).toBe(0);
 });
 it("recusa comandos administrativos antes de acessar o banco",async()=>{
  const {db,me}=fixture();await expect(executeCommand(db,me,{type:"invite",name:"Teste",email:"test@example.test",department:"Geral",managerId:"",role:"admin"})).rejects.toMatchObject({status:403});
 });
});
