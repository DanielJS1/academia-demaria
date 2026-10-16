import { authenticate, ApiError } from "@/lib/pilot-server";
import { mutateDiscord, readDiscordStatus } from "@/lib/discord-server";
import { DiscordError } from "@/lib/discord";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
const failure = (e: unknown) => Response.json({ error: e instanceof ApiError || e instanceof DiscordError ? e.message : "Discord indisponível. Tente novamente." }, { status: e instanceof ApiError ? e.status : e instanceof DiscordError ? 502 : 500, headers });
export async function GET(request: Request) {
  try { const { db, me } = await authenticate(request); return Response.json(await readDiscordStatus(db, me), { headers }); }
  catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  try {
    const { db, me } = await authenticate(request); const raw = await request.text(); if (raw.length > 1000) throw new ApiError("Solicitação muito grande.", 413);
    let input; try { input = JSON.parse(raw); } catch { throw new ApiError("Comando inválido."); }
    return Response.json(await mutateDiscord(db, me, input), { headers });
  } catch (e) { return failure(e); }
}
