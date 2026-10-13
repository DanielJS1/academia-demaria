import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { assertIsolated, accountPlan, presentationData, demoId, DEMO_NAMESPACE } from './presentation-data.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const config=parseEnv(readFileSync(root+'.env.homologacao.local','utf8'));assertIsolated(config);
const plan=accountPlan();
if(!process.argv.includes('--apply')){const sample=presentationData(plan.map(a=>({...a,id:demoId(a.key)})));console.log(JSON.stringify({dryRun:true,people:plan.length,departments:6,counts:sample.counts},null,2));process.exit(0);}
const privatePath=root+'.env.demo-homologacao.local';
const saved=existsSync(privatePath)?parseEnv(readFileSync(privatePath,'utf8')):{};
const password=saved.DEMO_PASSWORD||randomBytes(24).toString('base64url')+'!aA7';
// Persist before creating users so an interrupted run keeps the same credentials.
writeFileSync(privatePath,`# Private demo credentials. Dedicated homologacao only. Never commit.\nDEMO_URL=https://academia-demaria-homologacao.vercel.app\nDEMO_ADMIN_EMAIL=${plan[0].email}\nDEMO_MANAGER_EMAIL=${plan.find(a=>a.key==='manager-0').email}\nDEMO_STUDENT_EMAIL=${plan.find(a=>a.key==='person-0-0').email}\nDEMO_PASSWORD=${password}\n`);
const db=createClient(config.NEXT_PUBLIC_SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ensure=result=>{if(result.error)throw new Error(result.error.message);return result.data;};
const existing=ensure(await db.auth.admin.listUsers({page:1,perPage:1000})).users;
const accounts=[];
for(const [index,a]of plan.entries()){
  let user=existing.find(u=>u.email===a.email);
  if(user&&user.user_metadata?.demo_namespace!==DEMO_NAMESPACE)throw new Error('An existing account outside the demo namespace cannot be changed.');
  if(!user)user=ensure(await db.auth.admin.createUser({email:a.email,password,email_confirm:true,user_metadata:{name:a.name,demo_namespace:DEMO_NAMESPACE}})).user;
  accounts.push({...a,id:user.id});if((index+1)%25===0)console.log(`Demo accounts prepared: ${index+1}/${plan.length}`);
}
const dataset=presentationData(accounts),tables=dataset.tables;
async function upsert(table,rows){
  // PostgREST bulk writes require matching keys; retain defaults for omitted fields.
  const groups=new Map();
  for(const row of rows){const key=Object.keys(row).sort().join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  for(const group of groups.values())for(let i=0;i<group.length;i+=250)ensure(await db.from(table).upsert(group.slice(i,i+250)));
}
await upsert('academy_profiles',tables.academy_profiles.filter(a=>a.role!=='student'));
await upsert('academy_profiles',tables.academy_profiles.filter(a=>a.role==='student'));
const settings=ensure(await db.from('academy_settings').select('*').single());
ensure(await db.from('academy_settings').update({departments:[...new Set([...settings.departments,...dataset.accounts.map(a=>a.department)])],products:[...new Set([...settings.products,'Academia DeMaria'])]}).eq('id',settings.id));
for(const table of ['academy_resources','academy_trails','academy_trail_policies','academy_trail_assignments','academy_quizzes','academy_quiz_questions','academy_progress','academy_attempts','academy_xp','academy_presence','academy_engagement_daily','academy_pdi_notes','academy_recognitions','academy_quiz_attempts','academy_community_articles','academy_community_comments','academy_community_reactions','academy_lesson_notes']){await upsert(table,tables[table]);console.log(`${table}: ${tables[table].length}`);}
// The prospective triggers remain enabled. These explicitly simulated timelines belong only to demo accounts.
for(const table of ['academy_report_publications','academy_report_reactions','academy_report_completions'])await upsert(table,tables[table]);
ensure(await db.from('academy_report_collection').update({collected_since:dataset.collectionStart}).eq('id',true));
ensure(await db.from('academy_engagement_config').update({collected_since:dataset.collectionStart}).eq('id',true));
const out=root+'../output/homologacao-presentation/';mkdirSync(out,{recursive:true});writeFileSync(out+'seed-manifest.json',JSON.stringify({namespace:dataset.namespace,generatedAt:new Date().toISOString(),people:plan.length,departments:6,counts:dataset.counts,simulatedCollectionStart:dataset.collectionStart,privateCredentialsFile:privatePath},null,2));
console.log(JSON.stringify({passed:true,people:plan.length,departments:6,credentials:'platform/.env.demo-homologacao.local',manifest:'output/homologacao-presentation/seed-manifest.json'}));
