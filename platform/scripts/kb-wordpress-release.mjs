import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {randomUUID,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
const root='.kb-pilot/wordpress-100',folder=`${root}/release`;await mkdir(folder,{recursive:true});
const env=parseEnv(await readFile('.env.local','utf8'));if(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname!=='ktmymzokgxmmkleacclq.supabase.co')throw Error('Destino incorreto');
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const actor='f3de5029-8c02-47d8-9f2e-968aae4e02f5',mode=process.argv[2]||'prepare';
const json=async n=>JSON.parse(await readFile(`${root}/${n}`,'utf8')),put=(n,v)=>writeFile(`${folder}/${n}`,JSON.stringify(v,null,2)),hash=b=>createHash('sha256').update(b).digest('hex');
const aliases={'12557':'conferencia-atos-subtipos-tj-al','12535':'grupos-ibs-cbs-nfs-e','Selo Digital - Bahia':'selo-digital-ba','Selo Digital - Paraíba':'selo-digital-pb','Selo Digital - Paraná':'selo-digital-pr'};
if(mode==='prepare'){
 const inventory=await db.from('kb_articles').select('id,slug,status,version');if(inventory.error)throw inventory.error;const articles=inventory.data;await writeFile(`${folder}/backup-articles.json`,JSON.stringify(articles,null,2),{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});
 for(const table of ['kb_drafts','kb_publications','kb_media','kb_revisions','kb_submissions','kb_review_events']){const r=await db.from(table).select('*');if(r.error)throw r.error;await writeFile(`${folder}/backup-${table}.json`,JSON.stringify(r.data,null,2),{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});}
 const profile=await db.from('academy_profiles').select('role,status').eq('id',actor).single();if(profile.error||profile.data.role!=='admin'||profile.data.status!=='active')throw Error('Administrador incompatível');
 const manifest=await json('manifest.json'),progress=await json('progress.json'),origin=await json('origin-report.json');let old=[];try{old=JSON.parse(await readFile(`${folder}/prepared.json`,'utf8'));}catch{}
 const items=[];let bytes=0,missingProduct=0;
 for(const r of manifest.records){const p=progress[r.sourceKey],prior=old.find(x=>x.wpId===Number(r.wpId)),data=await json(`article-${r.wpId}.json`),doc=structuredClone(data.converted);
  if(hash(r.html)!==p.sourceHash)throw Error('Origem alterada');const slug=aliases[r.wpId]||aliases[r.title]||`wordpress-${r.wpId}`,existing=articles.find(a=>a.slug===slug),id=existing?.id||prior?.id||randomUUID();
  if(!doc.metadata.product.trim()){doc.metadata.product='Não informado no artigo original';missingProduct++;}
  if(!doc.metadata.summary.trim())doc.metadata.summary=doc.metadata.title;
  const text=n=>(n.text||'')+' '+(n.content||[]).map(text).join(' ');
  if(doc.sections.map(s=>text(s.content)).join(' ').trim().length<8)doc.sections[0].content.content.unshift({type:'heading',attrs:{level:2,blockId:randomUUID()},content:[{type:'text',text:doc.metadata.title}]});
  const refs=new Set(),walk=n=>{if(n.type==='image')refs.add(n.attrs.mediaId);n.content?.forEach(walk);};doc.sections.forEach(s=>walk(s.content));const media=[],map=new Map();
  for(const localId of refs){const filename=`${root}/media/${p.articleId}/${localId}`;let content;try{content=await readFile(filename);}catch{continue;}const info=await sharp(content).metadata(),mid=prior?.media.find(m=>m.localId===localId)?.id||randomUUID();map.set(localId,mid);bytes+=content.length;media.push({id:mid,localId,article_id:id,owner_id:actor,provider:'supabase',storage_key:`${id}/${mid}`,name:`wordpress-${r.wpId}-${localId}`,mime:({png:'image/png',jpeg:'image/jpeg',webp:'image/webp'})[info.format],bytes:content.length,width:info.width,height:info.height,checksum:hash(content),ready:true,filename});}
  const remap=n=>{if(n.type==='image'&&map.has(n.attrs.mediaId))n.attrs.mediaId=map.get(n.attrs.mediaId);n.content?.forEach(remap);};doc.sections.forEach(s=>remap(s.content));const blocked=refs.size!==media.length||p.pending.some(s=>/Imagem pendente|Anexo preservado|Shortcode:/i.test(s));
  items.push({id,slug,wpId:Number(r.wpId),sourceHash:r.sourceHash,actor,document:doc,media,sourceVisibility:r.visibility,publish:!blocked,pending:p.pending,origin:origin.find(o=>o.wpId===r.wpId),publishedGmt:r.publishedGmt,modified:r.modified,existing:!!existing});}
 await put('prepared.json',items);const plan={total:items.length,public:items.filter(i=>i.publish&&i.sourceVisibility==='public').length,private:items.filter(i=>i.publish&&i.sourceVisibility==='private').length,drafts:items.filter(i=>!i.publish).length,media:items.reduce((n,i)=>n+i.media.length,0),bytes,missingProduct,reused:items.filter(i=>i.existing).length};await put('plan.json',plan);console.log(JSON.stringify(plan));
}else if(mode==='transfer'){
 const items=JSON.parse(await readFile(`${folder}/prepared.json`,'utf8'));let done={};try{done=JSON.parse(await readFile(`${folder}/progress.json`,'utf8'));}catch{}
 const checkpoint=()=>put('progress.json',done),media=items.flatMap(i=>i.media);
 const upload=async m=>{if(done[m.id]?.uploaded)return;const bytes=await readFile(m.filename);if(hash(bytes)!==m.checksum)throw Error('Checksum alterado');let r;for(let n=0;n<3;n++){r=await db.storage.from('academy-kb').upload(m.storage_key,bytes,{contentType:m.mime,upsert:false});if(!r.error)break;if(r.error.statusCode==='409'||/already exists|Duplicate/i.test(r.error.message)){const old=await db.storage.from('academy-kb').download(m.storage_key);if(old.error||hash(Buffer.from(await old.data.arrayBuffer()))!==m.checksum)throw Error('Objeto divergente');r={error:null};break;}}if(r.error)throw Error(`Upload ${m.id}: ${r.error.message}`);done[m.id]={uploaded:true};};
 for(let n=0;n<media.length;n+=6){await Promise.all(media.slice(n,n+6).map(upload));await checkpoint();if(n%120===0)console.log(`Mídias privadas: ${Math.min(n+6,media.length)}/${media.length}`);}
 let count=0;for(const i of items){if(!done[`article-${i.wpId}`]?.released){const item={...i,media:i.media.map(({filename,localId,...m})=>m)},r=await db.rpc('kb_release_wordpress',{item});if(r.error)throw Error(`Artigo ${i.wpId}: ${r.error.message}`);done[`article-${i.wpId}`]={released:true,result:r.data};await checkpoint();}if(++count%20===0)console.log(`Artigos: ${count}/${items.length}`);}console.log('Transferência concluída: '+items.length);
}else throw Error('Use prepare ou transfer');
