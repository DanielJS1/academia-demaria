import fs from 'node:fs';
import path from 'node:path';
import { output, scratch, hash } from './audit-proficiency-snapshot.mjs';
import { proposals } from './proficiency-review-proposals.mjs';

const snapshot = JSON.parse(fs.readFileSync(path.join(output, 'snapshot.json'), 'utf8'));
const evidence = JSON.parse(fs.readFileSync(path.join(output, 'evidence.json'), 'utf8'));
const transcripts = JSON.parse(fs.readFileSync(path.join(output, 'transcripts-nonempty.json'), 'utf8'));
const external = {
 sirc: { title:'Guia oficial SIRC — Registros enviados fora do prazo', url:'https://www.sirc.gov.br/guias/guia-sirc-cartorios/menu-funcoes-de-serventia/infracoes-da-serventia-registros-enviados-fora-do-prazo/', location:'Prazo de um dia útil; exceção para município sem acesso à internet', text:'O guia oficial informa prazo de um dia útil e exceção legal de cinco dias úteis para municípios sem acesso à internet.' },
 'sirc-no-movement': { title:'Guia oficial SIRC — Acompanhamento diário', url:'https://www.sirc.gov.br/guias/guias-e-tutoriais-complementares-sirc/acompanhamentos-sirc/acompanhamento-diario-do-sirc/', location:'Inexistência de movimento mensal', text:'Declarar inexistência de movimento até o quinto dia útil do mês subsequente, por tipo sem lavratura.' },
 cnj213: { title:'Provimento CNJ 213/2026 — texto disponibilizado pelo STJ', url:'https://www.stj.jus.br/internet_docs/biblioteca/clippinglegislacao/Prov_213_2026_CNJ.pdf', location:'Ementa e Anexo V (páginas 1 e 18–20)', text:'Revoga o Provimento 74/2018; prevê testes documentados de restauração e validação dos dados recuperados.' },
};
function cite(q) {
 if (typeof q.source === 'number') {
  const t = transcripts.find(t => t.sourceIndex === q.source);
  const at = t.fullTranscript.toLocaleLowerCase('pt-BR').indexOf(q.anchor.toLocaleLowerCase('pt-BR'));
  if (at < 0) throw new Error(`Âncora ausente T${q.source}: ${q.anchor}`);
  const start = Math.max(0, at-200), end = Math.min(t.fullTranscript.length,at+1400);
  return { id:`T${q.source}:${at}`, kind:'transcript', title:`${t.courseTitle} — ${t.lessonTitle}`, file:path.join(scratch,'transcripts.json'), location:`caracteres ${start}–${end} (índices base zero; não são timestamps)`, text:t.fullTranscript.slice(start,end), videoUrl:t.videoUrl, sha256:snapshot.transcriptsSha256 };
 }
 if (q.source === 'editorial') return { kind:'editorial', title:'Proposta editorial do revisor', location:'Validação pelo responsável por atendimento', text:'Cenário de suporte formulado para a avaliação. Não certifica política interna de RH nem funcionalidade de produto.' };
 if (q.source.startsWith('enot')) {
  const file = path.join(scratch, `enot-${q.source.at(-1)}-storyboard.webp`);
  return { kind:'frames', title:`Vídeo interno e-Notariado — Parte ${q.source.at(-1)}`, file, location:q.anchor, sha256:hash(fs.readFileSync(file)), text:'Leitura visual das legendas do storyboard. Material histórico (release 2.24 / 2.33); os enunciados delimitam a configuração demonstrada. Confirmar adequação à versão utilizada pela equipe.' };
 }
 if (external[q.source]) return {kind:'official',...external[q.source],checkedAt:'2026-10-07'};
 const e = evidence.find(e => e.id === q.source);
 if (!e || !e.text.toLocaleLowerCase('pt-BR').includes(q.anchor.toLocaleLowerCase('pt-BR'))) throw new Error(`Âncora ausente ${q.source}: ${q.anchor}`);
 return e;
}
export function validateQuestion(q) {
 if (!q.id || q.type !== 'choice' || !q.prompt?.trim() || !Array.isArray(q.options) || q.options.length < 2 || q.multiple) throw new Error(`Questão inválida: ${q.id}`);
 if (q.options.filter(o => o === q.correct).length !== 1) throw new Error(`Gabarito não é alternativa única: ${q.id}`);
 if (new Set(q.options.map(x=>x.trim().toLocaleLowerCase('pt-BR'))).size !== q.options.length) throw new Error(`Alternativas duplicadas: ${q.id}`);
}
const adjusted = {
 'DOC-Mobile':[1,2,3,4], 'Nova criptografia do DOC-Backup':[1,2,3,4],
 'DOC-Windows | Registro Civil':[2,3,6,9,10,11,12,13],
 'DOC-Fila':[1,3,5,6], 'DOC-MultiScan':[1,3,4,5,6],
 'DOC-Windows | Novas Certidões (Prov. 182/2024)':[1,2,3,5],
 'DOC-Windows | Comunicações':[1,2,3], 'DOC-Windows | Averbações':[1,2,3,4,6],
 'DOC-Windows | Procurações':[5,6], 'DOC-Windows | Firmas':[1,2,4,9],
 'DOC-Windows | Escrituras':[1,2,4,5], 'DOC-Windows | Financeiro':[1,4,7,9],
 'DOC-Windows | e-Notariado':[1,3,4,5],
};
function findings(q, title, ordinal) {
 const notes = [];
 if (/Função 607|Função 607\./.test(q.correct) && /verso|excesso/i.test(q.prompt)) notes.push('A fonte consultada define 607 como recuperação de assentamentos acessórios. Não comprova a afirmação de que 607, isoladamente, seja uma função universal de remessa ao verso.');
 if (/decendial/i.test(q.correct)) notes.push('Gabarito contradiz o prazo vigente do SIRC no cenário comum; orientação decendial removida.');
 if (/Provimento 74|Prov\. 74/.test(q.prompt+q.correct)) notes.push('Referência normativa desatualizada: o Provimento 213/2026 revogou o 74. Criptografia isolada não comprova conformidade integral.');
 if (/checksum|OFX|bloqueio de numeração|transacional de bloqueio/i.test(q.correct)) notes.push('Afirmação de implementação automática não comprovada nas fontes do produto consultadas; removida do gabarito proposto.');
 if (/Ctrl\+H/.test(q.correct)) notes.push('Atalho Ctrl+H não confirmado pela aula; proposta usa a aba Histórico demonstrada.');
 if (/credenciais corporativas/.test(q.correct) && title==='DOC-Mobile') notes.push('O acesso do DOC-Mobile tem credenciais próprias vinculadas à licença; não é o mesmo login do DOC-Windows.');
 if (title==='DOC-Mobile' && ordinal===4) notes.push('Manual release 4.63 situa usuário/licença e estação nos cantos inferiores; aula menciona posição superior. Prioridade dada ao manual posterior.');
 if (title==='DOC-Serviços') notes.push('Banco confunde DOC-Serviços com consultas cadastrais/biometria. Manual define comunicação DeMaria–serventias, com mensagens, monitoramento e relatórios.');
 if (title==='DOC-Backup') notes.push('Transcrição da aula original tem reconhecimento de fala severamente corrompido. Não usada para confirmar rotinas automáticas de integridade, agendamento ou escopo de pastas. Substituição usa fontes legíveis; confirmar cobertura no curso.');
 if (title==='DOC-Windows | e-Notariado') notes.push('Material visual histórico de configuração CCN. Não usar a data de 01/01/2019 como obrigação normativa atual universal nem confundir cadastro/envio CCN com videoconferência.');
 if (title==='Soft Skills') notes.push('Questão teórica de psicologia/RH substituída por decisão concreta no atendimento de cartório. Validação editorial interna pendente.');
 if (/BIOS|latim|1889|cassete|máquina de escrever|WhatsApp|Bluetooth|pen drive conectado|fachada|grampos/i.test(q.options.filter(o=>o!==q.correct).join(' '))) notes.push('Distratores contêm alternativas caricatas ou alheias ao fluxo; substituídos por confusões de menu, sequência, credenciais ou operação.');
 if (!notes.length) notes.push('Reformulação para cenário verificável de suporte, com escolha operacional, terminologia da fonte e distratores que representam confusões plausíveis. Não extrapolar regras jurídicas ou funcionalidades sem evidência.');
 return notes;
}
const courses = [], occurrences = [], approvals = [];
for (const resource of snapshot.resources) {
 const original = resource.published?.proficiencyQuestions || resource.draft?.proficiencyQuestions;
 if (!original?.length) continue;
 const title = resource.published?.title || resource.draft.title;
 const planned = proposals[title];
 if (!planned || planned.length !== original.length) throw new Error(`Cobertura incompleta ${title}`);
 const reviews = original.map((before,i) => {
  validateQuestion(before);
  const p = planned[i], options=[...p.wrong];
  options.splice([1,2,0,3][i%4],0,p.correct);
  const after = { ...before, prompt:p.prompt, correct:p.correct, options };
  validateQuestion(after);
  const reviewId = `${resource.id}:${String(i+1).padStart(2,'0')}`;
  const review = { reviewId, courseId:resource.id, course:title, questionId:before.id, ordinal:i+1, diagnosis:adjusted[title]?.includes(i+1)?'Ajustada':'Substituída', findings:findings(before,title,i+1), before, after, evidence:[cite(p)], validation:'Pendente de validação DeMaria' };
  for (const bank of snapshot.banks) {
   if (!bank.bank[resource.id]) continue;
   const q = bank.bank[resource.id]?.[i];
   if (!q) throw new Error(`Questão faltando em ${bank.file} / ${reviewId}`);
   validateQuestion(q);
   occurrences.push({file:bank.file, sourceId:q.id, course:title, courseId:resource.id, ordinal:i+1, databaseQuestionId:before.id, reviewId, diagnosis:review.diagnosis, original:q, proposed:after, findings:[...findings(q,title,i+1)], evidence:review.evidence.map(e=>({id:e.id, title:e.title, location:e.location, file:e.file, url:e.url})), promptMatchesLive:q.prompt===before.prompt, correctMatchesLive:q.correct===before.correct, optionsMatchLive:JSON.stringify(q.options)===JSON.stringify(before.options) });
  }
  approvals.push({reviewId,questionId:before.id,questionHash:hash(after),approved:false,reviewer:'',reviewedAt:''});
  return review;
 });
 courses.push({id:resource.id,title,revision:resource.revision,reviews});
}
const plan = {capturedAt:snapshot.capturedAt,generatedAt:snapshot.capturedAt, snapshotHash:hash(snapshot), courses};
fs.writeFileSync(path.join(output,'review-plan.json'),JSON.stringify(plan,null,2));
fs.writeFileSync(path.join(output,'source-occurrences.json'),JSON.stringify(occurrences,null,2));
const approvalPath=path.join(output,'approvals.json');
if (!fs.existsSync(approvalPath) || !JSON.parse(fs.readFileSync(approvalPath,'utf8')).approvals.some(a=>a.approved)) fs.writeFileSync(approvalPath,JSON.stringify({planHash:hash(plan),approvals},null,2));
const md = ['# Revisão técnica das provas de proficiência', '', 'Data: 07/10/2026. Status: proposta concluída; validação DeMaria pendente. Nenhuma prova ou arquivo-fonte foi atualizado.', '', '158 questões publicadas em 20 cursos; 316 ocorrências nos quatro arquivos, com duas versões por posição. A versão challenging corresponde ao banco publicado. Na versão anterior, 157 enunciados/gabaritos e 158 conjuntos de alternativas diferem; essas variantes foram inventariadas separadamente, por curso e posição, e propostas para convergir ao banco revisado. IDs ativos preservados. Os IDs dos helpers eram gerados em cada execução; referências de arquivo usam nome e ordinal estáveis.', '', 'A classificação indica a decisão proposta: Ajustada mantém a competência central; Substituída troca o conteúdo ou recorte para uma operação comprovável. Nenhuma questão foi aprovada integralmente sem alteração editorial. Não se trata de certificação de comportamento em releases posteriores às fontes.', '', '## Resumo por curso', '', '| Curso | Questões | Ajustadas | Substituídas |', '|---|---:|---:|---:|'];
for (const c of courses) md.push(`| ${c.title.replaceAll('|','/')} | ${c.reviews.length} | ${c.reviews.filter(q=>q.diagnosis==='Ajustada').length} | ${c.reviews.filter(q=>q.diagnosis==='Substituída').length} |`);
md.push('', '## Achados prioritários', '', '- SIRC: orientação decendial incorreta no cenário comum; substituir pela rotina dentro do prazo oficial.', '- DOC-Serviços: conteúdo anterior descreve outro tipo de produto. Manual e aula tratam de comunicação com serventias, mensagens e monitoramento.', '- DOC-Mobile: login próprio, licenciamento e layout precisam respeitar o manual 4.63; posições do dashboard divergem da aula. O manual limita consultas a 30 dias e permite filtrar OSs quitadas.', '- Certidões: preservar a personalização da 607 antes de trocar o corpo; usar Layout → Novo Modelo; componentes são inseridos pela 670; salvar ao concluir. A 607 não foi validada como comando universal de remessa ao verso.', '- DOC-MultiScan: privilégios são concedidos na Manutenção do DOC-Windows; não confundir com administrador do Windows. Conferência de livro é consulta; não afirmar bloqueio automático de duplicidade.', '- DOC-Backup: checksum automático não comprovado. A transcrição original está corrompida; substituições usam o treinamento legível de criptografia e fonte normativa oficial.', '- e-Notariado: storyboards antigos confirmam configuração CCN, alertas e protocolos na versão demonstrada. Aplicabilidade à versão em uso deve ser confirmada; obrigação universal de carga desde 2019 foi retirada.', '- Soft Skills: os 14 itens passam a testar atendimento ao cliente de cartório. Aprovação editorial interna necessária.', '', '## Evidência e limites', '', 'Foram extraídos 56 arquivos PDF/DOCX/DOC e 34 transcrições não vazias. 14 registros de materiais técnicos foram lidos no Supabase; os documentos da unidade Y: foram usados como conteúdo, sem presumir que o espelho tem a mesma versão. `evidence.json` registra os textos, localizadores e hashes; `extraction-errors.json` registra falhas (nenhuma na extração final). Transcrições de outras aulas do mesmo módulo no onboarding são identificadas explicitamente. Confirme a release quando a rotina depender da versão.', '', 'Fontes externas complementares: [SIRC — prazos](https://www.sirc.gov.br/guias/guia-sirc-cartorios/menu-funcoes-de-serventia/infracoes-da-serventia-registros-enviados-fora-do-prazo/), [SIRC — acompanhamento](https://www.sirc.gov.br/guias/guias-e-tutoriais-complementares-sirc/acompanhamentos-sirc/acompanhamento-diario-do-sirc/), [Provimento 213/2026](https://www.stj.jus.br/internet_docs/biblioteca/clippinglegislacao/Prov_213_2026_CNJ.pdf).', '', '## Revisão por questão', '');
for (const c of courses) {
 md.push(`### ${c.title}`,'','Curso: `'+c.id+'` · revisão atual: '+c.revision,'');
 for (const q of c.reviews) {
  md.push(`#### ${String(q.ordinal).padStart(2,'0')} · ${q.diagnosis}`, '', 'ID da questão: `'+q.questionId+'` · referência de validação: `'+q.reviewId+'`', '', '**Diagnóstico:** '+q.findings.join(' '),'', '**Antes:** '+q.before.prompt, '', '**Gabarito anterior:** '+q.before.correct, '', '**Ajuste proposto:** '+q.after.prompt,'');
  q.after.options.forEach((o,i)=>md.push(`${String.fromCharCode(65+i)}. ${o}${o===q.after.correct?' **(correta)**':''}`));
  md.push('', '**Gabarito proposto:** '+q.after.correct, '', '**Evidência:** '+q.evidence.map(e=>`${e.id||e.kind} — ${e.title}, ${e.location}${e.url?` ([fonte](${e.url}))`:''}`).join('; '),'', '**Validação:** pendente. As alternativas anteriores de cada arquivo e seus diagnósticos estão em `source-occurrences.json`.', '');
 }
}
md.push('## Aplicação após validação', '', 'Leia `README.md`. Marque somente as entradas validadas em `approvals.json`, com responsável e data. O aplicador confere o hash de cada questão e usa exatamente o plano revisado. Alterações do conteúdo exigem regenerar plano e aprovação.', '', 'O SQL de aplicação usa transação única, bloqueio de linhas e comparação do conteúdo/revisão capturados. Modifica apenas `published.proficiencyQuestions`, `draft.proficiencyQuestions` (quando existem) e `updated_at`; preserva os demais campos, revision, nota mínima, flags, IDs e tentativas históricas. Há SQL inverso com verificação de concorrência. A aplicação deve ser feita sem prova em andamento: uma página já aberta pode conter alternativas anteriores, pois a correção de submissão consulta o curso atual.', '', 'Os arquivos `.mjs` são preparados por substituição das chamadas individuais por objetos estáveis, mantendo comentários e estrutura externa. Aplicar os arquivos só depois de confirmar o resultado do banco. Banco e filesystem não formam uma transação única; o procedimento verifica o banco antes de escrever os arquivos e cria cópias de segurança.', '');
fs.writeFileSync(path.join(output,'RELATORIO.md'),md.join('\n'));
const csv = [['Curso','Arquivo','ID fonte estável','ID ativo','Diagnóstico','Ajuste proposto','Gabarito','Validação'],...occurrences.map(o=>[o.course,o.file,o.sourceId,o.databaseQuestionId,o.diagnosis,o.proposed.prompt,o.proposed.correct,'Pendente'])].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';')).join('\r\n');
fs.writeFileSync(path.join(output,'questoes-por-arquivo.csv'),'\ufeff'+csv);
console.log(JSON.stringify({courses:courses.length,liveQuestions:approvals.length,fileOccurrences:occurrences.length,adjusted:courses.flatMap(c=>c.reviews).filter(q=>q.diagnosis==='Ajustada').length,replaced:courses.flatMap(c=>c.reviews).filter(q=>q.diagnosis==='Substituída').length,sourceOptionsDiffer:occurrences.filter(o=>!o.optionsMatchLive).length},null,2));
