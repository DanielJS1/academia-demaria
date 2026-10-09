import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const scratch = process.env.DEMARIA_QUESTIONS_DIR || 'C:/Users/Daniel José/.gemini/antigravity-ide/brain/b6028f87-e7db-4922-ba38-eb6cf62869c1/scratch';
export const output = path.resolve(import.meta.dirname, '../reports/proficiency-audit');
export const files = ['questions-challenging-part1.mjs', 'questions-challenging-part2.mjs', 'questions-part1.mjs', 'questions-part2.mjs'];
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export function readBank(file, directory = scratch) {
  const source = fs.readFileSync(path.join(directory, file), 'utf8');
  let ordinal = 0;
  const make = (prompt, options, correct, multiple = false) => ({ id: `${file}:${++ordinal}`, prompt: prompt.trim(), type: 'choice', options: options.map(x => x.trim()), correct: typeof correct === 'string' ? correct.trim() : JSON.stringify(correct), ...(multiple ? { multiple } : {}) });
  const context = { makeQ: make, makeChallengingQ: (prompt, correct, distractors, index) => { const options = [...distractors]; options.splice(index, 0, correct); return make(prompt, options, correct); }, rotateIndex: i => [1, 2, 0, 3][i % 4] };
  const body = source.replace(/^import .*;\s*$/gm, '').replace(/export const (\w+) =/, 'globalThis.bank =');
  vm.runInNewContext(body, context, { timeout: 2000 });
  return { file, sha256: hash(source), bank: JSON.parse(JSON.stringify(context.bank)) };
}
export function client() {
  const envPath = path.resolve(import.meta.dirname, '../.env.local');
  if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Credenciais Supabase ausentes.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const banks = files.map(readBank);
  const transcripts = JSON.parse(fs.readFileSync(path.join(scratch, 'transcripts.json'), 'utf8'));
  const db = client();
  const [resources, materials] = await Promise.all([
    db.from('academy_resources').select('*').eq('kind', 'course').order('id'),
    db.from('academy_technical_materials').select('*').order('title'),
  ]);
  if (resources.error || materials.error) throw new Error(resources.error?.message || materials.error.message);
  fs.writeFileSync(path.join(output, 'snapshot.json'), JSON.stringify({ capturedAt: new Date().toISOString(), banks, resources: resources.data, materials: materials.data, transcriptsSha256: hash(fs.readFileSync(path.join(scratch, 'transcripts.json'), 'utf8')) }, null, 2));
  const inventory = banks.map(b => ({ file: b.file, courses: Object.keys(b.bank).length, questions: Object.values(b.bank).reduce((n, q) => n + q.length, 0) }));
  console.log(JSON.stringify({ inventory, courses: resources.data.map(r => ({ id: r.id, title: r.published?.title || r.draft?.title, published: r.published?.proficiencyQuestions?.length || 0, draft: r.draft?.proficiencyQuestions?.length || 0 })), materials: materials.data.length, transcripts: transcripts.map(t => ({ course: t.courseTitle, lesson: t.lessonTitle, chars: t.fullTranscript?.length || 0 })) }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) await main();
