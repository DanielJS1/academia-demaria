import { ApiError, authenticate } from "@/lib/pilot-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

export async function GET(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    const now = new Date().toISOString();
    const audience = me.audience ?? "internal";
    const quizzes = await db.from("academy_quizzes")
      .select("id,title,slug,description,category,xp_reward,passing_score,period_type,available_from,expires_at,target_audience")
      .eq("is_active", true).eq("target_audience", audience)
      .lte("available_from", now).or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("available_from", { ascending: false });
    if (quizzes.error) throw new ApiError("Não foi possível carregar os desafios.", 503);
    const ids = (quizzes.data ?? []).map(quiz => quiz.id);
    if (!ids.length) return Response.json({ quizzes: [] }, { headers });
    const questions = await db.from("academy_quiz_questions")
      .select("id,quiz_id,order_index,prompt,image_url,image_alt,options")
      .in("quiz_id", ids).order("order_index");
    if (questions.error) throw new ApiError("Não foi possível carregar as perguntas.", 503);
    return Response.json({ quizzes: (quizzes.data ?? []).map(quiz => ({
      ...quiz,
      questions: (questions.data ?? []).filter(question => question.quiz_id === quiz.id),
    })) }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof ApiError ? error.message : "Não foi possível carregar os desafios." },
      { status: error instanceof ApiError ? error.status : 500, headers });
  }
}
