import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { initialState } from "../seed";
const admin="11111111-1111-4111-8111-111111111111", learner="22222222-2222-4222-8222-222222222222", reader="33333333-3333-4333-8333-333333333333";
const db = new PGlite();
const migration = "20261013011330_report_temporal_events.sql";
const sql = (name: string) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8").replace(/^\uFEFF/, "");
const cmd = (actor: string, command: unknown) => db.query("select academy_mutate($1::uuid,$2::jsonb)",[actor,JSON.stringify(command)]);
const community = (actor: string, command: unknown) => db.query("select academy_community_mutate($1::uuid,$2::jsonb)",[actor,JSON.stringify(command)]);
const course = (id: string, quiz=false) => ({ ...initialState.courses[0], id, version: 1, lessons: [
 { ...initialState.courses[0].lessons[0], id:"reading" }, ...(quiz?[{ ...initialState.courses[0].lessons[4], id:"quiz", questions:[{id:"q",prompt:"Explique o procedimento",type:"text",options:[],correct:""}] }]:[]) ] });
const saveCourse = (id:string, quiz=false) => cmd(admin,{type:"save-resource",kind:"course",data:course(id,quiz),publish:true,expectedVersion:0});
const finish = (id:string) => cmd(learner,{type:"complete",courseId:id,version:1,lessonId:"reading"});
const article = (id:string) => ({id,title:"Procedimento completo",product:"DOC-Windows",category:"Suporte",content:"Procedimento de consulta para a equipe. ".repeat(5)});
const publish = (id:string,revision=0) => community(learner,{type:"community-save",data:article(id),publish:true,expectedVersion:revision});
const events = async (id:string) => Number((await db.query<{n:number}>("select count(*)::int n from academy_report_completions where course_id=$1",[id])).rows[0].n);
const xp = async (id:string) => Number((await db.query<{n:number}>("select coalesce(sum(amount),0)::int n from academy_xp where course_id=$1",[id])).rows[0].n);
beforeAll(async()=>{
 await db.exec("create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
 for(const name of ["202609150001_pilot.sql","202609160001_learning_rewards.sql","202609170001_activity_assessments.sql","202609170002_fix_settings_where_clause.sql","202609170003_cartorios_and_clients.sql","202609170004_partial_reviews_and_proficiency.sql","202609210001_community.sql","202609230001_media_rich_articles.sql","202609240006_video_progress.sql","20260929130000_multiple_choice_quizzes.sql","20260929183000_article_collaboration.sql","20260929193000_full_article_suggestions.sql"]) await db.exec(sql(name));
 await db.exec(sql("202609240001_manager_recognition.sql"));await db.exec(sql("202609240007_recognition_idempotency.sql"));
 for(const id of [admin,learner,reader]) {await db.query("insert into auth.users values($1)",[id]); await db.query("insert into academy_profiles(id,name,email,role) values($1,'Pessoa',$2,$3)",[id,`${id}@demaria.com.br`,id===admin?"admin":"student"]);}
 await saveCourse("baseline");await finish("baseline");await publish("legacy-publication");
 await db.query("insert into academy_resources(id,kind,published,revision) values('unknown-publication','article',$1,1)",[JSON.stringify({...article("unknown-publication"),status:"published"})]);
 await db.query("insert into academy_community_articles(article_id,author_id) values('unknown-publication',$1)",[learner]);
 await db.exec("update academy_community_rewards set amount=0 where article_id='legacy-publication';");
 await db.exec(sql(migration));
},30000);
afterAll(async()=>{await db.close();});
describe("prospective analytics migration with real learning/community RPCs",()=>{
 it("preserves unknown baseline dates and imports zero-point legacy publication proof",async()=>{
  expect(await events("baseline")).toBe(0); const priorXP=await xp("baseline");await finish("baseline");
  expect(await events("baseline")).toBe(0);expect(await xp("baseline")).toBe(priorXP);
  const publication=(await db.query<{origin:string;first_published_at:Date}>("select * from academy_report_publications where article_id='legacy-publication'")).rows[0];
  expect(publication.origin).toBe("legacy_reward");expect(publication.first_published_at).toBeTruthy();
  await publish("unknown-publication",1);
  expect((await db.query("select origin,first_published_at from academy_report_publications where article_id='unknown-publication'")).rows[0]).toEqual({origin:"baseline_unknown",first_published_at:null});
  await db.exec("delete from academy_progress where course_id='baseline'");await finish("baseline");expect(await events("baseline")).toBe(0);
 });
 it("records first publication once; editing and repeated activation do not inflate events or rewards",async()=>{
  await publish("new-article");const prior=(await db.query("select * from academy_report_publications where article_id='new-article'")).rows[0];
  await publish("new-article",1);expect((await db.query("select * from academy_report_publications where article_id='new-article'")).rows[0]).toEqual(prior);
  for(const active of [true,true,false,true]) await community(reader,{type:"community-react",articleId:"new-article",reaction:"like",active});
  const counts=(await db.query<{total:number;activated:number;distinct_count:number}>("select count(*)::int total,count(*) filter(where active)::int activated,count(distinct(user_id,article_id,reaction)) filter(where active)::int distinct_count from academy_report_reactions where article_id='new-article'")).rows[0];
  expect(counts).toEqual({total:3,activated:2,distinct_count:1});
  expect((await db.query<{n:number}>("select count(*)::int n from academy_community_rewards where article_id='new-article' and action='like'")).rows[0].n).toBe(1);
 });
 it("counts comments that receive no reward, without storing bodies in analytics",async()=>{
  for(let n=0;n<4;n++) await community(reader,{type:"community-comment",articleId:"new-article",commentId:crypto.randomUUID(),content:`Comentário útil ${n}`});
  expect((await db.query<{n:number}>("select count(*)::int n from academy_community_comments where article_id='new-article'")).rows[0].n).toBe(4);
  expect((await db.query<{n:number}>("select count(*)::int n from academy_community_rewards where article_id='new-article' and action='comment'")).rows[0].n).toBe(1);
  const columns=(await db.query<{column_name:string}>("select column_name from information_schema.columns where table_name like 'academy_report_%'")).rows.map(row=>row.column_name);
  expect(columns).not.toContain("content");expect(columns).not.toContain("answers");
 });
 it("records a late approval, preserves XP idempotency, and does not record pending as completion",async()=>{
  await saveCourse("late-approval",true);await finish("late-approval");
  await cmd(learner,{type:"submit",courseId:"late-approval",version:1,quizId:"quiz",answers:{q:"Explicação com conteúdo suficiente."}});
  expect(await events("late-approval")).toBe(0);
  const attempt=(await db.query<{id:string}>("select id from academy_attempts where course_id='late-approval'")).rows[0].id;
  await cmd(admin,{type:"review",id:attempt,score:80,feedback:"Procedimento aprovado.",correctTextIds:["q"],partialTextIds:[]});
  expect(await events("late-approval")).toBe(1);const priorXP=await xp("late-approval");
  await finish("late-approval");expect(await events("late-approval")).toBe(1);expect(await xp("late-approval")).toBe(priorXP);
  await expect(cmd(admin,{type:"review",id:attempt,score:80,feedback:"Repetição"})).rejects.toThrow();expect(await events("late-approval")).toBe(1);
 });
 it("captures proficiency approval in the same write and rolls back analytics with the source",async()=>{
  await saveCourse("proficiency",true);await finish("proficiency");expect(await events("proficiency")).toBe(0);
  await db.query("insert into academy_attempts(user_id,course_id,version,quiz_id,snapshot,answers,status,score) values($1,'proficiency',1,'proficiency',$2,'{}','approved',90)",[learner,JSON.stringify({...course("proficiency",true),proficiency:true})]);
  expect(await events("proficiency")).toBe(1);
  await saveCourse("rollback");await db.exec("begin");await finish("rollback");expect(await events("rollback")).toBe(1);await db.exec("rollback");
  expect(await events("rollback")).toBe(0);expect(await xp("rollback")).toBe(0);
 });
 it("protects analytics tables and helper functions from browser roles",async()=>{
  await db.exec("set role authenticated");
  await expect(db.query("select * from academy_report_completions")).rejects.toThrow();
  await expect(db.query("select academy_report_is_complete($1,'baseline',1)",[learner])).rejects.toThrow();
  await db.exec("reset role");
 });
 it("keeps recognition rewards idempotent without adding completion or XP side effects",async()=>{
  const id=crypto.randomUUID();
  for(let n=0;n<2;n++) await db.query("select academy_grant_recognition($1,$2,'Conquista reconhecida','Boa atuação na equipe',$3)",[admin,learner,id]);
  expect((await db.query<{n:number}>("select sum(amount)::int n from academy_xp where event_key=$1",[`recognition:${id}`])).rows[0].n).toBe(100);
  expect((await db.query<{n:number}>("select count(*)::int n from academy_recognitions where request_id=$1",[id])).rows[0].n).toBe(1);
 });
 it("tracks the current version when late legacy proficiency satisfies the existing completion rule",async()=>{
  await saveCourse("old-proficiency",true);
  await db.query("insert into academy_attempts(user_id,course_id,version,quiz_id,snapshot,answers,status) values($1,'old-proficiency',1,'proficiency',$2,'{}','pending')",[learner,JSON.stringify({...course("old-proficiency",true),proficiency:true})]);
  await cmd(admin,{type:"save-resource",kind:"course",data:course("old-proficiency",true),publish:true,expectedVersion:1});
  await cmd(learner,{type:"complete",courseId:"old-proficiency",version:2,lessonId:"reading"});
  expect(await events("old-proficiency")).toBe(0);
  await db.exec("update academy_attempts set status='approved',score=90 where course_id='old-proficiency'");
  expect((await db.query("select version from academy_report_completions where course_id='old-proficiency'")).rows).toEqual([{version:2}]);
 });
});
