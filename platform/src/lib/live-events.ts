import { z } from "zod";
import { youtubeEmbed } from "./model";

export const liveStatuses = ["draft", "scheduled", "live", "processing", "recorded", "cancelled"] as const;
export const liveStatusLabels: Record<LiveStatus, string> = {
  draft: "Rascunho", scheduled: "Agendada", live: "Ao vivo", processing: "Preparando gravação", recorded: "Gravação disponível", cancelled: "Cancelada",
};
export type LiveStatus = typeof liveStatuses[number];
const youtubeUrl = z.string().trim().max(500).refine(value => !!youtubeEmbed(value), "Cole um link válido de vídeo ou transmissão do YouTube.");
export const liveEventInputSchema = z.object({
  id: z.string().uuid().optional(), version: z.number().int().min(0).default(0),
  title: z.string().trim().min(3, "Informe um título com pelo menos 3 caracteres.").max(120),
  description: z.string().trim().max(3000).default(""),
  host: z.string().trim().min(2, "Informe quem vai conduzir a aula.").max(100),
  youtubeUrl, recordingUrl: z.union([youtubeUrl, z.literal("")]).default(""),
  scheduledAt: z.string().datetime({ offset: true }), status: z.enum(liveStatuses).default("draft"),
  audience: z.enum(["internal", "client", "both"]).default("both"),
  chatEnabled: z.boolean().default(true),
});
export const liveEventSchema = liveEventInputSchema.extend({
  id: z.string().uuid(), version: z.number().int().positive(),
  startedAt: z.string().nullable().default(null), endedAt: z.string().nullable().default(null),
});
export type LiveEvent = z.infer<typeof liveEventSchema>;
export type LiveEventInput = z.infer<typeof liveEventInputSchema>;
const transitions: Record<LiveStatus, readonly LiveStatus[]> = {
  draft: ["draft", "scheduled", "cancelled"],
  scheduled: ["scheduled", "draft", "live", "cancelled"],
  live: ["live", "processing"],
  processing: ["processing", "live", "recorded"],
  recorded: ["recorded", "processing"],
  cancelled: ["cancelled", "draft", "scheduled"],
};
export function canTransitionLive(from: LiveStatus, to: LiveStatus) { return transitions[from].includes(to); }
export function liveHref(id: string) { return `/aprender/ao-vivo/${encodeURIComponent(id)}`; }
export function livePlaybackUrl(event: LiveEvent) { return event.status === "recorded" ? event.recordingUrl || event.youtubeUrl : event.youtubeUrl; }
export function liveDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
export const highlightKinds = ["course", "lesson", "quiz", "article", "live", "announcement"] as const;
export const highlightSchema = z.object({
  id: z.string().uuid(), kind: z.enum(highlightKinds), targetId: z.string().max(150).default(""),
  lessonId: z.string().max(150).default(""), title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(400).default(""), href: z.string().max(500).default(""),
  audience: z.enum(["internal", "client", "both"]).default("both"),
  startsAt: z.string().datetime({ offset: true }).nullable().default(null),
  endsAt: z.string().datetime({ offset: true }).nullable().default(null),
}).superRefine((item, context) => {
  if (item.kind !== "announcement" && !item.targetId) context.addIssue({ code: "custom", message: "Selecione um conteúdo.", path: ["targetId"] });
  if (item.kind === "lesson" && !item.lessonId) context.addIssue({ code: "custom", message: "Selecione uma aula.", path: ["lessonId"] });
  if (item.kind === "announcement" && !isAcademyHref(item.href)) context.addIssue({ code: "custom", message: "Use um caminho da Academia, como /aprender.", path: ["href"] });
  if (item.startsAt && item.endsAt && Date.parse(item.endsAt) <= Date.parse(item.startsAt)) context.addIssue({ code: "custom", message: "O fim deve ser posterior ao início.", path: ["endsAt"] });
});
export function isAcademyHref(value: string) {
  return /^(\/(?:aprender|desafios|conhecimento|conquistas|sobre)(?:[/?#][^\\\s]*)?|\/)$/u.test(value) && !/%(?:0[ad]|5c)/i.test(value);
}
export const highlightsInputSchema = z.object({ version: z.number().int().min(0), items: z.array(highlightSchema).max(8, "O hero comporta até 8 destaques.").refine(items => new Set(items.map(item => item.id)).size === items.length, "Há destaques duplicados.") });
export type Highlight = z.infer<typeof highlightSchema>;
export type ResolvedHighlight = Highlight & { href: string };
export type LiveSummary = { events: LiveEvent[]; highlights: ResolvedHighlight[] };
export const liveSummarySchema = z.object({ events: z.array(liveEventSchema), highlights: z.array(highlightSchema) });
export const liveMessageSchema = z.object({
  id: z.string().uuid(), event_id: z.string().uuid(), seq: z.number(), author_id: z.string().uuid(),
  author_name: z.string(), author_role: z.string(), content: z.string(), created_at: z.string(),
  removed: z.boolean(), pinned: z.boolean(),
});
export type LiveMessage = z.infer<typeof liveMessageSchema>;
export const chatInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), id: z.string().uuid(), content: z.string().trim().min(1, "Escreva uma mensagem.").max(1000, "Use até 1.000 caracteres.") }),
  z.object({ action: z.literal("pin"), id: z.string().uuid(), pinned: z.boolean() }),
  z.object({ action: z.literal("remove"), id: z.string().uuid() }),
]);
