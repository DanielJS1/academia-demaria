import { ApiError } from "@/lib/pilot-server";
import { validCronToken } from "@/lib/trails-server";
import { setupDiscord } from "@/lib/discord-server";
import { DiscordError } from "@/lib/discord";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!validCronToken(request)) return new Response(null, { status: 401 });
  try { return Response.json(await setupDiscord(), { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { return Response.json({ error: e instanceof ApiError || e instanceof DiscordError ? e.message : "Não foi possível configurar o bot." }, { status: e instanceof ApiError ? e.status : 502 }); }
}
