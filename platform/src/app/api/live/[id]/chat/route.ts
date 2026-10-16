import { z } from "zod";
import { liveContext, changeLiveMessage, liveFailure, liveResponse } from "@/lib/live-server";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, me } = await liveContext(request);
    const id = z.string().uuid().parse((await context.params).id);
    return liveResponse({ message: await changeLiveMessage(db, me, id, await request.json()) });
  } catch (error) { return liveFailure(error); }
}
