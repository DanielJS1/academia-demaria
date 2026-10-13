import test from 'node:test';
import assert from 'node:assert/strict';
import { accountPlan, presentationData, demoId, assertIsolated, HOMOLOGACAO_REF } from './presentation-data.mjs';
import { periodicQuizSchema } from '../src/lib/periodic-quizzes.ts';
test('refuses production or a mismatched service endpoint',()=>{
  assert.throws(()=>assertIsolated({E2E_ISOLATED_SUPABASE_REF:'ktmymzokgxmmkleacclq',NEXT_PUBLIC_SUPABASE_URL:'https://ktmymzokgxmmkleacclq.supabase.co'}));
  assert.throws(()=>assertIsolated({E2E_ISOLATED_SUPABASE_REF:HOMOLOGACAO_REF,NEXT_PUBLIC_SUPABASE_URL:'https://ktmymzokgxmmkleacclq.supabase.co'}));
  assertIsolated({E2E_ISOLATED_SUPABASE_REF:HOMOLOGACAO_REF,NEXT_PUBLIC_SUPABASE_URL:`https://${HOMOLOGACAO_REF}.supabase.co`});
});
test('deterministic namespace, six managers and varied employee states',()=>{
  const people=accountPlan();assert.equal(people.length,151);assert.equal(people.filter(a=>a.role==='manager').length,6);assert.equal(people.filter(a=>a.status==='inactive').length,12);assert.equal(people.filter(a=>a.status==='pending').length,12);assert.equal(new Set(people.map(a=>a.email)).size,151);assert.equal(demoId('one'),demoId('one'));
});
test('creates valid varied sources without duplicate official challenges or leaking passwords',()=>{
  const data=presentationData(accountPlan().map(a=>({...a,id:demoId(a.key)})),new Date('2026-10-13T12:00:00Z'));
  assert.equal(data.counts.academy_resources,36);assert.ok(data.counts.academy_engagement_daily>1000);assert.ok(data.counts.academy_xp>1000);
  const attempts=data.tables.academy_quiz_attempts;assert.equal(new Set(attempts.map(a=>`${a.user_id}:${a.quiz_id}`)).size,attempts.length);
  for(const attempt of attempts)periodicQuizSchema.parse(attempt.snapshot);
  assert.ok(data.tables.academy_attempts.some(a=>a.status==='pending'&&a.score===null));assert.ok(data.tables.academy_attempts.some(a=>a.quiz_id==='proficiency'));assert.ok(data.tables.academy_attempts.some(a=>a.partial_text_ids.length));
  assert.ok(data.tables.academy_trail_policies.every(p=>!p.data.email&&!p.data.discord));assert.equal(JSON.stringify(data).includes('password'),false);
});
