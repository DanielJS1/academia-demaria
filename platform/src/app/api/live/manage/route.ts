import { liveContext, listLive, saveLive, liveFailure, liveResponse } from "@/lib/live-server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { const { db, me } = await liveContext(request, true); return liveResponse({ events: await listLive(db, me, true) }); }
  catch (error) { return liveFailure(error); }
}
export async function POST(request: Request) {
  try { const { db, me } = await liveContext(request, true); return liveResponse({ event: await saveLive(db, me, await request.json()) }); }
  catch (error) { return liveFailure(error); }
}
