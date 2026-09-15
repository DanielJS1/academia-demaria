import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { mergeWatched, stateCommand } from "./pilot-contract";
import { initialState } from "./seed";
const admin="11111111-1111-4111-8111-111111111111", student="22222222-2222-4222-8222-222222222222",other="33333333-3333-4333-8333-333333333333";
let db:PGlite;
const command=(actor:string,value:unknown)=>db.query("select public.academy_mutate($1::uuid,$2::jsonb)",[actor,JSON.stringify(value)]);
const course={...initialState.courses[0],id:"real-course",version:1,lessons:[{...initialState.courses[0].lessons[0],id:"reading"},{...initialState.courses[0].lessons[4],id:"quiz"}],retryPolicy:"review"};
beforeAll(async()=>{
 db=new PGlite();
 await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role;");
 await db.exec(readFileSync(new URL("../../supabase/migrations/202609150001_pilot.sql",import.meta.url),"utf8"));
 await db.query("insert into auth.users(id) values($1),($2),($3)",[admin,student,other]);
 await db.query("insert into academy_profiles(id,name,email,role) values($1,'Admin','admin@example.test','admin'),($2,'Student','student@example.test','student'),($3,'Other','other@example.test','student')",[admin,student,other]);
 await command(admin,{type:"save-resource",kind:"course",data:course,publish:true,expectedVersion:0});
},30000);
afterAll(async()=>{await db?.close();});
describe("Postgres: regras do piloto",()=>{
 it("nega publicação e correção ao aluno",async()=>{
  await expect(command(student,{type:"save-resource",kind:"course",data:course,publish:true,expectedVersion:1})).rejects.toThrow("Apenas administradores");
  await expect(command(student,{type:"review",id:admin,score:100,feedback:"x"})).rejects.toThrow("Apenas administradores");
 });
 it("nega leitura direta das tabelas ao navegador",async()=>{
  await db.exec("set role authenticated");
  await expect(db.query("select * from academy_attempts")).rejects.toThrow();
  await db.exec("reset role");
 });
 it("bloqueia envio sem conclusão e preserva a versão publicada ao salvar rascunho",async()=>{
  await expect(command(student,{type:"submit",courseId:course.id,version:1,answers:{}})).rejects.toThrow("Conclua todas as aulas");
  await command(admin,{type:"save-resource",kind:"course",data:{...course,title:"Rascunho secreto"},publish:false,expectedVersion:1});
  const result=await db.query<{title:string}>("select published->>'title' as title from academy_resources where id=$1",[course.id]);
  expect(result.rows[0].title).toBe(course.title);
 });
 it("registra tentativa, rejeita duplicidade e reinicia aulas após reprovação",async()=>{
  await command(student,{type:"complete",courseId:course.id,version:1,lessonId:"reading"});
  const answers=Object.fromEntries(course.questions.map(q=>[q.id,q.type==="choice"?q.options[0]:"Minha resposta"]));
  await command(student,{type:"submit",courseId:course.id,version:1,answers});
  await expect(command(student,{type:"submit",courseId:course.id,version:1,answers})).rejects.toThrow("Já existe");
  const attempt=await db.query<{id:string}>("select id from academy_attempts where user_id=$1",[student]);
  await command(admin,{type:"review",id:attempt.rows[0].id,score:30,feedback:"Revise a leitura"});
  expect((await db.query("select * from academy_progress where user_id=$1",[student])).rows).toHaveLength(0);
  await expect(command(student,{type:"submit",courseId:course.id,version:1,answers})).rejects.toThrow("Conclua todas as aulas");
 });
 it("aprova com snapshot e concede XP uma única vez",async()=>{
  await command(student,{type:"complete",courseId:course.id,version:1,lessonId:"reading"});
  await command(student,{type:"submit",courseId:course.id,version:1,answers:Object.fromEntries(course.questions.map(q=>[q.id,q.type==="choice"?q.options[0]:"Revisado"]))});
  const attempt=await db.query<{id:string}>("select id from academy_attempts where user_id=$1 and status='pending'",[student]);
  await command(admin,{type:"review",id:attempt.rows[0].id,score:90,feedback:"Aprovado"});
  await expect(command(admin,{type:"review",id:attempt.rows[0].id,score:90,feedback:"Aprovado"})).rejects.toThrow("já foi corrigida");
  const xp=await db.query<{amount:number}>("select amount from academy_xp where user_id=$1",[student]);
  expect(xp.rows).toHaveLength(1);expect(xp.rows[0].amount).toBe(course.xp);
  expect((await db.query("select * from academy_progress where user_id=$1",[other])).rows).toHaveLength(0);
 });
 it("recusa conclusão manual de vídeos e publicação com versão desatualizada",async()=>{
  await expect(command(admin,{type:"save-resource",kind:"course",data:course,publish:true,expectedVersion:0})).rejects.toThrow("outra sessão");
  const video={...course,id:"video-course",lessons:[{...course.lessons[0],id:"video",type:"video"}]};
  await command(admin,{type:"save-resource",kind:"course",data:video,publish:true,expectedVersion:0});
  await expect(command(student,{type:"complete",courseId:video.id,version:1,lessonId:"video"})).rejects.toThrow("Assista ao vídeo");
 });
});
describe("contrato do navegador",()=>{
 it("não confunde saltar até o final com assistir ao vídeo",()=>{
  expect(mergeWatched([[0,10],[90,100]],100).seconds).toBe(20);
  expect(mergeWatched([[0,40],[20,70],[70,90]],100).seconds).toBe(90);
 });
 it("descarta valores de XP alterados no navegador",()=>{
  expect(stateCommand(initialState,{...initialState,xpEvents:[{id:"fake",amount:99999,season:"2026",label:"fake"}]})).toBeNull();
 });
});

