import { after } from "next/server";
import { database, ApiError } from "@/lib/pilot-server";
import { validDiscordSignature } from "@/lib/discord";
import { interactionEnvelope, answerInteraction } from "@/lib/discord-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 32000) return new Response(null, { status: 413 });
  const raw = await request.text(); if (raw.length > 32000) return new Response(null, { status: 413 });
  if (!validDiscordSignature(request, raw)) return new Response(null, { status: 401 });
  let payload; try { payload = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }
  if (payload.application_id !== process.env.DISCORD_APPLICATION_ID) return new Response(null, { status: 401 });
  if (payload.type === 1) return Response.json({ type: 1 });
  let interaction; try { interaction = interactionEnvelope(payload); } catch (e) { return Response.json({ type: 4, data: { content: e instanceof ApiError ? e.message : "Interação inválida.", flags: 64 } }); }
  const token = payload.token;
  if (typeof token !== "string" || !/^[\w.-]{1,256}$/.test(token)) return new Response(null, { status: 400 });
  after(async () => {
    let data;
    try { data = await answerInteraction(database(), interaction); }
    catch (e) { data = { content: e instanceof ApiError ? e.message : "Não foi possível concluir. Confira sua conexão na Academia e tente novamente.", allowed_mentions: { parse: [] } }; }
    // Interaction token is used only with Discord; never recorded in logs or sent to the browser.
    try { await fetch(`https://discord.com/api/v10/webhooks/${payload.application_id}/${token}/messages/@original`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal: AbortSignal.timeout(8000) }); }
    catch { /* User can repeat read-only queries; mutating commands are atomic/idempotent. */ }
  });
  return Response.json({ type: 5, data: { flags: 64 } });
}
