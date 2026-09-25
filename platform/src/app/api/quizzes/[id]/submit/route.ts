import { z } from "zod";
import { ApiError, authenticate } from "@/lib/pilot-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
const submissionSchema = z.object({ answers: z.record(z.uuid(), z.string().min(1).max(40)) }).strict();

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
    });
    if (result.error) {
      if (result.error.message.includes("Desafio indisponível")) throw new ApiError("Desafio indisponível.", 404);
      if (result.error.message.includes("Respostas")) throw new ApiError("Respostas incompletas ou inválidas.", 400);
      throw new ApiError("Não foi possível registrar a tentativa.", 503);
    }
    if (result.data?.alreadySubmitted) throw new ApiError("Você já respondeu a este desafio.", 409);
    return Response.json(result.data, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof ApiError ? error.message : "Não foi possível registrar a tentativa." },
      { status: error instanceof ApiError ? error.status : 500, headers });
  }
}
