import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { patchDocument, sqlFor, patchSource, validate } from './apply-proficiency-review.mjs';
import { output, scratch, hash, readBank } from './audit-proficiency-snapshot.mjs';

const snapshot=JSON.parse(fs.readFileSync(path.join(output,'snapshot.json'),'utf8'));
const plan=JSON.parse(fs.readFileSync(path.join(output,'review-plan.json'),'utf8'));
const all=plan.courses.flatMap(c=>c.reviews);
test('158 gabaritos únicos; IDs e campos alheios preservados; 316 chamadas substituídas',()=>{
 assert.equal(all.length,158);assert.equal(new Set(all.map(q=>q.questionId)).size,158);
 for(const r of snapshot.resources){
  const reviews=all.filter(q=>q.courseId===r.id);if(!reviews.length)continue;
  const after=patchDocument(r.published,reviews);
  assert.deepEqual({...after,proficiencyQuestions:[]},{...r.published,proficiencyQuestions:[]});
  for(const q of after.proficiencyQuestions)validate(q);
  assert.deepEqual(after.proficiencyQuestions.map(q=>q.id),r.published.proficiencyQuestions.map(q=>q.id));
 }
 for(const bank of snapshot.banks){
  // Applied source files may already contain the approved corrections; use the
  // immutable pre-application backup identified by the snapshot checksum.
  const candidates=[path.join(scratch,bank.file),...fs.readdirSync(path.join(output,'backups'),{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>path.join(output,'backups',e.name,bank.file))];
  const source=candidates.find(file=>fs.existsSync(file)&&hash(fs.readFileSync(file,'utf8'))===bank.sha256);
  assert.ok(source,`Original do snapshot não encontrado: ${bank.file}`);
  const original=fs.readFileSync(source,'utf8');
  assert.equal(hash(original),bank.sha256);
  const staged=patchSource(original,bank,all);
  assert.equal(staged,fs.readFileSync(path.join(output,'preview',bank.file),'utf8'));
  const loaded=readBank(bank.file,path.join(output,'preview'));
  assert.deepEqual(Object.keys(loaded.bank),Object.keys(bank.bank));
  for(const [cid,qs] of Object.entries(loaded.bank)){
   assert.equal(qs.length,bank.bank[cid].length);
   qs.forEach((q,i)=>assert.deepEqual(q,all.find(r=>r.courseId===cid&&r.ordinal===i+1).after));
  }
 }
});
test('atualização parcial preserva questões não aprovadas e draft divergente falha fechado',()=>{
 const c=plan.courses[0], row=snapshot.resources.find(r=>r.id===c.id);
 const after=patchDocument(row.published,[c.reviews[0]]);
 assert.deepEqual(after.proficiencyQuestions.slice(1),row.published.proficiencyQuestions.slice(1));
 assert.equal(patchDocument(null,[c.reviews[0]]),null);
 assert.throws(()=>patchDocument({...row.published,proficiencyQuestions:[]},[c.reviews[0]]),/não existem/);
 assert.throws(()=>validate({...c.reviews[0].after,correct:'fora das alternativas'}),/inválida/);
});
test('SQL em PostgreSQL: nulidade de draft, transação, concorrência e rollback',async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE TABLE public.academy_resources (id text primary key,kind text,published jsonb,draft jsonb,revision int,updated_at timestamptz);');
  const changes=plan.courses.slice(0,2).map(c=>{const before=snapshot.resources.find(r=>r.id===c.id);return{id:before.id,before,after:{...before,published:patchDocument(before.published,c.reviews),draft:patchDocument(before.draft,c.reviews)}};});
  for(const c of changes)await db.query('INSERT INTO academy_resources VALUES ($1,$2,$3,$4,$5,$6)',[c.id,'course',c.before.published,c.before.draft,c.before.revision,c.before.updated_at]);
  // Concurrent edit in the second course must undo an earlier update in the same transaction.
  await db.query('UPDATE academy_resources SET revision=revision+1 WHERE id=$1',[changes[1].id]);
  await assert.rejects(db.exec(sqlFor(changes)),/alterado desde/);
  await db.exec('ROLLBACK;');
  let row=(await db.query('SELECT * FROM academy_resources WHERE id=$1',[changes[0].id])).rows[0];
  assert.deepEqual(row.published,changes[0].before.published);
  await db.query('UPDATE academy_resources SET revision=$2 WHERE id=$1',[changes[1].id,changes[1].before.revision]);
  await db.exec(sqlFor(changes,{preview:true}));
  row=(await db.query('SELECT * FROM academy_resources WHERE id=$1',[changes[0].id])).rows[0];
  assert.deepEqual(row.published,changes[0].before.published);
  await db.exec(sqlFor(changes));
  row=(await db.query('SELECT * FROM academy_resources WHERE id=$1',[changes[0].id])).rows[0];
  assert.deepEqual(row.published,changes[0].after.published);assert.equal(row.draft,null);assert.equal(row.revision,changes[0].before.revision);
  await db.exec(sqlFor(changes,{rollback:true}));
  row=(await db.query('SELECT * FROM academy_resources WHERE id=$1',[changes[0].id])).rows[0];assert.deepEqual(row.published,changes[0].before.published);
  // Existing draft retains its unrelated fields and receives only selected question fields.
  const c=changes[0],withDraft={...c.before,draft:{...c.before.published,title:'Rascunho próprio',description:'Não sobrescrever'}};
  const after={...withDraft,published:patchDocument(withDraft.published,[plan.courses[0].reviews[0]]),draft:patchDocument(withDraft.draft,[plan.courses[0].reviews[0]])};
  await db.query('UPDATE academy_resources SET draft=$2,updated_at=$3 WHERE id=$1',[c.id,withDraft.draft,withDraft.updated_at]);
  await db.exec(sqlFor([{id:c.id,before:withDraft,after}]));
  row=(await db.query('SELECT * FROM academy_resources WHERE id=$1',[c.id])).rows[0];
  assert.deepEqual(row.draft,after.draft);assert.equal(row.draft.title,'Rascunho próprio');
 }finally{await db.close();}
});
