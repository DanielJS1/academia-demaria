// Isolated browser regression tests: real React components, simulated player SDKs and API.
// No credentials or external database writes. Run from platform with pnpm test:players.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root=process.cwd();
const require=createRequire(path.join(root,'package.json'));
const viteRequire=createRequire(require.resolve('vitest/package.json'));
const {createServer}=await import(pathToFileURL(viteRequire.resolve('vite')).href);
const {chromium,expect}=require('@playwright/test');
const provider=`import {useSyncExternalStore} from 'react';
let listeners=new Set();let state={completed:{}};
window.calls=[];window.failures=0;window.ranges=[];window.position=0;
const mutate=async command=>{window.calls.push(structuredClone(command));if(window.failures-->0)return false;
window.ranges.push(...command.ranges);window.position=Math.max(window.position,command.position);
const sorted=window.ranges.sort((a,b)=>a[0]-b[0]);let end=0,seconds=0;
for(const [a,b] of sorted){seconds+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}
if(window.position>=99&&(window.admin||seconds>=50)){state={completed:{course:['lesson']}};listeners.forEach(l=>l());}return true;};
export function useAcademy(){return {state:useSyncExternalStore(cb=>{listeners.add(cb);return()=>listeners.delete(cb)},()=>state),mutate};}`;
const sdk=`export default class Player {
constructor(){window.instances=(window.instances||0)+1;this.handlers={};this.pos=0;this.ranges=[];window.player=this;}
on(e,fn){(this.handlers[e]??=[]).push(fn)}off(e,fn){this.handlers[e]=(this.handlers[e]||[]).filter(f=>f!==fn)}
emit(e,seconds=this.pos){this.pos=seconds;for(const fn of this.handlers[e]||[])fn({seconds,duration:100})}
ready(){return Promise.resolve()}getDuration(){return Promise.resolve(100)}getCurrentTime(){return Promise.resolve(this.pos)}getPlayed(){return Promise.resolve(this.ranges)}setCurrentTime(t){this.emit('seeked',t);return Promise.resolve(t)}
}`;
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';
import {VimeoLesson} from '/src/components/vimeo-lesson.tsx';
import {YouTubeLesson} from '/src/components/youtube-lesson.tsx';
const params=new URLSearchParams(location.search);window.admin=params.has('admin');
window.ranges=params.has('resume')?[[0,50]]:[];
window.YT={Player:class {constructor(id,{events}){window.instances=(window.instances||0)+1;this.pos=0;this.events=events;window.player=this;queueMicrotask(()=>events.onReady({target:this}));}
getCurrentTime(){return this.pos}getDuration(){return 100}seekTo(t){this.pos=t}destroy(){}emit(state,t){this.pos=t;this.events.onStateChange({data:state})}}};
const Component=params.has('youtube')?YouTubeLesson:VimeoLesson;
createRoot(document.getElementById('root')).render(<Component course={{id:'course',version:1}} lesson={{id:'lesson',title:'Aula teste',minutes:1,videoUrl:params.has('youtube')?'https://youtu.be/abcdefghijk':'https://vimeo.com/123456'}} preview={params.has('preview')} initialPosition={params.has('resume')?100:0}/>);`;
const server=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:4189,strictPort:true,fs:{allow:[root]}},resolve:{alias:{'@':path.join(root,'src')}},plugins:[{name:'player-fixture',enforce:'pre',resolveId(id){if(id==='@vimeo/player')return '\0sdk';if(id.endsWith('/academy-provider')||id==='./academy-provider')return '\0provider';if(id.endsWith('/supabase-browser'))return '\0auth';if(id==='/test-entry.tsx')return path.join(root,'src/__player-entry.tsx')},load(id){if(id.endsWith('/__player-entry.tsx'))return entry;if(id==='\0sdk')return sdk;if(id==='\0provider')return provider;if(id==='\0auth')return 'export const browserAuth=()=>null;'},configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url.split('?')[0]==='/'){res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script type="module" src="/test-entry.tsx"></script>')}else if(req.url==='/test-entry.tsx'){const result=await s.transformRequest('/test-entry.tsx');res.setHeader('Content-Type','application/javascript');res.end(result?.code||'')}else next()})}}]});
await server.listen();
const browser=await chromium.launch({headless:process.env.HEADLESS === "true" || !!process.env.CI});
let page;
async function open(query=''){
 if(page)await page.close();page=await browser.newPage();
 page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
 page.on('console',msg=>{if(msg.type()==='error')console.error('CONSOLE',msg.text())});await page.route(/player.vimeo.com|youtube.com\/embed/,route=>route.fulfill({body:'<html></html>',contentType:'text/html'}));
 await page.clock.install();await page.goto('http://127.0.0.1:4189/'+query,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.player&&window.calls);

}
async function tick(seconds){await page.evaluate(t=>window.player.emit('timeupdate',t),seconds);await page.clock.runFor(250);}
const results=[];
try{
 await open();await page.evaluate(()=>window.player.emit('play',0));
 for(let t=.25;t<=30;t+=.25)await tick(t);
 expect(await page.evaluate(()=>window.calls.length)).toBeGreaterThanOrEqual(3);
 expect(await page.evaluate(()=>window.calls.at(-1).ranges.reduce((n,[a,b])=>n+b-a,0))).toBeGreaterThan(15);
 results.push('Vimeo: salvamento durante reprodução contínua');
 await page.evaluate(()=>{window.failures=100;window.player.ranges=[[0,50]];window.player.emit('seeked',100)});
 await expect(page.getByRole('alert')).toBeVisible();
 const instances=await page.evaluate(()=>window.instances);
 await page.evaluate(()=>window.failures=0);await page.getByRole('button',{name:'Tentar salvar novamente'}).click();
 await expect(page.getByText('Aula concluída!')).toBeVisible();
 expect(await page.evaluate(()=>window.instances)).toBe(instances);
 results.push('Vimeo: falha no fim + retry preserva player e conclui');
 await open();await page.evaluate(()=>{window.failures=100;window.player.ranges=[[0,50]];window.player.emit('seeked',100)});
 await expect(page.getByRole('alert')).toBeVisible();await page.evaluate(()=>window.failures=0);await page.clock.runFor(11000);
 await expect(page.getByText('Aula concluída!')).toBeVisible();
 results.push('Vimeo: retry automático enquanto pausado');
 await open('?resume');await expect(page.getByText('Aula concluída!')).toBeVisible();results.push('Vimeo: retorno à aula no final com 50% salvo');
 await open();await page.evaluate(()=>window.player.emit('seeked',100));
 await expect(page.getByText('Final do vídeo',{exact:true})).toBeVisible();await expect(page.getByText('Aula concluída!')).toHaveCount(0);
 results.push('Vimeo: salto ao fim não conclui aluno');
 await open('?admin');await page.evaluate(()=>window.player.emit('seeked',100));await expect(page.getByText('Aula concluída!')).toBeVisible();results.push('Vimeo: administrador conclui ao avançar ao fim');
 await open('?preview');await page.evaluate(()=>window.player.emit('seeked',100));await page.clock.runFor(11000);expect(await page.evaluate(()=>window.calls.length)).toBe(0);results.push('Vimeo: prévia não grava progresso');
 await open('?youtube');await page.evaluate(()=>window.player.emit(1,0));
 for(let t=2;t<=52;t+=2){await page.evaluate(t=>window.player.pos=t,t);await page.clock.runFor(2000);}
 expect(await page.evaluate(()=>window.calls.length)).toBeGreaterThanOrEqual(4);
 await page.evaluate(()=>{window.failures=100;window.player.emit(0,100)});await expect(page.getByRole('alert')).toBeVisible();
 await page.evaluate(()=>window.failures=0);await page.getByRole('button',{name:'Tentar salvar novamente'}).click();await expect(page.getByText('Aula concluída!')).toBeVisible();
 results.push('YouTube: salvamento periódico e recuperação no fim');
 await open('?youtube&resume');await expect(page.getByText('Aula concluída!')).toBeVisible();results.push('YouTube: retorno no fim com progresso salvo');
 await open('?youtube&admin');await page.evaluate(()=>window.player.emit(0,100));await expect(page.getByText('Aula concluída!')).toBeVisible();results.push('YouTube: administrador sem permanência');
 await open();await page.evaluate(()=>window.player.emit('play',0));
 for(let t=.25;t<=60;t+=.25)await tick(t);
 await page.evaluate(()=>{window.player.emit('seeking',10);window.player.emit('seeked',10);window.player.emit('play',10)});
 for(let t=10.25;t<=20;t+=.25)await tick(t);
 await page.evaluate(()=>window.player.emit('ended',100));await expect(page.getByText('Aula concluída!')).toBeVisible();
 results.push('Vimeo: rever trecho não diminui o tempo já assistido; ended conclui');
 console.log(JSON.stringify({passed:results},null,2));
}catch(error){console.error(error);process.exitCode=1;}finally{await browser.close();await server.close();process.exit(process.exitCode||0);}
