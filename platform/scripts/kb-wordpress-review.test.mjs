import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historicalMetadata, normalizeImportedDocument } from './kb-wordpress-review.mjs';
const p=text=>({type:'paragraph',...(text?{content:[{type:'text',text}]}:{})});
const item=(...content)=>({type:'listItem',content});
const list=(...content)=>({type:'bulletList',content});
test('removes empty bullet nesting while preserving text, image order and ordered numbering',()=>{
  const image={type:'image',attrs:{alt:'Captura original'}};
  const numbered={type:'orderedList',attrs:{start:4},content:[item(p('Quarto passo'))]};
  const d={metadata:{product:'DOC-Windows'},sections:[{content:{type:'doc',content:[p(),list(item(p(),list(item(list(item(p('Orientação'),image))))),item(p())),numbered]}}]};
  normalizeImportedDocument(d,{title:'Teste',media:[{source:'image.png'}],visibility:'public'});
  assert.deepEqual(d.sections[0].content.content,[list(item(p('Orientação'),image)),numbered]);
});
test('keeps actual authored nested steps rather than flattening them',()=>{
  const original=list(item(p('Primeiro passo'),list(item(p('Detalhe')))));
  const d={metadata:{product:'DOC-Windows'},sections:[{content:{type:'doc',content:[structuredClone(original)]}}]};
  normalizeImportedDocument(d,{title:'Teste',media:[],visibility:'private'});
  assert.deepEqual(d.sections[0].content.content,[original]);
});
test('lifts image-only bullets without changing neighboring instructions',()=>{
  const image={type:'image',attrs:{alt:'Imagem'}};
  const d={metadata:{product:'DOC-Windows'},sections:[{content:{type:'doc',content:[list(item(p('Antes')),item(p(),image),item(p('Depois')))]}}]};
  normalizeImportedDocument(d,{title:'Teste',media:[{source:'image.png'}],visibility:'public'});
  assert.deepEqual(d.sections[0].content.content,[list(item(p('Antes'))),image,list(item(p('Depois')))]);
});
test('uses WXR publication and named author, keeps explicit reviewer and does not invent revision from modified date',()=>{
  const r={published:'2026-10-05 11:40:03',modified:'2026-10-07 10:00:00',authorName:'Daniel José',html:'<p>Data da publicação: 05/10/2026<br>Data da última revisão: 06/10/2026 (Felipe)</p>'};
  assert.deepEqual(historicalMetadata(r),{legacyPublished:'05/10/2026 · Autor: Daniel José',legacyRevision:'06/10/2026 (Felipe)'});
  assert.equal(historicalMetadata({...r,html:'<p>Sem revisão</p>'}).legacyRevision,null);
});
test('preserves declared publication when it differs from WXR and flags editorial reconciliation',()=>{
  const r={published:'2025-02-06 11:00:00',authorName:'Daniel José',html:'<p>Data da publicação: 06/03/2025 (Daniel José)</p>',title:'MultiScan',media:[],visibility:'public'};
  const d={metadata:{product:'DOC-Windows',...historicalMetadata(r)},sections:[{content:{type:'doc',content:[p('Orientações do MultiScan.')]}}]};
  const review=normalizeImportedDocument(d,r);
  assert.equal(d.metadata.legacyPublished,'06/03/2025 · Autor: Daniel José');
  assert.ok(review.pending.some(s=>s.includes('difere da data do WordPress')));
  assert.equal(r.published,'2025-02-06 11:00:00');
});
