import { z } from "zod";
import { ApiError, authenticate } from "@/lib/pilot-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

const optionSchema = z.object({ id: z.string().regex(/^[a-z0-9_-]{1,12}$/), text: z.string().trim().min(1).max(500) }).strict();
const questionSchema = z.object({
  prompt: z.string().trim().min(5).max(3000),
  options: z.array(optionSchema).min(2).max(6),
  correctOptionId: z.string().min(1).max(12),
  explanation: z.string().trim().min(5).max(3000),
  imageUrl: z.union([z.url().startsWith("https://"), z.literal("")]).default(""),
  imageAlt: z.string().trim().max(300).default(""),
}).strict().superRefine((question, context) => {
  const ids = question.options.map(option => option.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "Alternativas repetidas." });
  if (!ids.includes(question.correctOptionId)) context.addIssue({ code: "custom", message: "Escolha um gabarito válido." });
  if (question.imageUrl && !question.imageAlt) context.addIssue({ code: "custom", message: "Descreva a imagem de apoio." });
});
const quizSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(3).max(200),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  description: z.string().trim().max(2000),
  category: z.enum(["legislacao", "sistema", "suporte", "pro", "fiscal"]),
  xpReward: z.number().int().min(0).max(500),
  passingScore: z.number().int().min(0).max(100),
  periodType: z.enum(["weekly", "biweekly", "monthly"]),
  targetAudience: z.enum(["internal", "client"]),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  availableFrom: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
  questions: z.array(questionSchema).min(2).max(30),
}).strict().refine(value => !value.expiresAt || Date.parse(value.expiresAt) > Date.parse(value.availableFrom), {
  message: "O prazo final precisa ser posterior à liberação.", path: ["expiresAt"],
});
const statusSchema = z.object({ id: z.uuid(), active: z.boolean() }).strict();

function requireAdmin(me: { role: string; audience?: string }) {
  if (me.role !== "admin" || me.audience === "client") throw new ApiError("Apenas administradores internos podem editar desafios.", 403);
}
function failure(error: unknown) {
  return Response.json({ error: error instanceof ApiError ? error.message : "Não foi possível acessar os desafios." },
    { status: error instanceof ApiError ? error.status : 500, headers });
}
async function body(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 100000) throw new ApiError("Solicitação muito grande.", 413);
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 100000) throw new ApiError("Solicitação muito grande.", 413);
  try { return JSON.parse(raw) as unknown; } catch { throw new ApiError("Dados inválidos."); }
}

export async function GET(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    requireAdmin(me);
    const quizzes = await db.from("academy_quizzes").select("id,title,slug,description,category,xp_reward,passing_score,period_type,is_active,is_featured,available_from,expires_at,target_audience,updated_at").order("updated_at", { ascending: false });
    if (quizzes.error) throw new ApiError("Cadastro de desafios indisponível. Confira as migrations 009, 010 e 011.", 503);
    const ids = (quizzes.data ?? []).map(quiz => quiz.id);
    if (!ids.length) return Response.json({ quizzes: [] }, { headers });
    const questions = await db.from("academy_quiz_questions").select("id,quiz_id,order_index,prompt,options,correct_option_id,explanation,image_url,image_alt").in("quiz_id", ids).order("order_index");
    if (questions.error) throw new ApiError("Não foi possível carregar as perguntas.", 503);
    return Response.json({ quizzes: (quizzes.data ?? []).map(quiz => ({ ...quiz,
      questions: (questions.data ?? []).filter(question => question.quiz_id === quiz.id),
    })) }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    requireAdmin(me);
    const parsed = quizSchema.safeParse(await body(request));
    if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message || "Dados inválidos.");
    const result = await db.rpc("academy_save_periodic_quiz", { actor: me.id, payload: parsed.data });
    if (result.error) {
      if (result.error.code === "23505") throw new ApiError("Já existe um desafio com esse identificador.", 409);
      if (result.error.message.includes("já respondido")) throw new ApiError("Este desafio já tem respostas. Crie uma nova edição para mudar as perguntas.", 409);
      throw new ApiError("Não foi possível salvar o desafio. Confira a migration de administração.", 503);
    }
    return Response.json({ id: result.data }, { headers });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    requireAdmin(me);
    const parsed = statusSchema.safeParse(await body(request));
    if (!parsed.success) throw new ApiError("Dados inválidos.");
    const result = await db.rpc("academy_set_periodic_quiz_active", {
      actor: me.id, quiz: parsed.data.id, active: parsed.data.active,
    });
    if (result.error) throw new ApiError("Não foi possível alterar a disponibilidade do desafio.", 503);
    return Response.json({ saved: true }, { headers });
  } catch (error) { return failure(error); }
}
