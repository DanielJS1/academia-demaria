// Explicit release of the five supplied articles. Prepare SQL for an authenticated
// administrator; never bypass the exact-revision publication RPC.
import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {randomUUID,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const env=parseEnv(await readFile('.env.local','utf8'));
if(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname!=='ktmymzokgxmmkleacclq.supabase.co')throw Error('Wrong release target.');
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const folder='.kb-pilot/production';
const prepared=JSON.parse(await readFile(`${folder}/prepared.json`,'utf8'));
const actor='f3de5029-8c02-47d8-9f2e-968aae4e02f5';
const quote=s=>"'"+String(s).replace(/'/g,"''")+"'";
let progress={};try{progress=JSON.parse(await readFile(`${folder}/media-progress.json`,'utf8'));}catch{}
const chunks=[];
for(const p of prepared){
 const row=await db.from('kb_articles').select('id,version,status').eq('slug',p.slug).single();if(row.error)throw row.error;
 const aid=row.data.id;if(row.data.status==='published'){console.log(`${p.slug}: already published`);continue;}
 const mappings=new Map();
 for(const m of p.media){
  const sourceKey=`${p.sourceArticleId}/${m.id}`;let uploaded=progress[sourceKey];
  const bytes=await readFile(`.kb-pilot/media/${sourceKey}`);
  if(!uploaded){const id=randomUUID(),key=`${aid}/${id}`;const response=await db.storage.from('academy-kb').upload(key,bytes,{contentType:m.mime,upsert:false});if(response.error)throw response.error;uploaded={id,key};progress[sourceKey]=uploaded;await writeFile(`${folder}/media-progress.json`,JSON.stringify(progress,null,2));}
  mappings.set(m.id,uploaded.id);
  chunks.push(`insert into public.kb_media(id,article_id,owner_id,provider,storage_key,name,mime,bytes,width,height,checksum,ready) values (${quote(uploaded.id)},${quote(aid)},${quote(actor)},'supabase',${quote(uploaded.key)},${quote(m.name)},${quote(m.mime)},${bytes.length},${m.width},${m.height},${quote(createHash('sha256').update(bytes).digest('hex'))},true) on conflict(id) do nothing;`);
 }
 const walk=n=>{if(n.type==='image'){if(!mappings.has(n.attrs.mediaId))throw Error('Missing media mapping.');n.attrs.mediaId=mappings.get(n.attrs.mediaId);}n.content?.forEach(walk);};p.document.sections.forEach(s=>walk(s.content));
 chunks.push(`do $publish$ declare sid uuid; rid uuid; v integer; begin select version into v from public.kb_articles where id=${quote(aid)} for update; perform public.kb_mutate(${quote(JSON.stringify({action:'save',articleId:aid,document:p.document,visibility:'public'}))}::jsonb||jsonb_build_object('expectedVersion',v)); perform public.kb_mutate(jsonb_build_object('action','submit','articleId',${quote(aid)},'expectedVersion',v+1)); select id,revision_id into sid,rid from public.kb_submissions where article_id=${quote(aid)} and status='pending'; perform public.kb_mutate(jsonb_build_object('action','publish','articleId',${quote(aid)},'expectedVersion',v+2,'submissionId',sid,'revisionId',rid,'visibility','public','comment','Publicação em produção autorizada pelo administrador Daniel José no Codex em 08/10/2026, após revisão da apresentação e preservação do conteúdo original.')); end $publish$;`);
 console.log(`${p.slug}: ${p.media.length} private images uploaded, exact-revision publication prepared`);
}
await writeFile(`${folder}/publish.sql`,`begin; select set_config('request.jwt.claim.sub',${quote(actor)},true);\n${chunks.join('\n')}\ncommit; select slug,visibility,title,published_at from public.kb_publications order by published_at desc;`);
await writeFile(`${folder}/published-documents.json`,JSON.stringify(prepared.map(({original,...p})=>p),null,2));
