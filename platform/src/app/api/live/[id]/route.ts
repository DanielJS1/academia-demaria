import { z } from "zod";
import { liveContext, requireLive, readLiveMessages, liveFailure, liveResponse, ensureLive } from "@/lib/live-server";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, me } = await liveContext(request);
    const id = z.string().uuid().parse((await context.params).id);
    const event = await requireLive(db, me, id);
    const cursor = new URL(request.url).searchParams.get("before");
    const before = cursor ? z.coerce.number().int().positive().safe().parse(cursor) : undefined;
    const [history, pinned] = await Promise.all([
      readLiveMessages(db, id, before),
      db.from("academy_live_messages").select("*").eq("event_id", id).eq("pinned", true).eq("removed", false).limit(1).maybeSingle(),
    ]);
    ensureLive(pinned);
    return liveResponse({ event, ...history, pinned: pinned.data });
  } catch (error) { return liveFailure(error); }
}
