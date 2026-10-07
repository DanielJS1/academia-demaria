import { authenticate } from "@/lib/pilot-server";
import { periodicQuizListSchema } from "@/lib/periodic-quizzes";
import { quizAdminDatabaseError, quizAdminFailure } from "@/lib/quiz-admin-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    const result = await db.rpc("academy_list_periodic_quizzes", { actor: me.id });
    if (result.error) throw quizAdminDatabaseError(result.error, "summary");
    return Response.json(periodicQuizListSchema.parse(result.data), { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) { return quizAdminFailure(error); }
}
