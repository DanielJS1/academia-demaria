import { parseDocument } from "htmlparser2";
import { getElementsByTagName, textContent } from "domutils";
import fallback from "./channel-videos.json";

export type ChannelVideo = { id: string; title: string; publishedAt: string };
export const DEMARIA_CHANNEL = "https://www.youtube.com/@demariasoftware/videos";
const FEED = "https://www.youtube.com/feeds/videos.xml?channel_id=UCgB9zZ9r0PS837J34s6_jnQ";

export function parseChannelFeed(xml: string): ChannelVideo[] {
  const document = parseDocument(xml, { xmlMode: true, decodeEntities: true });
  const seen = new Set<string>();
  return getElementsByTagName("entry", document.children, true).flatMap(entry => {
    const field = (name: string) => textContent(getElementsByTagName(name, entry.children, true)[0] || []).trim();
    const id = field("yt:videoId"), title = field("title"), publishedAt = field("published");
    if (!/^[\w-]{11}$/.test(id) || !title || !Number.isFinite(Date.parse(publishedAt)) || seen.has(id)) return [];
    seen.add(id);
    return [{ id, title: title.slice(0, 300), publishedAt }];
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 15);
}

export async function channelVideos(): Promise<{ videos: ChannelVideo[]; cached: boolean }> {
  try {
    const response = await fetch(FEED, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Feed unavailable");
    const xml = await response.text();
    if (xml.length > 500_000) throw new Error("Feed too large");
    const videos = parseChannelFeed(xml);
    if (!videos.length) throw new Error("Empty feed");
    return { videos, cached: false };
  } catch {
    return { videos: fallback, cached: true };
  }
}
