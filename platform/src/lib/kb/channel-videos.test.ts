import { afterEach, describe, expect, it, vi } from "vitest";
import { channelVideos, parseChannelFeed } from "./channel-videos";

const entry = (id: string, title: string, date: string) => `<entry><yt:videoId>${id}</yt:videoId><title>${title}</title><published>${date}</published></entry>`;
const xml = `<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">${entry("y6iPD1Ff_m8", "Entrevista &amp; orientações", "2025-10-21T19:01:00Z")}${entry("1RwLAKvUd9g", "DOC-Bot.IA", "2025-11-19T12:17:53Z")}</feed>`;
afterEach(() => vi.unstubAllGlobals());

describe("public DeMaria channel feed", () => {
  it("selects the most recently published video and decodes XML titles", () => {
    expect(parseChannelFeed(xml).map(video => video.id)).toEqual(["1RwLAKvUd9g", "y6iPD1Ff_m8"]);
    expect(parseChannelFeed(xml)[1].title).toBe("Entrevista & orientações");
  });
  it("rejects unsafe embed IDs, invalid publication dates and duplicate entries", () => {
    const parsed = parseChannelFeed(`<feed>${entry("https://evil.example", "Unsafe", "2025-01-01")}${entry("1RwLAKvUd9g", "Valid", "2025-01-01")}${entry("1RwLAKvUd9g", "Duplicate", "2025-01-01")}${entry("y6iPD1Ff_m8", "Bad date", "unknown")}</feed>`);
    expect(parsed).toEqual([{ id: "1RwLAKvUd9g", title: "Valid", publishedAt: "2025-01-01" }]);
  });
  it("refreshes from the fixed official channel feed with an hourly cache", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(xml)); vi.stubGlobal("fetch", fetcher);
    const result = await channelVideos();
    expect(result.cached).toBe(false); expect(result.videos[0].title).toBe("DOC-Bot.IA");
    expect(fetcher).toHaveBeenCalledWith("https://www.youtube.com/feeds/videos.xml?channel_id=UCgB9zZ9r0PS837J34s6_jnQ", expect.objectContaining({ next: { revalidate: 3600 }, signal: expect.any(AbortSignal) }));
  });
  it.each([new Response("unavailable", { status: 503 }), new Response("<feed/>")])("keeps a usable known list when the channel cannot be refreshed", async response => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response)); const result = await channelVideos();
    expect(result.cached).toBe(true); expect(result.videos.length).toBeGreaterThan(0);
    expect(result.videos.every(video => /^[\w-]{11}$/.test(video.id))).toBe(true);
  });
});
