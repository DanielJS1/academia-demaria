import { highlightsInputSchema } from "@/lib/live-events";
import { liveContext, readHighlights, ensureLive, liveFailure, liveResponse } from "@/lib/live-server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { const { db } = await liveContext(request, true); return liveResponse(await readHighlights(db)); }
  catch (error) { return liveFailure(error); }
}
export async function PUT(request: Request) {
  try {
    const { db, me } = await liveContext(request, true);
    const input = highlightsInputSchema.parse(await request.json());
    const result = await db.rpc("academy_save_home_highlights", { actor: me.id, payload: input }); ensureLive(result);
    return liveResponse(highlightsInputSchema.parse(result.data));
  } catch (error) { return liveFailure(error); }
}
