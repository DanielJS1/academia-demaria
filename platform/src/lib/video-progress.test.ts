import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { initialState } from "./seed";

const admin="11111111-1111-4111-8111-111111111111", student="22222222-2222-4222-8222-222222222222";
let db:PGlite;
const migration=(name:string)=>readFileSync(new URL(`../../supabase/migrations/${name}.sql`,import.meta.url),"utf8").replace(/^\uFEFF/, "");
const input={type:"video",courseId:"video",version:1,lessonId:"lesson",duration:100,position:0,ranges:[] as number[][]};
const save=(changes:Record<string,unknown>={},actor=student)=>db.query("select academy_save_video_progress($1::uuid,$2::jsonb)",[actor,JSON.stringify({...input,...changes})]);
const progress=async(actor=student)=>(await db.query<{done:boolean;position:string;ranges:number[][]}>("select done,position,ranges from academy_progress where user_id=$1",[actor])).rows[0];
beforeAll(async()=>{
 db=new PGlite();
 await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role;");
 for(const name of ["202609150001_pilot","202609160001_learning_rewards","202609170001_activity_assessments","202609170002_fix_settings_where_clause","202609170003_cartorios_and_clients"])
  await db.exec(migration(name));
 // Use the real authorization function without unrelated Storage bucket DDL.
 const access=migration("202609240005_private_article_files");
 await db.exec(access.slice(access.indexOf("create or replace function"),access.indexOf("-- Preserve")));
 await db.exec(migration("202609240006_video_progress"));
 await db.query("insert into auth.users values($1),($2)",[admin,student]);
 await db.query("insert into academy_profiles(id,name,email,role) values($1,'Admin','admin@demaria.com.br','admin'),($2,'Aluno','aluno@demaria.com.br','student')",[admin,student]);
 const course={...initialState.courses[0],id:"video",version:1,status:"published",audience:"internal",questions:[],lessons:[{id:"lesson",title:"Vídeo",type:"video",minutes:1,videoUrl:"https://vimeo.com/123456",content:""}]};
 await db.query("select academy_mutate($1::uuid,$2::jsonb)",[admin,JSON.stringify({type:"save-resource",kind:"course",data:course,publish:true,expectedVersion:0})]);
 // Reproduce the reported first-save rejection against the previous RPC.
 await expect(save({ranges:[[0,100]],position:100})).rejects.toThrow("Tempo assistido incompatível");
 await db.exec(migration("20260929112304_video_completion_recovery"));
},30000);
beforeEach(async()=>{await db.exec("delete from academy_progress; delete from academy_xp;");});
afterAll(async()=>{await db?.close();});
it("recupera primeiro salvamento atrasado, inclusive uma aula inteira",async()=>{
 await save({ranges:[[0,100]],position:100});
 expect((await progress()).done).toBe(true);
});
it.each([0,49.99])("não conclui salto ao fim com %s segundos assistidos",async watched=>{
 await save({position:100,ranges:watched?[[0,watched]]:[]});
 expect((await progress()).done).toBe(false);
});
it("50% sem final não conclui; voltar à aula e avançar ao fim conclui",async()=>{
 await save({position:50,ranges:[[0,50]]});
 expect((await progress()).done).toBe(false);
 await save({position:100});
 expect((await progress()).done).toBe(true);
 expect((await progress()).ranges).toEqual([[0,50]]);
});
it("lembra chegada ao final ao assistir o tempo faltante depois",async()=>{
 await save({position:100});
 await save({position:50,ranges:[[0,50]]});
 expect((await progress()).done).toBe(true);
});
it("não conta trechos repetidos duas vezes",async()=>{
 await save({position:100,ranges:[[0,30],[10,40],[0,30]]});
 expect((await progress()).done).toBe(false);
 expect((await progress()).ranges).toEqual([[0,40]]);
});
it("mescla sessões e requisições atrasadas sem perder conclusão ou duplicar XP",async()=>{
 await save({position:30,ranges:[[0,30]]});
 await Promise.all([save({position:100,ranges:[[30,50]]}),save({position:20,ranges:[[0,20]]})]);
 await save({position:100,ranges:[[0,50]]});
 expect((await progress()).done).toBe(true);
 expect(Number((await progress()).position)).toBe(100);
 const xp=(await db.query<{amount:number}>("select amount from academy_xp where user_id=$1 order by amount",[student])).rows;
 expect(xp.map(row=>row.amount)).toEqual([15,30]);
});
it("administrador precisa chegar ao fim, sem mínimo assistido",async()=>{
 await save({position:90},admin);
 expect((await progress(admin)).done).toBe(false);
 await save({position:100},admin);
 expect((await progress(admin)).done).toBe(true);
});
it("não aceita privilégio de administrador enviado pelo cliente",async()=>{
 await save({position:100,isAdmin:true,role:"admin"});
 expect((await progress()).done).toBe(false);
});
it("gestor segue o mínimo de 50%",async()=>{
 await db.query("update academy_profiles set role='manager' where id=$1",[student]);
 try { await save({position:100});expect((await progress()).done).toBe(false); }
 finally { await db.query("update academy_profiles set role='student' where id=$1",[student]); }
});
it("usa duração real mesmo em vídeo curto com minutos editoriais diferentes",async()=>{
 await save({duration:10,position:10,ranges:[[0,5]]});
 expect((await progress()).done).toBe(true);
});
it("recusa versão antiga, duração alterada e intervalos inválidos",async()=>{
 await expect(save({version:2})).rejects.toThrow("curso mudou");
 await expect(save({ranges:[[0,1010]]})).rejects.toThrow("Intervalo inválido");
 await expect(save({ranges:[[null,10]]})).rejects.toThrow("Intervalo inválido");
 await save();
 await expect(save({duration:300})).rejects.toThrow("Duração do vídeo mudou");
});
it("bloqueia usuário inativo e execução direta pelo navegador",async()=>{
 await db.query("update academy_profiles set status='inactive' where id=$1",[student]);
 try { await expect(save({position:100})).rejects.toThrow("Curso não autorizado"); }
 finally { await db.query("update academy_profiles set status='active' where id=$1",[student]); }
 await db.exec("set role authenticated");
 try { await expect(save()).rejects.toThrow("permission denied"); }
 finally { await db.exec("reset role"); }
});
