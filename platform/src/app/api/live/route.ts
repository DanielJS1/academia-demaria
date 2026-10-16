import { liveContext, listLive, readHighlights, resolveHighlights, liveFailure, liveResponse } from "@/lib/live-server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db, me } = await liveContext(request);
    const [events, config] = await Promise.all([listLive(db, me), readHighlights(db)]);
    return liveResponse({ events, highlights: await resolveHighlights(db, me, events, config.items) });
  } catch (error) { return liveFailure(error); }
}
