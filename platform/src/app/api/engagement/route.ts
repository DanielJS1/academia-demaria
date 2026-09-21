import { z } from "zod";
import { ApiError, authenticate } from "@/lib/pilot-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
const heartbeatSchema = z.object({ sessionId: z.uuid(), active: z.boolean() }).strict();

function failure(error: unknown) {
  return Response.json({ error: error instanceof ApiError ? error.message : "Não foi possível consultar a presença." }, {
    status: error instanceof ApiError ? error.status : 500, headers,
  });
}

export async function GET(request: Request) {
  try {
    const { db, me } = await authenticate(request);
    if (me.audience === "client" || !["admin", "manager"].includes(me.role)) {
      throw new ApiError("Somente a gestão pode consultar a presença da equipe.", 403);
    }
    const days = new URL(request.url).searchParams.get("days") ?? "7";
    if (days !== "7" && days !== "30") throw new ApiError("Selecione 7 ou 30 dias.");
    const result = await db.rpc("academy_read_engagement", { actor: me.id, window_days: Number(days) });
    if (result.error) throw new ApiError("Dados de presença indisponíveis. Confira a migração de acompanhamento ou tente novamente.", 503);
    return Response.json(result.data, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 512) throw new ApiError("Solicitação muito grande.", 413);
    const { db, me } = await authenticate(request);
    if (me.audience === "client") throw new ApiError("Acompanhamento disponível apenas para colaboradores internos.", 403);
    const raw = await request.text();
    if (raw.length > 512) throw new ApiError("Solicitação muito grande.", 413);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { throw new ApiError("Solicitação inválida."); }
    const parsed = heartbeatSchema.safeParse(input);
    if (!parsed.success) throw new ApiError("Solicitação inválida.");
    const result = await db.rpc("academy_record_presence", {
      actor: me.id, session_id: parsed.data.sessionId, is_active: parsed.data.active,
    });
    if (result.error) throw new ApiError("Não foi possível registrar a presença.", 503);
    return Response.json({ recorded: true }, { headers });
  } catch (error) { return failure(error); }
}
