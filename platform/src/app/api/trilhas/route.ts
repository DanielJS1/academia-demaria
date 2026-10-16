import { authenticate, ApiError } from "@/lib/pilot-server";
import { mutateTrails, readTrails } from "@/lib/trails-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
function failure(error: unknown) { return Response.json({ error: error instanceof ApiError ? error.message : "Não foi possível consultar as trilhas." }, { status: error instanceof ApiError ? error.status : 500, headers }); }
export async function GET(request: Request) {
  try { const { db, me } = await authenticate(request); return Response.json(await readTrails(db, me), { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 32000) throw new ApiError("Solicitação muito grande.", 413);
    const { db, me } = await authenticate(request);
    const raw = await request.text(); if (raw.length > 32000) throw new ApiError("Solicitação muito grande.", 413);
    let input: unknown; try { input = JSON.parse(raw); } catch { throw new ApiError("Solicitação inválida."); }
    await mutateTrails(db, me, input); return Response.json({ saved: true }, { headers });
  } catch (error) { return failure(error); }
}
