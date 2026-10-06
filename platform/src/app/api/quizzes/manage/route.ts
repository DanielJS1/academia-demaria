import { periodicQuizDraftSchema as quizSchema, periodicQuizStatusSchema as statusSchema, periodicQuizDeleteSchema as deleteSchema } from "@/lib/periodic-quizzes";
import { ApiError, authenticate } from "@/lib/pilot-server";
import { quizAdminDatabaseError, quizAdminFailure as failure } from "@/lib/quiz-admin-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

function requireAdmin(me: { role: string; audience?: string }) {
  if (me.role !== "admin" || me.audience === "client") throw new ApiError("Apenas administradores internos podem editar desafios.", 403);
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
    const quizzes = await db.from("academy_quizzes").select("id,title,slug,description,category,xp_reward,passing_score,period_type,is_active,is_featured,available_from,expires_at,target_audience,updated_at,revision,announcement_at,academy_quiz_attempts(count)").is("deleted_at", null).order("updated_at", { ascending: false });
    if (quizzes.error) throw quizAdminDatabaseError(quizzes.error, "list");
    const ids = (quizzes.data ?? []).map(quiz => quiz.id);
    if (!ids.length) return Response.json({ quizzes: [] }, { headers });
    const questions = await db.from("academy_quiz_questions").select("id,quiz_id,order_index,prompt,options,correct_option_id,explanation,image_url,image_alt").in("quiz_id", ids).order("order_index");
    if (questions.error) throw quizAdminDatabaseError(questions.error, "list-questions");
    return Response.json({ quizzes: (quizzes.data ?? []).map(({ academy_quiz_attempts, ...quiz }) => ({ ...quiz,
      has_attempts: (academy_quiz_attempts[0]?.count ?? 0) > 0,
      audience_locked: !!quiz.announcement_at && new Date(quiz.announcement_at).getTime() <= Date.now(),
      questions: (questions.data ?? []).filter(question => question.quiz_id === quiz.id),
    })) }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    requireAdmin(me);
    const parsed = quizSchema.safeParse(await body(request));
    if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.code === "custom"
      ? parsed.error.issues[0].message : "Revise os campos do desafio. Há valores inválidos.");
    const result = await db.rpc("academy_save_periodic_quiz", { actor: me.id, payload: parsed.data });
    if (result.error) throw quizAdminDatabaseError(result.error, "save");
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
      actor: me.id, quiz: parsed.data.id, active: parsed.data.active, expected_revision: parsed.data.expectedRevision ?? null,
    });
    if (result.error) throw quizAdminDatabaseError(result.error, "set-active");
    return Response.json({ saved: true }, { headers });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    requireAdmin(me);
    const parsed = deleteSchema.safeParse(await body(request));
    if (!parsed.success) throw new ApiError("Dados inválidos.");
    const result = await db.rpc("academy_delete_periodic_quiz", { actor: me.id, quiz: parsed.data.id, expected_revision: parsed.data.expectedRevision ?? null });
    if (result.error) throw quizAdminDatabaseError(result.error, "delete");
    return Response.json({ deleted: true }, { headers });
  } catch (error) { return failure(error); }
}
