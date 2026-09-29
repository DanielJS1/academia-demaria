import { afterAll, beforeAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const author="11111111-1111-4111-8111-111111111111";
const contributor="22222222-2222-4222-8222-222222222222";
const reader="33333333-3333-4333-8333-333333333333";
let db:PGlite;
const migration=(name:string)=>readFileSync(new URL(`../../supabase/migrations/${name}.sql`,import.meta.url),"utf8");
const collaborate=(actor:string,input:Record<string,unknown>)=>db.query("select academy_article_collaborate($1::uuid,$2::jsonb)",[actor,JSON.stringify(input)]);
const react=(actor:string,articleId:string,reaction="like")=>db.query("select academy_community_mutate($1::uuid,$2::jsonb)",[actor,JSON.stringify({type:"community-react",articleId,reaction,active:true})]);
beforeAll(async()=>{
 db=new PGlite();
 await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role;");
 await db.exec(migration("202609150001_pilot"));
 await db.exec(migration("202609160001_learning_rewards"));
 await db.exec("alter table academy_profiles add column audience text not null default 'internal';");
 await db.exec(migration("202609210001_community"));
 await db.exec(migration("20260929183000_article_collaboration"));
 for(const [id,name] of [[author,"Autora"],[contributor,"Colaborador"],[reader,"Leitora"]]){
  await db.query("insert into auth.users values($1)",[id]);
  await db.query("insert into academy_profiles(id,name,email) values($1,$2,$3)",[id,name,`${id}@demaria.com.br`]);
 }
 for(const id of ["accepted","rejected"]){
  const content="Conteúdo original com orientações suficientes para publicar um artigo na biblioteca e ajudar a equipe no atendimento diário.";
  const article={id,title:`Artigo ${id}`,product:"Geral",category:"Guia",content,author:"Outro nome",status:"draft",revision:1,updatedAt:"2026-01-01",blocks:[{id:"first",type:"paragraph",text:content}]};
  await db.query("select academy_community_mutate($1::uuid,$2::jsonb)",[author,JSON.stringify({type:"community-save",data:article,publish:true,expectedVersion:0})]);
 }
},30000);
afterAll(async()=>{await db?.close();});

it("só o autor analisa; aceitar publica, registra coautoria e limita XP",async()=>{
 const content="Inclua a verificação final com o cliente antes de encerrar o atendimento.";
 await expect(collaborate(author,{type:"community-suggest",articleId:"accepted",content})).rejects.toThrow("já é autor");
 await collaborate(contributor,{type:"community-suggest",articleId:"accepted",content});
 await expect(collaborate(contributor,{type:"community-suggest",articleId:"accepted",content})).rejects.toThrow();
 const suggestion=(await db.query<{id:string}>("select id from academy_article_suggestions where article_id='accepted'")).rows[0];
 await expect(collaborate(reader,{type:"community-review-suggestion",articleId:"accepted",suggestionId:suggestion.id,decision:"accept"})).rejects.toThrow("Somente o autor");
 await collaborate(author,{type:"community-review-suggestion",articleId:"accepted",suggestionId:suggestion.id,decision:"accept"});
 const saved=(await db.query<{published:{content:string;blocks:{text:string}[]}}>("select published from academy_resources where id='accepted'")).rows[0].published;
 expect(saved.content).toContain(content);
 expect(saved.blocks.at(-1)?.text).toBe(content);
 expect((await db.query("select * from academy_article_coauthors where article_id='accepted'")).rows).toHaveLength(1);
 expect((await db.query<{amount:number}>("select sum(amount)::integer amount from academy_xp where user_id=$1 and course_id='accepted' and event_key like 'collab:%'",[contributor])).rows[0].amount).toBe(5);
 await react(reader,"accepted");
 await react(reader,"accepted","hype");
 expect((await db.query<{amount:number}>("select sum(amount)::integer amount from academy_xp where user_id=$1 and course_id='accepted' and event_key like 'collab:interaction:%'",[contributor])).rows[0].amount).toBe(1);
 await expect(react(contributor,"accepted")).rejects.toThrow("Coautores não podem");
 await expect(db.query("select academy_community_mutate($1::uuid,$2::jsonb)",[contributor,JSON.stringify({type:"community-comment",articleId:"accepted",commentId:"44444444-4444-4444-8444-444444444444",content:"Gostei"})])).rejects.toThrow("Coautores não podem");
 await expect(collaborate(author,{type:"community-review-suggestion",articleId:"accepted",suggestionId:suggestion.id,decision:"accept"})).rejects.toThrow("não está pendente");
});

it("recusar mantém o artigo e não concede coautoria",async()=>{
 await collaborate(reader,{type:"community-suggest",articleId:"rejected",content:"Sugiro adicionar um passo de conferência para o próximo atendimento."});
 const suggestion=(await db.query<{id:string}>("select id from academy_article_suggestions where article_id='rejected'")).rows[0];
 await collaborate(author,{type:"community-review-suggestion",articleId:"rejected",suggestionId:suggestion.id,decision:"reject"});
 expect((await db.query("select * from academy_article_coauthors where article_id='rejected'")).rows).toHaveLength(0);
 expect((await db.query<{published:{content:string}}>("select published from academy_resources where id='rejected'")).rows[0].published.content).not.toContain("conferência");
});
