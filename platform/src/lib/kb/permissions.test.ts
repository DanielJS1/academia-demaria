import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { initializeLocal, asLocal, pilotProfiles } from "./local-db";
import { identifyBlocks,newDocument } from "./document";

describe("BC: PostgreSQL real, RPC e RLS", () => {
  const db = new PGlite(); const author=pilotProfiles[0].id,admin=pilotProfiles[1].id;
  const doc=newDocument(); doc.metadata={...doc.metadata,title:"Procedimento público DOC-Windows",summary:"Conferir configurações do sistema.",product:"DOC-Windows",category:"Selagem",tags:["configuração","etiquetaexclusiva"]};
  doc.sections.forEach(s=>s.content=identifyBlocks({type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"Instruções suficientes para esta seção."}]}]}));
  let aid:string, version=1, sid:string,rid:string;
  const rpc=async(actor:string|null,cmd:object)=>asLocal(db,actor,async tx=>(await tx.query<{id:string}>("select kb_mutate($1::jsonb) id",[JSON.stringify(cmd)])).rows[0].id);
  beforeAll(async()=>{await initializeLocal(db);},30000); afterAll(async()=>{await db.close();});
  it("nega visitante, cliente, pendente e inativo ao criar",async()=>{
    for(const actor of [null,...pilotProfiles.slice(3).map(p=>p.id)]) await expect(rpc(actor,{action:"create",document:doc})).rejects.toThrow();
    aid=await rpc(author,{action:"create",document:doc,slug:"procedimento-piloto"});
  });
  it("protege rascunho/histórico alheio e escrita direta",async()=>{
    for (const actor of [pilotProfiles[2].id,pilotProfiles[3].id]) expect(await asLocal(db,actor,async tx=>(await tx.query("select * from kb_drafts")).rows)).toHaveLength(0);
    await expect(asLocal(db,author,async tx=>tx.query("update kb_articles set owner_id=$1 where id=$2",[admin,aid]))).rejects.toThrow();
    await expect(rpc(pilotProfiles[2].id,{action:"save",articleId:aid,expectedVersion:1,document:doc,visibility:"public"})).rejects.toThrow();
  });
  it("bloqueia estrutura e HTML executável via RPC direto",async()=>{
    const formatted=structuredClone(doc);formatted.sections[0].content=identifyBlocks({type:"doc",content:[{type:"paragraph",attrs:{textAlign:"justify"},content:[{type:"text",text:"Texto com formatação autorizada.",marks:[{type:"textStyle",attrs:{color:"#087b80",fontSize:"18px"}},{type:"highlight",attrs:{color:"#fef08a"}},{type:"superscript"}]}]}]});
    const formattedId=await rpc(author,{action:"create",document:formatted});await rpc(author,{action:"submit",articleId:formattedId,expectedVersion:1});
    formatted.sections[0].content.content![0].content![0].marks=[{type:"textStyle",attrs:{color:"url(javascript:alert(1))"}}];await expect(rpc(author,{action:"create",document:formatted})).rejects.toThrow();
    await expect(rpc(author,{action:"save",articleId:aid,expectedVersion:1,document:{...doc,schemaVersion:"1"},visibility:"public"})).rejects.toThrow();
    await expect(rpc(author,{action:"save",articleId:aid,expectedVersion:1,document:{...doc,metadata:{...doc.metadata,title:"x".repeat(241)}},visibility:"public"})).rejects.toThrow();
    await expect(rpc(author,{action:"save",articleId:aid,expectedVersion:1,document:{...doc,sections:[]},visibility:"public"})).rejects.toThrow();
    const forged=structuredClone(doc);forged.sections[0].content.content![0].attrs={onclick:"alert(1)"};
    await expect(rpc(author,{action:"save",articleId:aid,expectedVersion:1,document:forged,visibility:"public"})).rejects.toThrow();
  });
  it("submete snapshot e só administrador decide a revisão exata",async()=>{
    await rpc(author,{action:"save",articleId:aid,expectedVersion:version++,document:doc,visibility:"public"});
    await rpc(author,{action:"submit",articleId:aid,expectedVersion:version++});
    const s=(await db.query<{id:string;revision_id:string}>("select * from kb_submissions where article_id=$1 and status='pending'",[aid])).rows[0];sid=s.id;rid=s.revision_id;
    await expect(rpc(author,{action:"publish",articleId:aid,expectedVersion:version,submissionId:sid,revisionId:rid,visibility:"public"})).rejects.toThrow();
    await expect(rpc(admin,{action:"publish",articleId:aid,expectedVersion:version,submissionId:sid,revisionId:crypto.randomUUID(),visibility:"public"})).rejects.toThrow();
    await rpc(admin,{action:"return",articleId:aid,expectedVersion:version++,submissionId:sid,revisionId:rid,comment:"Revise o resultado."});
    expect((await asLocal(db,author,async tx=>(await tx.query("select comment from kb_review_events where action='return'")).rows))[0]).toEqual({comment:"Revise o resultado."});
    await rpc(author,{action:"submit",articleId:aid,expectedVersion:version++});
    const next=(await db.query<{id:string;revision_id:string}>("select * from kb_submissions where article_id=$1 and status='pending'",[aid])).rows[0];sid=next.id;rid=next.revision_id;
    await rpc(admin,{action:"publish",articleId:aid,expectedVersion:version++,submissionId:sid,revisionId:rid,visibility:"public"});
    expect(await asLocal(db,null,async tx=>(await tx.query("select * from kb_search('configuracao')")).rows)).toHaveLength(1);
    // Match terms found only in tags or body, independently of the title.
    expect(await asLocal(db,null,async tx=>(await tx.query("select * from kb_search('etiquetaexclusiva')")).rows)).toHaveLength(1);
    expect(await asLocal(db,null,async tx=>(await tx.query("select * from kb_search('suficientes')")).rows)).toHaveLength(1);
    expect(await asLocal(db,null,async tx=>(await tx.query("select * from kb_search('procedimento')")).rows)).toHaveLength(1);
  });
  it("rascunho e devolução não mudam publicação",async()=>{
    const edited=structuredClone(doc);edited.metadata.title="Título em rascunho";
    await rpc(author,{action:"save",articleId:aid,expectedVersion:version++,document:edited,visibility:"private"});
    expect((await asLocal(db,null,async tx=>(await tx.query<{title:string}>("select title from kb_publications")).rows))[0].title).toBe(doc.metadata.title);
  });
  it("retirada invalida aprovação obsoleta, conflito não publica",async()=>{
    await rpc(author,{action:"submit",articleId:aid,expectedVersion:version++});
    const s=(await db.query<{id:string;revision_id:string}>("select * from kb_submissions where article_id=$1 and status='pending'",[aid])).rows[0];
    const stale=version;
    await rpc(author,{action:"withdraw",articleId:aid,expectedVersion:version++,submissionId:s.id,revisionId:s.revision_id});
    await expect(rpc(admin,{action:"publish",articleId:aid,expectedVersion:stale,submissionId:s.id,revisionId:s.revision_id,visibility:"public"})).rejects.toThrow(/Conflict/);
    await expect(rpc(admin,{action:"publish",articleId:aid,expectedVersion:version,submissionId:s.id,revisionId:s.revision_id,visibility:"public"})).rejects.toThrow(/Obsolete/);
  });
  it("tornar privado e despublicar retiram leitura/busca/contagens",async()=>{
    await rpc(admin,{action:"visibility",articleId:aid,expectedVersion:version++,visibility:"private"});
    for(const actor of [null,pilotProfiles[3].id,pilotProfiles[4].id,pilotProfiles[5].id]) expect(await asLocal(db,actor,async tx=>(await tx.query("select * from kb_search('')")).rows)).toHaveLength(0);
    expect(await asLocal(db,author,async tx=>(await tx.query("select * from kb_publications")).rows)).toHaveLength(1);
    await rpc(admin,{action:"unpublish",articleId:aid,expectedVersion:version++});
    expect(await asLocal(db,author,async tx=>(await tx.query("select * from kb_publications")).rows)).toHaveLength(0);
  });
  it("autoriza mídia somente pela publicação corrente e protege referências históricas",async()=>{
    const mediaId=crypto.randomUUID();
    await db.query("insert into kb_media(id,article_id,owner_id,provider,storage_key,name,mime,bytes,width,height,checksum,ready) values($1,$2,$3,'local',$4,'captura.png','image/png',100,645,42,'fixture',true)",[mediaId,aid,author,`${aid}/${mediaId}`]);
    const imageDoc=structuredClone(doc);imageDoc.sections[2].content.content!.push(identifyBlocks({type:"image",attrs:{mediaId,alt:"Captura de homologação",width:645,height:42}}));
    await rpc(author,{action:"save",articleId:aid,expectedVersion:version++,document:imageDoc,visibility:"public"});
    expect(await asLocal(db,null,async tx=>(await tx.query("select * from kb_media_access($1)",[mediaId])).rows)).toHaveLength(0);
    expect(await asLocal(db,pilotProfiles[2].id,async tx=>(await tx.query("select * from kb_media_access($1)",[mediaId])).rows)).toHaveLength(0);
    await expect(asLocal(db,author,async tx=>tx.query("select kb_delete_media($1)",[mediaId]))).rejects.toThrow(/Media in use/);
    await rpc(author,{action:"submit",articleId:aid,expectedVersion:version++});
    const s=(await db.query<{id:string;revision_id:string}>("select * from kb_submissions where article_id=$1 and status='pending'",[aid])).rows[0];
    await rpc(admin,{action:"publish",articleId:aid,expectedVersion:version++,submissionId:s.id,revisionId:s.revision_id,visibility:"public"});
    expect(await asLocal(db,null,async tx=>(await tx.query("select * from kb_media_access($1)",[mediaId])).rows)).toHaveLength(1);
    await rpc(admin,{action:"visibility",articleId:aid,expectedVersion:version++,visibility:"private"});
    expect(await asLocal(db,null,async tx=>(await tx.query("select * from kb_media_access($1)",[mediaId])).rows)).toHaveLength(0);
    expect(await asLocal(db,pilotProfiles[3].id,async tx=>(await tx.query("select * from kb_media_access($1)",[mediaId])).rows)).toHaveLength(0);
    expect(await asLocal(db,author,async tx=>(await tx.query("select * from kb_media_access($1)",[mediaId])).rows)).toHaveLength(1);
    await rpc(admin,{action:"unpublish",articleId:aid,expectedVersion:version++});
    await expect(asLocal(db,admin,async tx=>tx.query("select kb_delete_media($1)",[mediaId]))).rejects.toThrow(/Media in use/);
    const orphan=crypto.randomUUID();await db.query("insert into kb_media(id,article_id,owner_id,provider,storage_key,name,mime,bytes,width,height,checksum,ready) values($1,$2,$3,'local',$4,'orfao.png','image/png',100,1,1,'fixture',true)",[orphan,aid,author,`${aid}/${orphan}`]);
    await expect(asLocal(db,pilotProfiles[2].id,async tx=>tx.query("select kb_delete_media($1)",[orphan]))).rejects.toThrow(/Forbidden/);
    await asLocal(db,author,async tx=>tx.query("select kb_delete_media($1)",[orphan]));
  });
  it("avisos ficam restritos ao destinatário e conteúdo editorial é imutável",async()=>{
    const notices=await asLocal(db,author,async tx=>(await tx.query<{id:string}>("select id from kb_notifications")).rows);
    expect(notices.length).toBeGreaterThan(0);
    expect(await asLocal(db,pilotProfiles[2].id,async tx=>(await tx.query("select * from kb_notifications")).rows)).toHaveLength(0);
    await expect(asLocal(db,author,async tx=>tx.query("update kb_notifications set message='forjado' where id=$1",[notices[0].id]))).rejects.toThrow();
    await asLocal(db,author,async tx=>tx.query("update kb_notifications set read_at=now() where id=$1",[notices[0].id]));
    await expect(asLocal(db,admin,async tx=>tx.query("update kb_revisions set document='{}' where article_id=$1",[aid]))).rejects.toThrow();
  });
  it("submissão valida completude, IDs e vínculo de mídia no RPC",async()=>{
    const incomplete=newDocument();const id=await rpc(author,{action:"create",document:incomplete});
    await expect(rpc(author,{action:"submit",articleId:id,expectedVersion:1})).rejects.toThrow();
    const invalid=structuredClone(doc);invalid.sections[0].content.content![0].attrs={blockId:invalid.sections[1].content.content![0].attrs!.blockId};
    await rpc(author,{action:"save",articleId:id,expectedVersion:1,document:invalid,visibility:"private"});
    await expect(rpc(author,{action:"submit",articleId:id,expectedVersion:2})).rejects.toThrow();
    const foreign=(await db.query<{id:string}>("select id from kb_media where article_id=$1 and ready limit 1",[aid])).rows[0].id;
    const wrongMedia=structuredClone(doc);wrongMedia.sections[2].content.content!.push(identifyBlocks({type:"image",attrs:{mediaId:foreign,alt:"Mídia alheia"}}));
    await rpc(author,{action:"save",articleId:id,expectedVersion:2,document:wrongMedia,visibility:"private"});
    await expect(rpc(author,{action:"submit",articleId:id,expectedVersion:3})).rejects.toThrow(/media/i);
  });
  it("filtros e paginação contam apenas publicações visíveis",async()=>{
    for(let i=0;i<22;i++){
      const fixture=structuredClone(doc);fixture.metadata.product="Produto de filtro";fixture.metadata.category="Controle";fixture.metadata.tags=["centavos"];fixture.metadata.title=`Ajuste de precisão ${i}`;
      const id=await rpc(author,{action:"create",document:fixture});
      await rpc(author,{action:"save",articleId:id,expectedVersion:1,document:fixture,visibility:i===21?"private":"public"});
      await rpc(author,{action:"submit",articleId:id,expectedVersion:2});
      const submission=(await db.query<{id:string;revision_id:string}>("select id,revision_id from kb_submissions where article_id=$1",[id])).rows[0];
      await rpc(admin,{action:"publish",articleId:id,expectedVersion:3,submissionId:submission.id,revisionId:submission.revision_id,visibility:i===21?"private":"public"});
    }
    const search=(actor:string|null,page:number,category="Controle")=>asLocal(db,actor,async tx=>(await tx.query<{total:number}>("select * from kb_search('precisao','Produto de filtro',$1,'centavos',$2)",[category,page])).rows);
    const first=await search(null,1),second=await search(null,2);expect(first).toHaveLength(20);expect(second).toHaveLength(1);expect(Number(first[0].total)).toBe(21);
    expect(await search(null,1,"Outra categoria")).toHaveLength(0);
    expect(Number((await search(author,1))[0].total)).toBe(22);
  });
  it("disputa simultânea retirada/publicação tem um único vencedor",async()=>{
    const id=await rpc(author,{action:"create",document:doc});
    await rpc(author,{action:"submit",articleId:id,expectedVersion:1});
    const s=(await db.query<{id:string;revision_id:string}>("select * from kb_submissions where article_id=$1 and status='pending'",[id])).rows[0];
    const common={articleId:id,expectedVersion:2,submissionId:s.id,revisionId:s.revision_id};
    const results=await Promise.allSettled([rpc(author,{...common,action:"withdraw"}),rpc(admin,{...common,action:"publish",visibility:"public"})]);
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(results.filter(r=>r.status==="rejected")).toHaveLength(1);
    const state=(await db.query<{status:string;version:number}>("select status,version from kb_articles where id=$1",[id])).rows[0];expect(state.version).toBe(3);
    const publication=(await db.query("select * from kb_publications where article_id=$1",[id])).rows;
    expect(publication.length).toBe(state.status==="published"?1:0);
  });
});
