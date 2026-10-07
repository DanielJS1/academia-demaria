import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";

const envFile = resolve(process.argv[2] || ".env.homologacao.local");
process.loadEnvFile(envFile);
const ref = process.env.E2E_ISOLATED_SUPABASE_REF;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!ref || ref === "ktmymzokgxmmkleacclq" || new URL(url).hostname !== `${ref}.supabase.co`)
  throw new Error("Seed requires an explicit isolated Supabase reference; production is forbidden");
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
function requireSuccess(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.data;
}
const existing = requireSuccess(await db.auth.admin.listUsers({ perPage: 1000 }), "List test users").users;
const credentials = {};
const people = {};
for (const [role, profileRole, audience] of [["admin", "admin", "internal"], ["gestor", "manager", "internal"], ["colaborador", "student", "internal"], ["cartorio", "student", "client"]]) {
  const prefix = `E2E_${role.toUpperCase()}`;
  const email = process.env[`${prefix}_EMAIL`] || `homologacao.${role}@demaria.com.br`;
  const password = process.env[`${prefix}_PASSWORD`] || randomBytes(24).toString("base64url");
  let account = existing.find(user => user.email === email);
  if (!account) account = requireSuccess(await db.auth.admin.createUser({ email, password, email_confirm: true }), "Create dedicated account").user;
  else if (!process.env[`${prefix}_PASSWORD`]) throw new Error("Existing test account requires its original password in the private env file");
  people[role] = { id: account.id, name: `Homologação ${role}`, email, department: "Homologação", role: profileRole, audience, status: "active" };
  credentials[`${prefix}_EMAIL`] = email;
  credentials[`${prefix}_PASSWORD`] = password;
}
requireSuccess(await db.from("academy_profiles").upsert(Object.values(people).map(person => ({ ...person, manager_id: person.role === "student" && person.audience === "internal" ? people.gestor.id : null }))), "Save dedicated profiles");
requireSuccess(await db.from("academy_cartorios").upsert({ id: "homologacao-cartorio", name: "Cartório Fictício de Homologação", city: "São Paulo", uf: "SP", status: "active", modules: [] }), "Create fictitious registry");
requireSuccess(await db.from("academy_profiles").update({ cartorio_id: "homologacao-cartorio" }).eq("id", people.cartorio.id), "Link client profile");
requireSuccess(await db.from("academy_settings").update({ departments: ["Homologação"], products: ["DOC-Windows", "Conhecimentos gerais"] }).eq("id", true), "Configure test catalog");

const pdfPath = "pdf/11111111-1111-4111-8111-111111111111.pdf";
const bucket = await db.storage.getBucket("academy-pdfs");
if (bucket.error) requireSuccess(await db.storage.createBucket("academy-pdfs", { public: false, allowedMimeTypes: ["application/pdf"], fileSizeLimit: 3145728 }), "Create private PDF bucket");
const pdfContent = "BT /F1 18 Tf 50 750 Td (Documento ficticio de homologacao) Tj ET";
const objects = ["<</Type/Catalog/Pages 2 0 R>>", "<</Type/Pages/Count 1/Kids[3 0 R]>>", "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>", `<</Length ${pdfContent.length}>>\nstream\n${pdfContent}\nendstream`, "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>"];
let pdf = "%PDF-1.4\n";
const offsets = [0];
for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
const xrefOffset = Buffer.byteLength(pdf);
pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<</Root 1 0 R/Size 6>>\nstartxref\n${xrefOffset}\n%%EOF`;
requireSuccess(await db.storage.from("academy-pdfs").upload(pdfPath, Buffer.from(pdf), { contentType: "application/pdf", upsert: true }), "Upload fictitious PDF");
function course(id, audience = "internal", type = "reading") {
  return { id, title: `Homologação · ${id}`, description: "Conteúdo fictício para validar funcionalidades. Sem dados de produção.", product: "DOC-Windows", category: "sistema", level: "essencial", accent: "violet", status: "published", xp: 20, required: false, banner: "", logoUrl: "", author: "Homologação", department: "Homologação", audience, requiredModules: [], isSelagem: false, hasProficiencyTest: false, proficiencyScore: 85, proficiencyQuestions: [], questions: [], passingScore: 70, retryPolicy: "free", version: 1,
    lessons: [{ id: `${id}-lesson`, title: `Aula exclusiva ${id}`, module: "Homologação", minutes: 10, type, content: "<p>Conteúdo fictício de homologação para validar anotações, conclusão e acesso.</p>", videoUrl: type === "video" ? "https://vimeo.com/1084537" : "", ...(id === "homologacao-pdf" ? { attachmentPath: pdfPath, attachmentName: "Exemplo fictício.pdf" } : {}) }] };
}
for (const doc of [course("homologacao-interno"), course("homologacao-xp"), course("homologacao-notas"), course("homologacao-pdf"), course("homologacao-video", "internal", "video"), course("homologacao-cliente", "client")])
  requireSuccess(await db.from("academy_resources").upsert({ id: doc.id, kind: "course", published: doc, revision: 1 }), "Seed fictitious course");
Object.assign(credentials, { E2E_INTERNAL_COURSE_ID: "homologacao-interno", E2E_XP_COURSE_ID: "homologacao-xp", E2E_NOTES_COURSE_ID: "homologacao-notas", E2E_ATTACHMENT_COURSE_ID: "homologacao-pdf", E2E_VIDEO_COURSE_ID: "homologacao-video", E2E_BASE_URL: "http://127.0.0.1:4174" });
credentials.NEXT_PUBLIC_APP_ENV = "homologacao";
appendFileSync(envFile, "\n" + Object.entries(credentials).map(([key, value]) => `${key}=${value}`).join("\n") + "\n");
const sampleSlug = "homologacao-desafio-inicial";
const priorQuiz = requireSuccess(await db.from("academy_quizzes").select("id").eq("slug", sampleSlug).maybeSingle(), "Check sample quiz");
if (!priorQuiz) requireSuccess(await db.rpc("academy_save_periodic_quiz", { actor: people.admin.id, payload: {
  title: "Homologação: conheça a central de desafios", slug: sampleSlug, description: "Edição fictícia. As tentativas e XP ficam somente neste ambiente.", category: "sistema", xpReward: 70, passingScore: 70, periodType: "weekly", targetAudience: "internal", isActive: true, isFeatured: true, availableFrom: new Date(Date.now() - 60000).toISOString(), expiresAt: null,
  questions: Array.from({ length: 5 }, (_, i) => ({ id: randomUUID(), prompt: `Questão ${i + 1}: este é o ambiente de homologação. Onde o resultado desta tentativa será registrado?`, options: [{ id: "a", text: "Somente no banco de homologação" }, { id: "b", text: "No banco de produção" }], correctOptionId: "a", explanation: "Cada ambiente usa seu próprio banco e suas próprias contas.", imageUrl: "", imageAlt: "" }))
} }), "Create fictitious challenge");
console.log("Homologação preparada: 4 contas dedicadas, 6 cursos fictícios, PDF privado e desafio de exemplo. Credenciais salvas apenas no env privado.");
