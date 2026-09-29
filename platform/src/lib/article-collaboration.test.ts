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
 await db.exec(migration("20260929193000_full_article_suggestions"));
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

it("proposta completa preserva o original até o autor aceitar e publica mídia e código",async()=>{
 const id="full-edit";
 const original="Procedimento original com orientações suficientes para publicar o artigo e apoiar toda a equipe durante o atendimento.";
 const changed="Procedimento revisado com novas etapas, uma imagem e um comando SQL para apoiar toda a equipe durante o atendimento.";
 const originalArticle={id,title:"Procedimento original",product:"Geral",category:"Guia",content:original,author:"Autora",status:"draft",revision:1,updatedAt:"2026-01-01",richContent:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:original}]}]}};
 await db.query("select academy_community_mutate($1::uuid,$2::jsonb)",[author,JSON.stringify({type:"community-save",data:originalArticle,publish:true,expectedVersion:0})]);
 const before=(await db.query<{published:{title:string;content:string};revision:number}>("select published,revision from academy_resources where id=$1",[id])).rows[0];
 const richContent={type:"doc",content:[{type:"paragraph",content:[{type:"text",text:changed}]},{type:"image",attrs:{src:"https://example.com/help.png",alt:"Nova captura"}},{type:"codeBlock",content:[{type:"text",text:"select 1;"}]}]};
 const proposal={...originalArticle,title:"Procedimento revisado",content:changed,richContent};
 const suggest=()=>db.query<{academy_article_suggest_edit:string}>("select academy_article_suggest_edit($1::uuid,$2,$3,$4::jsonb,$5)",[contributor,id,before.revision,JSON.stringify(proposal),"Atualizei o fluxo e incluí imagem e SQL."]);
 await expect(db.query("select academy_article_suggest_edit($1::uuid,$2,$3,$4::jsonb,$5)",[author,id,before.revision,JSON.stringify(proposal),"Atualizei o fluxo e incluí imagem e SQL."])).rejects.toThrow("já é autor");
 const suggestionId=(await suggest()).rows[0].academy_article_suggest_edit;
 expect((await db.query<{published:{title:string;content:string}}>("select published from academy_resources where id=$1",[id])).rows[0].published).toEqual(before.published);
 await expect(db.query("select academy_article_review_edit($1::uuid,$2,$3::uuid,$4)",[reader,id,suggestionId,"accept"])).rejects.toThrow("Somente o autor");
 await db.query("select academy_article_review_edit($1::uuid,$2,$3::uuid,$4)",[author,id,suggestionId,"accept"]);
 const after=(await db.query<{published:{title:string;content:string;richContent:typeof richContent};revision:number}>("select published,revision from academy_resources where id=$1",[id])).rows[0];
 expect(after.published.title).toBe("Procedimento revisado");
 expect(after.published.content).toBe(changed);
 expect(after.published.richContent).toEqual(richContent);
 expect(after.revision).toBe(before.revision+1);
 expect((await db.query("select * from academy_article_coauthors where article_id=$1",[id])).rows).toHaveLength(1);
 expect((await db.query<{amount:number}>("select amount from academy_xp where user_id=$1 and event_key=$2",[contributor,`collab:bonus:${suggestionId}`])).rows[0].amount).toBe(5);
});

it("o autor pode ajustar a proposta completa antes de aceitar",async()=>{
 const id="adjusted";
 const original="Texto original com detalhes suficientes para orientar o atendimento da equipe em um procedimento de rotina.";
 const proposed="Texto proposto com detalhes suficientes para orientar o atendimento da equipe em um procedimento de rotina.";
 const adjusted="Texto ajustado pela autora com detalhes suficientes para orientar o atendimento da equipe em um procedimento de rotina.";
 const article={id,title:"Guia original",product:"Geral",category:"Guia",content:original,author:"Autora",status:"draft",revision:1,updatedAt:"2026-01-01",richContent:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:original}]}]}};
 await db.query("select academy_community_mutate($1::uuid,$2::jsonb)",[author,JSON.stringify({type:"community-save",data:article,publish:true,expectedVersion:0})]);
 const revision=(await db.query<{revision:number}>("select revision from academy_resources where id=$1",[id])).rows[0].revision;
 const proposal={...article,title:"Guia proposto",content:proposed,richContent:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:proposed}]}]}};
 const suggestionId=(await db.query<{academy_article_suggest_edit:string}>("select academy_article_suggest_edit($1::uuid,$2,$3,$4::jsonb,$5)",[contributor,id,revision,JSON.stringify(proposal),"Atualizei as orientações do procedimento."])).rows[0].academy_article_suggest_edit;
 const adjustment={...proposal,title:"Guia aprovado com ajustes",content:adjusted,richContent:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:adjusted}]}]}};
 await db.query("select academy_article_review_edit($1::uuid,$2,$3::uuid,$4,$5::jsonb)",[author,id,suggestionId,"accept",JSON.stringify(adjustment)]);
 const published=(await db.query<{published:{title:string;content:string;richContent:{content:{content:{text:string}[]}[]}}}>("select published from academy_resources where id=$1",[id])).rows[0].published;
 expect(published.title).toBe("Guia aprovado com ajustes");
 expect(published.content).toBe(adjusted);
 expect(published.richContent.content[0].content[0].text).toBe(adjusted);
 expect((await db.query("select * from academy_article_coauthors where article_id=$1",[id])).rows).toHaveLength(1);
});
