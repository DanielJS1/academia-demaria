import {test,expect} from '@playwright/test';
import {newDocument,identifyBlocks} from '../../src/lib/kb/document';
import fs from 'node:fs';
import path from 'node:path';

test('API: publicação isolada, conflito, autorização e revogação de mídia',async({request})=>{
 test.skip(process.env.KB_E2E_PILOT!=='1','Requer KB_LOCAL_PILOT=1 no servidor local.');
 const origin=process.env.E2E_BASE_URL;
 if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('Piloto somente local.');
 const author='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
 const call=(url,actor,data)=>request.fetch(origin+url,{method:data?'POST':'GET',data,headers:actor?{Cookie:`kb-pilot=${actor}`}:{}});
 const command=async(actor,data,status=200)=>{const r=await call('/api/kb',actor,data);expect(r.status(),await r.text()).toBe(status);return r.json();};
 const doc=newDocument();const title=`Segurança API ${Date.now()}`;
 doc.metadata={...doc.metadata,title,summary:'Teste local de isolamento da publicação.',product:'DOC-Windows'};
 doc.sections.forEach(s=>s.content=identifyBlocks({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Orientação suficiente e verificação da operação.'}]}]}));
 const {id}=await command(author,{action:'create',document:doc});
 let detail=await (await call(`/api/kb/articles/${id}`,author)).json();let version=1;
 expect((await call(`/api/kb/articles/${id}`,other)).status()).toBe(404);
 for(const actor of [null,'44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666'])await command(actor,{action:'create',document:doc},403);
 await command(author,{action:'save',articleId:id,expectedVersion:99,document:doc,visibility:'public'},409);
 await command(author,{action:'save',articleId:id,expectedVersion:1,document:{...doc,sections:[]}},400);
 const bad=await request.post(origin+'/api/kb/media',{headers:{Cookie:`kb-pilot=${author}`},multipart:{articleId:id,file:{name:'falso.png',mimeType:'image/png',buffer:Buffer.from('<script>alert(1)</script>')}}});expect(bad.status()).toBe(400);
 const originalMap=JSON.parse(fs.readFileSync('.kb-pilot/pilot-map.json','utf8'));const originalId=Object.values(originalMap)[0];
 const images=await (await call(`/api/kb/media?articleId=${originalId}`,author)).json();const original=images.media[0];
 expect((await call(`/api/kb/media/${original.id}`,null)).status()).toBe(404);expect((await call(`/api/kb/preview-media/${original.id}`,null)).status()).toBe(200);
 const imageBytes=await (await call(`/api/kb/media/${original.id}`,author)).body();
 const uploaded=await request.post(origin+'/api/kb/media',{headers:{Cookie:`kb-pilot=${author}`},multipart:{articleId:id,file:{name:'captura.png',mimeType:'image/png',buffer:imageBytes}}});expect(uploaded.status()).toBe(200);const media=await uploaded.json();expect((await call(`/api/kb/preview-media/${media.id}`,null)).status()).toBe(404);
 doc.sections[2].content.content.push(identifyBlocks({type:'image',attrs:{mediaId:media.id,alt:'Captura de teste local',width:media.width,height:media.height}}));
 await command(author,{action:'save',articleId:id,expectedVersion:version++,document:doc,visibility:'public'});
 expect((await call(`/api/kb/media/${media.id}`,null)).status()).toBe(404);
 await command(author,{action:'submit',articleId:id,expectedVersion:version++});
 detail=await (await call(`/api/kb/articles/${id}`,author)).json();const submission=detail.submissions.find(s=>s.status==='pending');
 const decision={articleId:id,expectedVersion:version,submissionId:submission.id,revisionId:submission.revision_id,visibility:'public'};
 await command(author,{...decision,action:'publish'},403);await command(admin,{...decision,action:'publish'});version++;
 const published=await (await call(`/api/kb/read/${detail.slug}`,null)).json();expect(published.title).toBe(title);
 expect((await call(`/api/kb/media/${media.id}`,null)).status()).toBe(200);
 doc.metadata.title='Rascunho separado';await command(author,{action:'save',articleId:id,expectedVersion:version++,document:doc,visibility:'private'});
 expect((await (await call(`/api/kb/read/${detail.slug}`,null)).json()).title).toBe(title);
 await command(admin,{action:'visibility',articleId:id,expectedVersion:version++,visibility:'private'});
 const hidden=async()=>{
  for(const actor of [null,'44444444-4444-4444-8444-444444444444']){
   expect((await call(`/api/kb/read/${detail.slug}`,actor)).status()).toBe(404);
   expect((await call(`/api/kb/media/${media.id}`,actor)).status()).toBe(404);
   const results=await (await call('/api/kb?q='+encodeURIComponent(title),actor)).json();expect(results.results.some(r=>r.slug===detail.slug)).toBe(false);
  }
  const page=await request.get(origin+'/bc/'+detail.slug);expect(page.status()).toBe(404);expect(await page.text()).not.toContain(title);
 };
 await hidden();expect((await call(`/api/kb/read/${detail.slug}`,author)).status()).toBe(200);
 await command(admin,{action:'visibility',articleId:id,expectedVersion:version++,visibility:'public'});
 await command(admin,{action:'unpublish',articleId:id,expectedVersion:version++});await hidden();
 expect((await call(`/api/kb/media/${media.id}`,author)).headers()['cache-control']).toContain('no-store');
 const deletion=await request.delete(origin+`/api/kb/media/${media.id}`,{headers:{Cookie:`kb-pilot=${author}`}});expect(deletion.status()).toBe(400);
 fs.mkdirSync('.kb-pilot/browser',{recursive:true});fs.writeFileSync(path.resolve('.kb-pilot/browser/api-results.json'),JSON.stringify({passed:true,articleId:id,checks:['API roles','409 conflict','template forgery','invalid image','exact revision','draft isolation','private/unpublished search and metadata','private/unpublished media','historical references','no-store']},null,2));
});
