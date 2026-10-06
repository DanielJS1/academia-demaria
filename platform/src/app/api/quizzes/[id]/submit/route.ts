import { z } from "zod";
import { ApiError, authenticate } from "@/lib/pilot-server";
import { periodicQuizSubmissionSchema as submissionSchema, periodicQuizResultSchema } from "@/lib/periodic-quizzes";
import { quizAdminDatabaseError, quizAdminFailure } from "@/lib/quiz-admin-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw new ApiError("Desafio inválido.", 400);
    if (Number(request.headers.get("content-length") ?? 0) > 16000) throw new ApiError("Solicitação muito grande.", 413);
    const { db, me } = await authenticate(request);
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 16000) throw new ApiError("Solicitação muito grande.", 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new ApiError("Respostas inválidas."); }
    const parsed = submissionSchema.safeParse(body);
    if (!parsed.success) throw new ApiError("Respostas inválidas.");
    const result = await db.rpc("academy_submit_periodic_quiz", {
      actor: me.id, quiz: id, submitted_answers: parsed.data.answers,
      expected_revision: parsed.data.expectedRevision ?? null,
    });
    if (result.error) throw quizAdminDatabaseError(result.error, "submit");
    return Response.json(periodicQuizResultSchema.parse(result.data), { headers });
  } catch (error) {
    return quizAdminFailure(error);
  }
}
