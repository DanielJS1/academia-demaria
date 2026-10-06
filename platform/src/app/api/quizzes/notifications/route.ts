import { authenticate } from "@/lib/pilot-server";
import { quizAdminFailure } from "@/lib/quiz-admin-errors";
import { readQuizNotifications } from "@/lib/quiz-notifications-server";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    return Response.json(await readQuizNotifications(db, me), { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) { return quizAdminFailure(error); }
}
