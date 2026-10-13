import { ApiError, database } from "@/lib/pilot-server";
import { evaluateAlerts, trailContext, validCronToken } from "@/lib/trails-server";
import { dispatchDiscord } from "@/lib/discord-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!validCronToken(request)) return Response.json({ error: "Acesso não autorizado." }, { status: 401 });
  try {
    const db = database(), context = await trailContext(db);
    const created = await evaluateAlerts(db, context, context.profiles.filter(p => p.status === "active" && p.audience !== "client"));
    const discord = await dispatchDiscord(db, context);
    return Response.json({ created, discord, emailPaused: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return Response.json({ error: e instanceof ApiError ? e.message : "Falha ao processar lembretes." }, { status: e instanceof ApiError ? e.status : 500 }); }
}
// Vercel Cron invokes GET with Authorization: Bearer CRON_SECRET.
export const GET = POST;
