import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { courseXp, lessonXp } from "./rewards";
import { initialState } from "./seed";
import { executeCommand, type Profile } from "./pilot-server";

const admin = "11111111-1111-4111-8111-111111111111";
const learner = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
const command = (actor: string, input: unknown) => db.query("select academy_mutate($1::uuid,$2::jsonb)", [actor, JSON.stringify(input)]);
const base = { ...initialState.courses[0], lessons: [{id:"lesson",title:"Aula",module:"Módulo",minutes:5,type:"reading" as const,content:"Conteúdo",videoUrl:""}], questions:[] };
const events = async (id: string) => (await db.query<{event_key:string;amount:number}>("select event_key,amount from academy_xp where user_id=$1 and course_id=$2 order by event_key", [learner,id])).rows;

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role;");
  for (const file of ["202609150001_pilot.sql", "202609160001_learning_rewards.sql"])
    await db.exec(readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), "utf8"));
  await db.query("insert into auth.users values($1),($2)", [admin,learner]);
  await db.query("insert into academy_profiles(id,name,email,role) values($1,'Admin','admin@demaria.com.br','admin'),($2,'Aluno','aluno@demaria.com.br','student')", [admin,learner]);
}, 30000);
afterAll(async () => { await db?.close(); });

describe("XP e cursos sem avaliação", () => {
  it.each([[0,15],[5,15],[6,20],[10,20],[11,25],[15,25],[16,30]])("%s minutos rendem %s XP", (minutes, xp) => expect(lessonXp(minutes)).toBe(xp));

  it("API aceita publicação sem avaliação e calcula XP no servidor", async () => {
    const calls: any[] = [];
    const mock = {rpc: async (_:string, args:any) => { calls.push(args); return {error:null}; }} as unknown as Parameters<typeof executeCommand>[0];
    await executeCommand(mock, {id:admin,role:"admin"} as Profile, {type:"save-resource",kind:"course",data:{...base,id:"api",xp:9999},publish:true,expectedVersion:0});
    expect(calls[0].command.data.xp).toBe(45);
    await expect(executeCommand(mock,{id:admin,role:"admin"} as Profile,{type:"save-resource",kind:"course",data:{...base,lessons:[...base.lessons,{...base.lessons[0],id:"quiz",type:"quiz"}]},publish:true,expectedVersion:0})).rejects.toThrow("avaliação");
  });

  it("conclui curso sem prova e não repete XP em solicitações concorrentes", async () => {
    await command(admin,{type:"save-resource",kind:"course",data:{...base,id:"no-quiz"},publish:true,expectedVersion:0});
    const complete={type:"complete",courseId:"no-quiz",version:1,lessonId:"lesson"};
    await Promise.all([command(learner,complete),command(learner,complete)]);
    expect(await events("no-quiz")).toEqual([{event_key:"completion",amount:30},{event_key:"lesson:lesson",amount:15}]);
    expect(courseXp(base)).toBe(45);
  });

  it("reprovação paga apenas acertos; recuperação paga 10 XP e evita repetir perguntas", async () => {
    const course={...base,id:"retry",retryPolicy:"free",questions:[{id:"choice",prompt:"Objetiva",type:"choice",options:["A","B"],correct:"A"},{id:"text",prompt:"Dissertativa",type:"text",options:[],correct:""}]};
    await command(admin,{type:"save-resource",kind:"course",data:course,publish:true,expectedVersion:0});
    await command(learner,{type:"complete",courseId:course.id,version:1,lessonId:"lesson"});
    for(const approved of [false,true]) {
      await command(learner,{type:"submit",courseId:course.id,version:1,answers:{choice:"A",text:"Resposta"}});
      const attempt=(await db.query<{id:string}>("select id from academy_attempts where course_id='retry' and status='pending'")).rows[0];
      await command(admin,{type:"review",id:attempt.id,score:approved?100:40,feedback:"Correção",correctTextIds:approved?["text"]:[]});
      if(!approved)expect(await events(course.id)).toEqual([{event_key:"lesson:lesson",amount:15},{event_key:"question:choice",amount:5}]);
    }
    expect(await events(course.id)).toEqual([{event_key:"approval",amount:10},{event_key:"completion",amount:30},{event_key:"lesson:lesson",amount:15},{event_key:"question:choice",amount:5},{event_key:"question:text",amount:8}]);
  });

  it("primeira aprovação paga 30 XP; resposta objetiva errada não recebe XP", async () => {
    const course={...base,id:"first",questions:[{id:"q",prompt:"Pergunta",type:"choice",options:["A","B"],correct:"A"}]};
    await command(admin,{type:"save-resource",kind:"course",data:course,publish:true,expectedVersion:0});
    await command(learner,{type:"complete",courseId:course.id,version:1,lessonId:"lesson"});
    await command(learner,{type:"submit",courseId:course.id,version:1,answers:{q:"B"}});
    const attempt=(await db.query<{id:string}>("select id from academy_attempts where course_id='first'")).rows[0];
    await command(admin,{type:"review",id:attempt.id,score:100,feedback:"Aprovado",correctTextIds:[]});
    expect(await events(course.id)).toEqual([{event_key:"approval",amount:30},{event_key:"completion",amount:30},{event_key:"lesson:lesson",amount:15}]);
  });

  it("alunos não excluem nem reprovam contas; administrador não exclui a si mesmo", async () => {
    const mock={} as Parameters<typeof executeCommand>[0];
    for(const type of ["delete-user","reject-user"]){
      await expect(executeCommand(mock,{id:learner,role:"student"} as Profile,{type,id:admin})).rejects.toMatchObject({status:403});
      await expect(executeCommand(mock,{id:admin,role:"admin"} as Profile,{type,id:admin})).rejects.toThrow("própria conta");
    }
  });

  it("vídeo só concede XP quando concluído e não repete com novos eventos do player", async () => {
    const course={...base,id:"video",lessons:[{...base.lessons[0],type:"video",minutes:11}]};
    await command(admin,{type:"save-resource",kind:"course",data:course,publish:true,expectedVersion:0});
    const input={type:"video",courseId:course.id,version:1,lessonId:"lesson",duration:660,ranges:[[0,60]]};
    await command(learner,{...input,done:false});
    expect(await events(course.id)).toHaveLength(0);
    await command(learner,{...input,done:true});
    await command(learner,{...input,done:true});
    expect(await events(course.id)).toEqual([{event_key:"completion",amount:30},{event_key:"lesson:lesson",amount:25}]);
  });

  it("preserva recompensas antigas sem conceder um segundo pagamento", async () => {
    await command(admin,{type:"save-resource",kind:"course",data:{...base,id:"legacy"},publish:true,expectedVersion:0});
    await db.query("insert into academy_xp(user_id,course_id,amount,season,label) values($1,'legacy',200,'2026','Histórico')",[learner]);
    await command(learner,{type:"complete",courseId:"legacy",version:1,lessonId:"lesson"});
    expect(await events("legacy")).toEqual([{event_key:"legacy",amount:200}]);
  });

  it("reprova apenas cadastro pendente e bloqueia mutações do usuário", async () => {
    await db.query("update academy_profiles set status='pending' where id=$1",[learner]);
    await expect(db.query("select academy_reject_user($1,$2)",[learner,admin])).rejects.toThrow("administradores");
    await db.query("select academy_reject_user($1,$2)",[admin,learner]);
    await expect(command(learner,{type:"complete",courseId:"no-quiz",version:1,lessonId:"lesson"})).rejects.toThrow("não autorizado");
    await expect(db.query("select academy_reject_user($1,$2)",[admin,learner])).rejects.toThrow("pendente");
    await db.query("update academy_profiles set status='active' where id=$1",[learner]);
  });

  it("nega execução direta das funções de XP ao navegador", async () => {
    await db.exec("set role authenticated");
    await expect(db.query("select academy_award_xp($1,'no-quiz','fake',9999,'Fraude')",[learner])).rejects.toThrow();
    await db.exec("reset role");
  });

  it("exclusão limpa histórico sem apagar subordinados ou auditoria", async () => {
    await db.query("update academy_profiles set manager_id=$1 where id=$2",[learner,admin]);
    await db.query("delete from auth.users where id=$1",[learner]);
    for(const table of ["academy_progress","academy_attempts","academy_xp"])
      expect((await db.query(`select * from ${table} where user_id=$1`,[learner])).rows).toHaveLength(0);
    expect((await db.query("select manager_id from academy_profiles where id=$1",[admin])).rows[0]).toEqual({manager_id:null});
    expect((await db.query("select * from academy_audit where actor is null")).rows.length).toBeGreaterThan(0);
  });
});
