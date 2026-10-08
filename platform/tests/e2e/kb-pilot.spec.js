import {test,chromium,expect} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const TARGET_URL=process.env.E2E_BASE_URL||'http://127.0.0.1:4174';
const TITLE='Procedimento de homologação '+Date.now();
const ROOT=process.cwd();
const OUTPUT=path.join(ROOT,'.kb-pilot','browser');fs.mkdirSync(OUTPUT,{recursive:true});
expect.configure({timeout:20000});
test('cinco conversões e jornada editorial pelo navegador',async()=>{
 test.skip(process.env.KB_E2E_PILOT!=='1','Requer piloto local explícito e originais importados.');
 if(!['127.0.0.1','localhost'].includes(new URL(TARGET_URL).hostname))throw Error('Piloto somente local.');
 test.setTimeout(600_000);
 const browser=await chromium.launch({headless:false});const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
 page.on('dialog',d=>d.accept());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.request().method()==='POST'&&r.url().endsWith('/api/kb'))console.log('MUTATION',r.status());});
 const call=async(url,data)=>{const response=await context.request.fetch(TARGET_URL+url,{method:data?'POST':'GET',data,headers:data?{'Content-Type':'application/json'}:{}});const r=await response.json();if(!response.ok())throw new Error(JSON.stringify(r));return r;};
 try{
  await page.goto(TARGET_URL+'/bc/gestao');await page.getByRole('button',{name:'Autor piloto',exact:true}).click();await expect(page.getByRole('button',{name:'Criar artigo',exact:true})).toBeVisible();
  const map=JSON.parse(fs.readFileSync(path.join(ROOT,'.kb-pilot','pilot-map.json'),'utf8'));const cycles=[];
  for(const id of Object.values(map)){
   const before=await call('/api/kb/articles/'+id);await page.getByRole('button',{name:before.document.metadata.title,exact:true}).click();
   await expect(page.locator('.tiptap')).toHaveCount(1);
   for(let i=0;i<5;i++){
    await page.getByRole('button',{name:'Código HTML',exact:true}).click();await expect(page.getByRole('textbox',{name:'Código HTML',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Visual',exact:true}).click();await expect(page.locator('.tiptap')).toHaveCount(1);
   }
   await page.getByRole('button',{name:'Prévia',exact:true}).click();await expect(page.locator('.kb-editor-grid>div .kb-content .kb-image-button img')).toHaveCount(before.document.sections.flatMap(s=>images(s.content)).length);
   await page.setViewportSize({width:375,height:1000});
   const zoom=page.locator('.kb-editor-grid>div .kb-content .kb-image-button').first();await zoom.focus();await page.keyboard.press('Enter');await expect(page.locator('dialog[open]')).toBeVisible();await page.keyboard.press('Escape');await expect(zoom).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1440,height:1000});
   await page.screenshot({path:path.join(OUTPUT,`converted-${before.slug}.png`),fullPage:true});
   await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await expect(page.locator('.kb-editor-top')).toContainText(`Versão ${before.version+1}`);await expect(page.locator('.kb-editor-top')).toContainText('Salvo');
   const after=await call('/api/kb/articles/'+id);expect(after.document.templateVersion).toBe(2);expect(after.document.sections).toHaveLength(1);expect(after.document.sections.flatMap(s=>images(s.content)).map(n=>n.attrs.mediaId)).toEqual(before.document.sections.flatMap(s=>images(s.content)).map(n=>n.attrs.mediaId));for(const section of before.document.sections)for(const text of texts(section.content))expect(JSON.stringify(after.document)).toContain(JSON.stringify(text));
   await page.getByRole('button',{name:'← Meus artigos',exact:true}).click();await page.getByRole('button',{name:before.document.metadata.title,exact:true}).click();await expect(page.locator('.tiptap')).toHaveCount(1);
   const reopened=await call('/api/kb/articles/'+id);expect(reopened.document).toEqual(after.document);
   cycles.push({title:before.document.metadata.title,cycles:5,reopened:true,mobileKeyboardZoom:true,imageOccurrences:before.document.sections.flatMap(s=>images(s.content)).length});
   await page.getByRole('button',{name:'← Meus artigos',exact:true}).click();
  }
  await page.getByRole('button',{name:'Criar artigo',exact:true}).click();await expect(page.locator('.tiptap')).toHaveCount(1);
  await page.getByLabel('Título',{exact:true}).fill(TITLE);await page.getByLabel('Produto',{exact:true}).fill('DOC-Windows');
  await page.locator('.tiptap').fill('Confira os parâmetros e verifique o resultado deste artigo.');
  await page.getByLabel('Visibilidade proposta',{exact:true}).selectOption('public');
  await page.getByRole('button',{name:'Enviar para revisão',exact:true}).click();await expect(page.getByRole('button',{name:'Retirar da revisão',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Aprovar e publicar',exact:true})).toHaveCount(0);
  const link=await page.getByRole('link',{name:'Link permanente',exact:true}).getAttribute('href');const slug=link.split('/').pop();
  await page.getByRole('button',{name:'Administrador piloto',exact:true}).click();await page.getByRole('button',{name:'Fila de revisão',exact:true}).click();await page.getByRole('button',{name:TITLE,exact:true}).click();
  await page.getByLabel('Comentário da devolução',{exact:true}).fill('Esclareça a verificação final.');await page.getByRole('button',{name:'Devolver para ajustes',exact:true}).click();await expect(page.getByRole('button',{name:'Enviar para revisão',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Autor piloto',exact:true}).click();await page.getByRole('button',{name:'Meus artigos',exact:true}).click();await page.getByRole('button',{name:TITLE,exact:true}).click();await page.getByText('Histórico e avisos',{exact:true}).click();await expect(page.getByText('Esclareça a verificação final.',{exact:true})).toBeVisible();
  await page.locator('.tiptap').fill('Confirme que a operação terminou e confira os dados salvos.');await page.getByRole('button',{name:'Enviar para revisão',exact:true}).click();await expect(page.getByRole('button',{name:'Retirar da revisão',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Administrador piloto',exact:true}).click();await page.getByRole('button',{name:'Fila de revisão',exact:true}).click();await page.getByRole('button',{name:TITLE,exact:true}).click();await page.getByRole('button',{name:'Aprovar e publicar',exact:true}).click();await expect(page.getByRole('button',{name:'Despublicar / arquivar',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Visitante',exact:true}).click();let internalCalls=0;page.on('request',r=>{if(['/api/academy','/api/live'].some(p=>r.url().includes(p)))internalCalls++;});
  await page.goto(TARGET_URL+'/bc');await page.getByLabel('O que você precisa consultar?',{exact:true}).fill('homologação');await page.getByLabel('O que você precisa consultar?',{exact:true}).press('Enter');await page.getByRole('link',{name:TITLE,exact:true}).click();await expect(page).toHaveURL(TARGET_URL+link);await expect(page.locator('.kb-reader h1')).toHaveText(TITLE);
  for(const width of [375,768,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:path.join(OUTPUT,`public-${width}.png`),fullPage:true});}
  expect(internalCalls).toBe(0);expect(errors).toEqual([]);
  fs.writeFileSync(path.join(OUTPUT,'results.json'),JSON.stringify({cycles,editorialJourney:'passed',publicSearch:'passed',viewports:[375,768,1440],internalRequests:internalCalls,errors,publicSlug:slug},null,2));console.log('PASS: 5 artigos × 5 ciclos; criação/devolução/reenvio/publicação; busca anônima; 375/768/1440; nenhum snapshot interno.');
 }catch(error){await page.screenshot({path:path.join(OUTPUT,'failure.png'),fullPage:true});console.error(await page.locator('body').innerText());throw error;}finally{await browser.close();}
});
function images(n){return [...(n.type==='image'?[n]:[]),...(n.content||[]).flatMap(images)];}

function texts(n){return [...(n.type==="text"?[n.text]:[]),...(n.content||[]).flatMap(texts)];}
