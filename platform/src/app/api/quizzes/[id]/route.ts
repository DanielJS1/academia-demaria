import { z } from "zod";
import { ApiError, authenticate } from "@/lib/pilot-server";
import { periodicQuizDetailSchema } from "@/lib/periodic-quizzes";
import { quizAdminDatabaseError, quizAdminFailure } from "@/lib/quiz-admin-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw new ApiError("Desafio inválido.");
    const { db, me } = await authenticate(request);
    const result = await db.rpc("academy_read_periodic_quiz", { actor: me.id, quiz: id });
    if (result.error) throw quizAdminDatabaseError(result.error, "detail");
    return Response.json(periodicQuizDetailSchema.parse(result.data), { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) { return quizAdminFailure(error); }
}
