import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { output, scratch, hash, client, readBank } from './audit-proficiency-snapshot.mjs';

export function validate(q) {
 if (!q.id || !q.prompt?.trim() || q.type!=='choice' || q.multiple || !Array.isArray(q.options) || q.options.length<2 || q.options.filter(x=>x===q.correct).length!==1 || new Set(q.options.map(x=>x.trim().toLowerCase())).size!==q.options.length) throw new Error(`Questão inválida: ${q.id}`);
}
const literal = x => x===null ? 'NULL::jsonb' : "'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const str = x => "'"+String(x).replaceAll("'","''")+"'";
export function patchDocument(doc, reviews) {
 if (doc === null) return null;
 if (!Array.isArray(doc.proficiencyQuestions)) throw new Error('Documento existente sem proficiencyQuestions: conferir draft antes de aplicar.');
 const replacements = new Map(reviews.map(r=>[r.questionId,r.after]));
 const seen = new Set();
 const qs = doc.proficiencyQuestions.map(q => {
  const replacement = replacements.get(q.id);
  if (!replacement) return q;
  if (seen.has(q.id)) throw new Error(`ID duplicado no documento: ${q.id}`);
  seen.add(q.id); validate(replacement);
  return {...q,prompt:replacement.prompt,options:replacement.options,correct:replacement.correct};
 });
 if (seen.size!==reviews.length) throw new Error('Alguns IDs aprovados não existem no documento; draft divergente não será sobrescrito.');
 return {...doc,proficiencyQuestions:qs};
}
export function sqlFor(changes, {rollback=false, preview=false}={}) {
 const statements=['BEGIN;', "SET LOCAL standard_conforming_strings = on;", "SET LOCAL lock_timeout = '10s';", 'DO $demaria_audit$', 'DECLARE r public.academy_resources%ROWTYPE;', 'BEGIN'];
 for (const c of [...changes].sort((a,b)=>a.id.localeCompare(b.id))) {
  const expected=rollback?c.after:c.before, target=rollback?c.before:c.after;
  statements.push(` SELECT * INTO r FROM public.academy_resources WHERE id=${str(c.id)} FOR UPDATE;`, ` IF NOT FOUND THEN RAISE EXCEPTION 'Curso ausente: %', ${str(c.id)}; END IF;`, ` IF r.kind <> 'course' OR r.revision <> ${c.before.revision} OR r.published IS DISTINCT FROM ${literal(expected.published)} OR r.draft IS DISTINCT FROM ${literal(expected.draft)}${rollback?'':` OR r.updated_at IS DISTINCT FROM ${str(c.before.updated_at)}::timestamptz`} THEN`, `  RAISE EXCEPTION 'Curso alterado desde a revisão: %', ${str(c.id)};`, ' END IF;', ` UPDATE public.academy_resources SET`, `  published=CASE WHEN r.published IS NULL THEN NULL ELSE jsonb_set(r.published,'{proficiencyQuestions}',${literal(target.published?.proficiencyQuestions||[])},false) END,`, `  draft=CASE WHEN r.draft IS NULL THEN NULL ELSE jsonb_set(r.draft,'{proficiencyQuestions}',${literal(target.draft?.proficiencyQuestions||[])},false) END,`, `  updated_at=now() WHERE id=${str(c.id)};`);
 }
 statements.push('END;', '$demaria_audit$;', preview?'ROLLBACK; -- Prévia: não confirma alterações.':'COMMIT;');
 return statements.join('\n')+'\n';
}
// Walk only helper calls, respecting nested expressions, comments and quoted strings.
export function helperSpans(source) {
 const spans=[];
 const token=/\bmake(?:Challenging)?Q\s*\(/g;
 for (let match; (match=token.exec(source));) {
  let depth=1, quote=null, comment=null, escape=false, i=token.lastIndex;
  for (;i<source.length&&depth;i++) {
   const c=source[i], n=source[i+1];
   if (comment==='line') {if(c==='\n')comment=null;continue;}
   if (comment==='block') {if(c==='*'&&n==='/'){comment=null;i++;}continue;}
   if (quote) {if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(c===quote)quote=null;continue;}
   if(c==='/'&&n==='/'){comment='line';i++;continue;}
   if(c==='/'&&n==='*'){comment='block';i++;continue;}
   if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
   if(c==='(')depth++;
   if(c===')')depth--;
  }
  if(depth)throw new Error('Chamada de helper incompleta.');
  spans.push({start:match.index,end:i});token.lastIndex=i;
 }
 return spans;
}
export function patchSource(source, bank, reviews) {
 const spans=helperSpans(source), entries=Object.entries(bank.bank).flatMap(([courseId,qs])=>qs.map((q,i)=>({courseId,ordinal:i+1,question:q})));
 if (spans.length!==entries.length) throw new Error(`Número de chamadas inesperado: ${bank.file}`);
 const map=new Map(reviews.map(r=>[`${r.courseId}:${r.ordinal}`,r.after]));
 let result=source;
 for (let i=entries.length-1;i>=0;i--) {
  const q=map.get(`${entries[i].courseId}:${entries[i].ordinal}`);
  if (!q) continue;
  validate(q);
  const object=JSON.stringify(q,null,2).replaceAll('\n','\n    ');
  result=result.slice(0,spans[i].start)+object+result.slice(spans[i].end);
 }
 return result;
}
function inputs() {
 const snapshot=JSON.parse(fs.readFileSync(path.join(output,'snapshot.json'),'utf8'));
 const plan=JSON.parse(fs.readFileSync(path.join(output,'review-plan.json'),'utf8'));
 const approvals=JSON.parse(fs.readFileSync(path.join(output,'approvals.json'),'utf8'));
 if (hash(snapshot)!==plan.snapshotHash || hash(plan)!==approvals.planHash) throw new Error('Snapshot, plano ou aprovações divergem. Regenerar revisão antes de aplicar.');
 const all=plan.courses.flatMap(c=>c.reviews);
 if (all.length!==158 || new Set(all.map(q=>q.reviewId)).size!==all.length) throw new Error('Cobertura/IDs do plano divergentes.');
 all.forEach(q=>validate(q.after));
 if(approvals.approvals.length!==all.length || new Set(approvals.approvals.map(a=>a.reviewId)).size!==all.length)throw new Error('Manifesto de aprovações incompleto ou duplicado.');
 for(const a of approvals.approvals){
  const q=all.find(q=>q.reviewId===a.reviewId);
  if(!q||a.questionId!==q.questionId||a.questionHash!==hash(q.after)||typeof a.approved!=='boolean')throw new Error(`Aprovação adulterada ou desatualizada: ${a.reviewId}`);
  if(a.approved&&(!a.reviewer?.trim()||!Number.isFinite(Date.parse(a.reviewedAt))))throw new Error(`Preencher responsável e data ISO: ${a.reviewId}`);
 }
 const approved=new Set(approvals.approvals.filter(a=>a.approved).map(a=>a.reviewId));
 return {snapshot,plan,all,selected:all.filter(q=>approved.has(q.reviewId)),approvalHash:hash(approvals)};
}
async function checkRemote(changes, mode='before') {
 const db=client();
 const result=await db.from('academy_resources').select('*').in('id',changes.map(c=>c.id));
 if(result.error)throw new Error(result.error.message);
 for(const c of changes){
  const row=result.data.find(r=>r.id===c.id), expected=c[mode];
  // JSONB property order is irrelevant.
  const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  if(!row||row.kind!=='course'||row.revision!==c.before.revision||!equal(row.published,expected.published)||!equal(row.draft,expected.draft)||(mode==='before'&&row.updated_at!==c.before.updated_at))throw new Error(`Banco diverge (${mode}): ${c.id}`);
 }
}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
function makeChanges(snapshot, selected) {
 return snapshot.resources.filter(r=>selected.some(q=>q.courseId===r.id)).map(before=>{
  const reviews=selected.filter(q=>q.courseId===before.id);
  return {id:before.id,before,after:{...before,published:patchDocument(before.published,reviews),draft:patchDocument(before.draft,reviews)}};
 });
}
async function prepare(preview=false) {
 const state=inputs(), selected=preview?state.all:state.selected;
 if(!selected.length)throw new Error('Nenhuma questão validada. Revisar approvals.json antes de --prepare.');
 const changes=makeChanges(state.snapshot,selected);
 await checkRemote(changes);
 const folder=path.join(output,preview?'preview':'validated');fs.mkdirSync(folder,{recursive:true});
 const staged=[];
 for(const bank of state.snapshot.banks){
  const sourcePath=path.join(scratch,bank.file),source=fs.readFileSync(sourcePath,'utf8');
  if(hash(source)!==bank.sha256)throw new Error(`Arquivo-fonte mudou: ${bank.file}`);
  const revised=patchSource(source,bank,selected);
  const stagedPath=path.join(folder,bank.file);fs.writeFileSync(stagedPath,revised);
  const loaded=readBank(bank.file,folder);
  for(const review of selected){
   if(!loaded.bank[review.courseId])continue;
   const actual=loaded.bank[review.courseId][review.ordinal-1];
   if(hash(actual)!==hash(review.after))throw new Error(`Arquivo preparado diverge: ${review.reviewId}`);
  }
  staged.push({sourcePath,stagedPath,beforeHash:bank.sha256,afterHash:hash(revised)});
 }
 fs.writeFileSync(path.join(folder,'apply.sql'),sqlFor(changes,{preview}));
 fs.writeFileSync(path.join(folder,'rollback.sql'),sqlFor(changes,{rollback:true,preview}));
 fs.writeFileSync(path.join(folder,'prepared.json'),JSON.stringify({preview,planHash:hash(state.plan),approvalHash:state.approvalHash,changes,staged},null,2));
 console.log(`${preview?'Prévia':'Pacote validado'}: ${selected.length} questões, ${changes.length} cursos. SQL e MJS em ${folder}`);
}
function prepared(){
 const p=JSON.parse(fs.readFileSync(path.join(output,'validated/prepared.json'),'utf8')),state=inputs();
 if(p.preview||p.planHash!==hash(state.plan)||p.approvalHash!==state.approvalHash)throw new Error('Pacote validado mudou; executar --prepare novamente.');
 for(const s of p.staged){if(hash(fs.readFileSync(s.sourcePath,'utf8'))!==s.beforeHash||hash(fs.readFileSync(s.stagedPath,'utf8'))!==s.afterHash)throw new Error(`Arquivo alterado: ${s.sourcePath}`);}
 if(fs.readFileSync(path.join(output,'validated/apply.sql'),'utf8')!==sqlFor(p.changes)||fs.readFileSync(path.join(output,'validated/rollback.sql'),'utf8')!==sqlFor(p.changes,{rollback:true}))throw new Error('SQL preparado alterado.');
 return p;
}
async function applyFiles(p){
 await checkRemote(p.changes,'after');
 // All files have passed preflight before any source is written.
 const backup=path.join(output,'backups',new Date().toISOString().replaceAll(':','-'));fs.mkdirSync(backup,{recursive:true});
 for(const s of p.staged)fs.copyFileSync(s.sourcePath,path.join(backup,path.basename(s.sourcePath)));
 const written=[];
 try{
  for(const s of p.staged){
   if(hash(fs.readFileSync(s.sourcePath,'utf8'))!==s.beforeHash)throw new Error('Concorrência detectada antes da escrita local.');
   const tmp=s.sourcePath+'.demaria-review.tmp';fs.writeFileSync(tmp,fs.readFileSync(s.stagedPath));fs.renameSync(tmp,s.sourcePath);written.push(s);
   if(hash(fs.readFileSync(s.sourcePath,'utf8'))!==s.afterHash)throw new Error('Verificação pós-escrita falhou.');
  }
 }catch(error){
  for(const s of written.reverse())if(hash(fs.readFileSync(s.sourcePath,'utf8'))===s.afterHash)fs.copyFileSync(path.join(backup,path.basename(s.sourcePath)),s.sourcePath);
  throw new Error(`Falha local após banco confirmado; arquivos escritos foram compensados quando não houve alteração concorrente. Conferir banco e rollback.sql. ${error.message}`);
 }
 console.log(`Banco verificado e quatro arquivos atualizados. Backup local: ${backup}`);
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==1||!['--preview','--prepare','--check','--apply','--apply-files'].includes(args[0]))throw new Error('Use --preview (somente leitura), --check, --prepare (validados), --apply ou --apply-files.');
 if(args[0]==='--preview')return prepare(true);
 if(args[0]==='--prepare')return prepare();
 if(args[0]==='--check'){const state=inputs();await checkRemote(makeChanges(state.snapshot,state.all));console.log('Plano, gabaritos, aprovações e banco conferidos; nenhuma alteração aplicada.');return;}
 const p=prepared();
 if(args[0]==='--apply'){
  await checkRemote(p.changes);
  if(!process.env.DEMARIA_DATABASE_URL)throw new Error('Para aplicação direta, configure DEMARIA_DATABASE_URL (conexão PostgreSQL) e psql, ou execute validated/apply.sql no SQL Editor e use --apply-files.');
  const url=new URL(process.env.DEMARIA_DATABASE_URL);
  if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('DEMARIA_DATABASE_URL deve ser conexão PostgreSQL.');
  const result=spawnSync('psql',['-X','--set','ON_ERROR_STOP=1','--file',path.join(output,'validated/apply.sql')],{env:{...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:url.searchParams.get('sslmode')||'require'},encoding:'utf8'});
  if(result.error||result.status!==0)throw new Error('psql não confirmou a transação. Conferir conexão e resultado antes de repetir; os arquivos-fonte não foram escritos.');
 }
 await applyFiles(p);
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename))await main();
