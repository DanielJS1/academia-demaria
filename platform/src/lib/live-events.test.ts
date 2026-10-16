import { describe, expect, it } from "vitest";
import { canTransitionLive, highlightsInputSchema, isAcademyHref, liveEventInputSchema, livePlaybackUrl, type LiveEvent } from "./live-events";
const base = { title: "Aula de teste", host: "Equipe", youtubeUrl: "https://www.youtube.com/live/abcdefghijk", scheduledAt: "2026-10-08T14:00:00-03:00" };
describe("contratos de aulas ao vivo", () => {
  it("aceita os formatos de vídeo do YouTube e rejeita URLs externas ou chaves do OBS", () => {
    for (const youtubeUrl of ["https://youtu.be/abcdefghijk", "https://www.youtube.com/watch?v=abcdefghijk", base.youtubeUrl]) expect(liveEventInputSchema.safeParse({ ...base, youtubeUrl }).success).toBe(true);
    for (const youtubeUrl of ["https://youtube.com.evil.test/watch?v=abcdefghijk", "https://example.test/video", "rtmp://youtube.com/key"]) expect(liveEventInputSchema.safeParse({ ...base, youtubeUrl }).success).toBe(false);
  });
  it("exige o fluxo de convite, transmissão e gravação", () => {
    expect(canTransitionLive("draft", "live")).toBe(false);
    expect(canTransitionLive("scheduled", "recorded")).toBe(false);
    expect(canTransitionLive("scheduled", "live")).toBe(true);
    expect(canTransitionLive("live", "processing")).toBe(true);
    expect(canTransitionLive("processing", "recorded")).toBe(true);
    expect(canTransitionLive("recorded", "live")).toBe(false);
  });
  it("mantém o mesmo vídeo no replay e permite uma versão editada", () => {
    const event = { ...base, status: "recorded", recordingUrl: "" } as LiveEvent;
    expect(livePlaybackUrl(event)).toBe(base.youtubeUrl);
    expect(livePlaybackUrl({ ...event, recordingUrl: "https://youtu.be/12345678901" })).toBe("https://youtu.be/12345678901");
  });
});
describe("contrato da vitrine", () => {
  const item = { id: "11111111-1111-4111-8111-111111111111", kind: "announcement", title: "Novidades", href: "/aprender" };
  it("limita oito destaques, sem IDs repetidos", () => {
    expect(highlightsInputSchema.safeParse({ version: 0, items: Array.from({ length: 8 }, (_, i) => ({ ...item, id: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}` })) }).success).toBe(true);
    expect(highlightsInputSchema.safeParse({ version: 0, items: Array(9).fill(item) }).success).toBe(false);
    expect(highlightsInputSchema.safeParse({ version: 0, items: [item, item] }).success).toBe(false);
  });
  it("rejeita destinos externos, scripts e datas invertidas", () => {
    for (const href of ["//example.test", "javascript:alert(1)", "/\\example.test", "https://example.test", "/admin", "/aprender%5cfoo"]) expect(isAcademyHref(href)).toBe(false);
    expect(isAcademyHref("/aprender/curso/aula?aula=primeira")).toBe(true);
    expect(highlightsInputSchema.safeParse({ version: 0, items: [{ ...item, startsAt: "2026-10-09T12:00:00Z", endsAt: "2026-10-08T12:00:00Z" }] }).success).toBe(false);
  });
});
