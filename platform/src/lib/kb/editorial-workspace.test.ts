import { PGlite } from "@electric-sql/pglite";
import { beforeAll,afterAll,describe,it,expect } from "vitest";
import { initializeLocal,asLocal,pilotProfiles } from "./local-db";
import { newDocument,identifyBlocks } from "./document";
describe("shared editorial metadata and reversible trash",()=>{
 const db=new PGlite(),author=pilotProfiles[0].id,admin=pilotProfiles[1].id,other=pilotProfiles[2].id;
 const rpc=(actor:string|null,cmd:object)=>asLocal(db,actor,async tx=>(await tx.query<{id:string}>("select kb_mutate($1) as id",[JSON.stringify(cmd)])).rows[0].id);
 const index=(actor:string|null,filter="all",page=1,q="")=>asLocal(db,actor,async tx=>(await tx.query<{r:{articles:{id:string;author_name:string;can_edit:boolean;document?:unknown}[];total:number;counts:Record<string,number>}}>("select kb_editorial_index($1,$2,$3) as r",[filter,page,q])).rows[0].r);
 const trash=(actor:string|null,id:string,version:number,restore=false)=>asLocal(db,actor,async tx=>(await tx.query<{r:{status:string}}>("select kb_trash_article($1,$2,$3) as r",[id,version,restore])).rows[0].r);
 const document=(title:string)=>{const d=newDocument();d.metadata={...d.metadata,title,summary:"Descrição completa para o artigo.",product:"DOC-Windows"};d.sections.forEach(s=>s.content=identifyBlocks({type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"Conteúdo privado de uma revisão editorial."}]}]}));return d;};
 let own:string,foreign:string;
 beforeAll(async()=>{await initializeLocal(db);own=await rpc(author,{action:"create",document:document("Antigo editado depois")});foreign=await rpc(other,{action:"create",document:document("Novo artigo de outro autor")});await db.query("update kb_articles set created_at=$2::timestamptz,updated_at=now() where id=$1",[own,"2020-01-01"]);await db.query("update kb_articles set created_at=$2::timestamptz where id=$1",[foreign,"2021-01-01"]);},30000);
 afterAll(()=>db.close());
 it("shares only listing metadata, newest creation first, preserving draft ownership",async()=>{
  const r=await index(author);expect(r.total).toBe(2);expect(r.articles.map(a=>a.id)).toEqual([foreign,own]);expect(r.articles[0]).toMatchObject({author_name:"Outro autor",can_edit:false});expect(r.articles.every(a=>!("document" in a))).toBe(true);expect((await index(author,"mine")).total).toBe(1);expect((await index(author,"all",1,"Outro autor")).articles[0].id).toBe(foreign);
  await expect(asLocal(db,author,async tx=>tx.query("select document from kb_drafts where article_id=$1",[foreign])).then(r=>r.rows)).resolves.toEqual([]);
  for(const actor of [null,pilotProfiles[3].id,pilotProfiles[4].id])await expect(index(actor)).rejects.toThrow();
  await expect(trash(author,foreign,1)).rejects.toThrow();
 });
 it("hides deleted items by default and restores a draft with audit and conflict protection",async()=>{
  expect(await trash(author,own,1)).toEqual({status:"deleted",id:own});expect((await index(author)).total).toBe(1);const removed=await index(author,"deleted");expect(removed.total).toBe(1);expect(removed.counts.deleted).toBe(1);
  await expect(trash(author,own,1,true)).rejects.toThrow(/Conflict/);expect(await trash(author,own,2,true)).toEqual({status:"draft",id:own});expect((await index(author)).total).toBe(2);
  expect((await db.query<{action:string}>("select action from kb_review_events where article_id=$1 and action in ('trash','restore_from_trash') order by created_at",[own])).rows.map(r=>r.action)).toEqual(["trash","restore_from_trash"]);
 });
 it("removes a publication atomically and restores it archived, without republishing",async()=>{
  await rpc(other,{action:"submit",articleId:foreign,expectedVersion:1});const s=(await db.query<{id:string;revision_id:string}>("select id,revision_id from kb_submissions where article_id=$1 and status='pending'",[foreign])).rows[0];await rpc(admin,{action:"publish",articleId:foreign,expectedVersion:2,submissionId:s.id,revisionId:s.revision_id,visibility:"public"});
  await trash(other,foreign,3);expect((await db.query("select * from kb_publications where article_id=$1",[foreign])).rows).toHaveLength(0);await trash(other,foreign,4,true);expect((await index(author,"archived")).total).toBe(1);expect((await index(author)).total).toBe(1);expect((await db.query("select * from kb_publications where article_id=$1",[foreign])).rows).toHaveLength(0);
 });
 it("withdraws pending submissions when the article goes to trash",async()=>{
  await rpc(author,{action:"submit",articleId:own,expectedVersion:3});await trash(author,own,4);expect((await db.query<{status:string}>("select status from kb_submissions where article_id=$1",[own])).rows[0].status).toBe("withdrawn");await trash(author,own,5,true);expect((await index(author,"draft")).total).toBe(1);
 });
});
