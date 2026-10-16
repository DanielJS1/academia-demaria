import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import { z } from "zod";

export const snowflake = z.string().regex(/^\d{17,20}$/);
export const discordCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("code") }).strict(),
  z.object({ type: z.literal("unlink") }).strict(),
  z.object({ type: z.literal("preference"), enabled: z.boolean() }).strict(),
  z.object({ type: z.literal("test") }).strict(),
]);
export type DiscordLink = { discordId: string; username: string; enabled: boolean; linkedAt: string };
export type DiscordStatus = { configured: boolean; oauthConfigured?: boolean; link: DiscordLink | null; team: { userId: string; linked: boolean; enabled: boolean }[] };
export function discordConfigured() {
  return !!process.env.DISCORD_BOT_TOKEN && snowflake.safeParse(process.env.DISCORD_APPLICATION_ID).success
    && snowflake.safeParse(process.env.DISCORD_GUILD_ID).success && /^[a-f0-9]{64}$/i.test(process.env.DISCORD_PUBLIC_KEY ?? "")
    && !!process.env.CRON_SECRET && /^https:\/\//.test(process.env.NEXT_PUBLIC_SITE_URL ?? "");
}
export const codeHash = (code: string) => createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
export const newLinkCode = () => randomBytes(16).toString("hex").toUpperCase();
export function validDiscordSignature(request: Request, body: string, now = Date.now()) {
  const key = process.env.DISCORD_PUBLIC_KEY ?? "", signature = request.headers.get("x-signature-ed25519") ?? "", timestamp = request.headers.get("x-signature-timestamp") ?? "";
  if (!/^[a-f0-9]{64}$/i.test(key) || !/^[a-f0-9]{128}$/i.test(signature) || !/^\d{10}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  try {
    const publicKey = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(key, "hex")]), format: "der", type: "spki" });
    return verify(null, Buffer.from(timestamp + body), publicKey, Buffer.from(signature, "hex"));
  } catch { return false; }
}
export function academyUrl(path: string) {
  const base = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  if (base.protocol !== "https:" || !path.startsWith("/") || path.startsWith("//")) throw new Error("Endereço da Academia inválido.");
  const result = new URL(path, base); if (result.origin !== base.origin) throw new Error("Endereço inválido."); return result.href;
}
// No automatic retry after an ambiguous POST: Discord's nonce deduplication lasts only a few minutes.
export class DiscordError extends Error {
  constructor(public status: number, public code: number, public retryAfter = 0) {
    super(code === 50007 ? "Mensagens privadas bloqueadas. Permita DMs do bot no Discord." : status === 429 ? "Limite de envio do Discord; aguardando nova execução." : status === 404 ? "Conta ou servidor indisponível no Discord." : status === 401 ? "Token do bot inválido; confira a configuração." : "O Discord recusou a solicitação.");
  }
}
export async function discordRequest(path: string, method = "GET", body?: unknown) {
  const token = process.env.DISCORD_BOT_TOKEN; if (!token) throw new Error("Bot ainda não configurado.");
  const response = await fetch(`https://discord.com/api/v10${path}`, { method, headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(8000), cache: "no-store" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new DiscordError(response.status, Number(result.code ?? 0), Number(result.retry_after ?? 0));
  return result;
}
export async function guildMember(discordId: string) {
  snowflake.parse(discordId);
  const member = await discordRequest(`/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordId}`);
  if (member.user?.bot || member.pending) throw new Error("Conclua a entrada no servidor com sua conta pessoal.");
  return member;
}
export function noticeMessage(notice: { id: string; title: string; message: string; link: string }) {
  return {
    content: "Academia DeMaria — seu aprendizado", allowed_mentions: { parse: [] },
    embeds: [{ title: notice.title.slice(0, 120), description: notice.message.slice(0, 2000), color: 6835455 }],
    components: [{ type: 1, components: [
      { type: 2, style: 5, label: "Abrir na Academia", url: academyUrl(notice.link) },
      { type: 2, style: 1, label: "Minhas trilhas", custom_id: "academy:trilhas" },
      { type: 2, style: 2, label: "Confirmar aviso", custom_id: `academy:ack:${notice.id}` },
    ] }],
    nonce: createHash("sha256").update(notice.id).digest("hex").slice(0, 24), enforce_nonce: true,
  };
}
export async function sendDiscordNotice(discordId: string, notice: Parameters<typeof noticeMessage>[0]) {
  await guildMember(discordId);
  const channel = await discordRequest("/users/@me/channels", "POST", { recipient_id: discordId });
  return discordRequest(`/channels/${channel.id}/messages`, "POST", noticeMessage(notice));
}
