import { randomUUID } from "node:crypto";
import { ApiError, type Profile, type database } from "./pilot-server";
import { alertCandidates, manages, trailContext, type TrailContext } from "./trails-server";
import { daysUntil, formatTrailDate, localDay } from "./trails";
import { academyUrl, codeHash, discordCommandSchema, discordConfigured, DiscordError, discordRequest, guildMember, newLinkCode, sendDiscordNotice, snowflake, type DiscordStatus } from "./discord";

type DB = ReturnType<typeof database>;
const internal = (p: Profile) => p.status === "active" && p.audience !== "client";
const check = (p: Profile) => { if (!internal(p)) throw new ApiError("Disponível para colaboradores internos ativos.", 403); };
async function rpc(db: DB, actor: string | null, command: unknown) {
  const { error } = await db.rpc("academy_discord_mutate", { actor, command });
  if (error) throw new ApiError(error.message, error.code === "42501" ? 403 : 409);
}
export async function readDiscordStatus(db: DB, me: Profile): Promise<DiscordStatus> {
  check(me);
  const { data: own, error } = await db.from("academy_discord_links").select("discord_id,username,enabled,linked_at").eq("user_id", me.id).maybeSingle();
  if (error) throw new ApiError("Conexão do Discord indisponível.", 503);
  const team: DiscordStatus["team"] = [];
  if (me.role !== "student") {
    const context = await trailContext(db), ids = context.profiles.filter(p => manages(me, p)).map(p => p.id);
    if (ids.length) {
      const links = await db.from("academy_discord_links").select("user_id,enabled").in("user_id", ids);
      if (links.error) throw new ApiError("Equipe do Discord indisponível.", 503);
      for (const id of ids) { const l = links.data?.find(l => l.user_id === id); team.push({ userId: id, linked: !!l, enabled: l?.enabled ?? false }); }
    }
  }
  return { configured: discordConfigured(), oauthConfigured: discordConfigured() && !!process.env.DISCORD_CLIENT_SECRET, link: own ? { discordId: own.discord_id, username: own.username, enabled: own.enabled, linkedAt: own.linked_at } : null, team };
}
export async function mutateDiscord(db: DB, me: Profile, input: unknown) {
  check(me); const parsed = discordCommandSchema.safeParse(input); if (!parsed.success) throw new ApiError("Comando inválido.");
  const command = parsed.data;
  if (command.type === "code") {
    if (!discordConfigured()) throw new ApiError("O bot ainda está em configuração.", 503);
    const code = newLinkCode(); await rpc(db, me.id, { type: "code", hash: codeHash(code) });
    return { code, expiresAt: new Date(Date.now() + 600000).toISOString() };
  }
  if (command.type === "test") {
    const link = await db.from("academy_discord_links").select("discord_id,guild_id").eq("user_id", me.id).maybeSingle();
    if (!link.data || link.data.guild_id !== process.env.DISCORD_GUILD_ID) throw new ApiError("Vincule sua conta primeiro.");
    await rpc(db, me.id, { type: "test" });
    // Test is an explicit request from the authenticated recipient; never targets other employees.
    const notice = { id: randomUUID(), title: "Conexão com a Academia confirmada", message: "Seus lembretes de trilhas poderão chegar por aqui quando a gestão habilitar esse canal. Consulte suas trilhas abaixo.", link: "/aprender/trilhas" };
    await guildMember(link.data.discord_id);
    const channel = await discordRequest("/users/@me/channels", "POST", { recipient_id: link.data.discord_id });
    await discordRequest(`/channels/${channel.id}/messages`, "POST", { content: notice.message, allowed_mentions: { parse: [] }, components: [{ type: 1, components: [{ type: 2, style: 5, label: "Abrir minhas trilhas", url: academyUrl(notice.link) }, { type: 2, style: 1, label: "Consultar trilhas", custom_id: "academy:trilhas" }] }] });
    return { saved: true };
  }
  await rpc(db, me.id, command);
  if (command.type === "preference" && command.enabled) await db.from("academy_learning_notices").update({ discord_status: "pending", discord_error: null, discord_attempts: 0 }).eq("user_id", me.id).eq("discord_status", "blocked").is("resolved_at", null);
  return { saved: true };
}
type Interaction = { application_id: string; guild_id?: string; type: number; user?: { id: string; username: string; bot?: boolean }; member?: { user: { id: string; username: string; bot?: boolean } }; data?: { name?: string; custom_id?: string; options?: { name: string; options?: { name: string; value: string }[] }[] } };
export function interactionEnvelope(input: unknown): Interaction {
  const i = input as Interaction;
  if (!i || i.application_id !== process.env.DISCORD_APPLICATION_ID || ![2, 3].includes(i.type)) throw new ApiError("Interação inválida.", 400);
  if (i.guild_id && i.guild_id !== process.env.DISCORD_GUILD_ID) throw new ApiError("Use o servidor da DeMaria.", 403);
  const user = i.member?.user ?? i.user;
  if (!snowflake.safeParse(user?.id).success || user?.bot) throw new ApiError("Conta inválida.", 403);
  return i;
}
const noMentions = (content: string, components?: unknown[]) => ({ content: content.slice(0, 1900), allowed_mentions: { parse: [] }, ...(components ? { components } : {}) });
export async function answerInteraction(db: DB, i: Interaction) {
  const user = (i.member?.user ?? i.user)!;
  const action = i.type === 3 ? i.data?.custom_id?.split(":")[1] : i.data?.name === "academia" ? i.data.options?.[0]?.name : undefined;
  if (action === "ajuda") return noMentions("Use /academia vincular para conectar sua conta; /academia trilhas e /academia prazos para consultar suas metas. Gestores podem usar /academia equipe. Gere seu código de vinculação dentro de Aprender → Minhas trilhas, na Academia.");
  await guildMember(user.id);
  if (action === "vincular") {
    const code = i.data?.options?.[0]?.options?.find(o => o.name === "codigo")?.value;
    if (typeof code !== "string" || !/^[a-f0-9]{32}$/i.test(code)) throw new ApiError("Gere o código em Minhas trilhas e copie o comando completo.");
    await rpc(db, null, { type: "consume", hash: codeHash(code), discordId: user.id, guildId: process.env.DISCORD_GUILD_ID, username: user.username });
    return noMentions("Sua conta foi vinculada à Academia DeMaria. Você pode consultar suas trilhas abaixo. Os lembretes dependem das preferências da gestão.", [{ type: 1, components: [{ type: 2, style: 1, label: "Minhas trilhas", custom_id: "academy:trilhas" }, { type: 2, style: 5, label: "Abrir Academia", url: academyUrl("/aprender/trilhas") }] }]);
  }
  const link = await db.from("academy_discord_links").select("user_id,guild_id").eq("discord_id", user.id).maybeSingle();
  if (link.error) throw new ApiError("Conexão indisponível.", 503);
  if (!link.data || link.data.guild_id !== process.env.DISCORD_GUILD_ID) return noMentions("Sua conta ainda não está vinculada. Entre na Academia → Aprender → Minhas trilhas, gere o código e use /academia vincular.");
  const context = await trailContext(db), me = context.profiles.find(p => p.id === link.data!.user_id);
  if (!me || !internal(me)) throw new ApiError("Seu acesso à Academia está inativo. Fale com a gestão.", 403);
  if (action === "ack") {
    const id = i.data?.custom_id?.split(":")[2]; if (!/^[a-f0-9-]{36}$/i.test(id ?? "")) throw new ApiError("Aviso inválido.");
    await rpc(db, me.id, { type: "ack", id }); return noMentions("Aviso confirmado. A conclusão dos cursos continua sendo registrada na Academia.");
  }
  if (!["trilhas", "prazos", "equipe"].includes(action ?? "")) return noMentions("Use /academia ajuda para consultar as opções.");
  if (action === "equipe" && me.role === "student") throw new ApiError("Consulta disponível apenas à gestão.", 403);
  const assignments = context.assignments.filter(a => a.active && (action === "equipe" ? context.profiles.some(p => p.id === a.userId && manages(me, p)) : a.userId === me.id)).filter(a => action === "trilhas" || !a.complete).sort((a, b) => Number(a.complete) - Number(b.complete) || a.dueDate.localeCompare(b.dueDate));
  const text = assignments.length ? assignments.slice(0, 8).map(a => `${action === "equipe" ? context.profiles.find(p => p.id === a.userId)?.name + " — " : ""}${a.title}: ${a.completedCourses}/${a.totalCourses} cursos · prazo ${formatTrailDate(a.dueDate)}${a.complete ? " · concluída" : daysUntil(a.dueDate) < 0 ? " · vencido" : ""}`).join("\n") : "Nenhuma trilha pendente encontrada para esta consulta.";
  return noMentions(`${action === "equipe" ? "Pendências da equipe" : action === "prazos" ? "Seus prazos" : "Suas trilhas"}\n${text}${assignments.length > 8 ? "\nVeja as demais na Academia." : ""}`, [{ type: 1, components: [{ type: 2, style: 5, label: "Abrir na Academia", url: academyUrl(action === "equipe" ? "/equipe/trilhas" : "/aprender/trilhas") }] }]);
}
export const academyDiscordCommand = { name: "academia", description: "Trilhas, prazos e avisos da Academia DeMaria", type: 1, contexts: [0, 1], integration_types: [0], options: [
  { type: 1, name: "vincular", description: "Vincule sua conta com o código gerado na Academia", options: [{ type: 3, name: "codigo", description: "Código temporário de Minhas trilhas", required: true, min_length: 32, max_length: 32 }] },
  ...[["trilhas", "Consulte suas trilhas e seu progresso"], ["prazos", "Consulte seus prazos pendentes"], ["equipe", "Gestores: consulte as pendências da equipe"], ["ajuda", "Veja como usar o bot"]].map(([name, description]) => ({ type: 1, name, description })),
] };
export async function setupDiscord() {
  if (!discordConfigured()) throw new ApiError("Confira as variáveis do Discord na Vercel.", 503);
  const app = await discordRequest("/applications/@me");
  if (app.id !== process.env.DISCORD_APPLICATION_ID || app.verify_key !== process.env.DISCORD_PUBLIC_KEY) throw new ApiError("O token, o ID e a chave pública não pertencem ao mesmo aplicativo.", 409);
  const endpoint = academyUrl("/api/discord/interacoes");
  await discordRequest("/applications/@me", "PATCH", { interactions_endpoint_url: endpoint });
  const command = await discordRequest(`/applications/${app.id}/commands`, "POST", academyDiscordCommand);
  let installed = false;
  try { await discordRequest(`/guilds/${process.env.DISCORD_GUILD_ID}`); installed = true; }
  catch (e) { if (!(e instanceof DiscordError) || ![403, 404].includes(e.status)) throw e; }
  return { configured: true, endpoint, commandId: command.id, installed, installUrl: `https://discord.com/oauth2/authorize?client_id=${app.id}&scope=bot%20applications.commands&permissions=0&guild_id=${process.env.DISCORD_GUILD_ID}&disable_guild_select=true` };
}
const priority: Record<string, number> = { overdue: 0, deadline: 1, assigned: 2, inactive: 3, "low-access": 4, resume: 5 };
export async function dispatchDiscord(db: DB, context: TrailContext, now = new Date()) {
  if (!discordConfigured()) return { configured: false, sent: 0, failed: 0 };
  const fetched = await db.from("academy_learning_notices").select("*").is("resolved_at", null).order("created_at", { ascending: false }).limit(1000);
  if (fetched.error) throw new ApiError("Fila do Discord indisponível.", 503);
  const links = await db.from("academy_discord_links").select("*");
  if (links.error) throw new ApiError("Contas do Discord indisponíveis.", 503);
  const candidates = context.profiles.filter(internal).flatMap(p => alertCandidates(context, p, now));
  const weekday = new Date(localDay(now) + "T12:00:00Z").getUTCDay(), notices = fetched.data ?? [];
  let sent = 0, failed = 0; const started = Date.now(), handled = new Set<string>();
  // Old leases cannot be safely retried after Discord's short nonce window.
  await db.from("academy_learning_notices").update({ discord_status: "uncertain", discord_error: "Execução anterior sem confirmação; revisar antes de reenviar." }).eq("discord_status", "sending").lt("discord_lease_at", new Date(now.getTime() - 15 * 60000).toISOString());
  const queue = notices.filter(n => !["sent", "sending", "uncertain", "blocked", "cancelled"].includes(n.discord_status)).sort((a, b) => (priority[a.kind] ?? 9) - (priority[b.kind] ?? 9) || b.created_at.localeCompare(a.created_at));
  for (const n of queue) {
    if (Date.now() - started > 35000 || sent + failed >= 20) break;
    const c = candidates.find(c => c.userId === n.user_id && c.subjectId === n.subject_id && n.dedupe_key.startsWith(c.key + ":"));
    if (!c?.discord) {
      if (n.discord_status !== "disabled") await db.from("academy_learning_notices").update({ discord_status: "cancelled" }).eq("id", n.id).eq("discord_status", n.discord_status);
      continue;
    }
    const newer = notices.some(other => other.id !== n.id && other.dedupe_key.startsWith(c.key + ":") && other.created_at > n.created_at);
    if (newer) { await db.from("academy_learning_notices").update({ discord_status: "cancelled" }).eq("id", n.id).eq("discord_status", n.discord_status); continue; }
    const link = links.data?.find(l => l.user_id === n.user_id && l.guild_id === process.env.DISCORD_GUILD_ID);
    if (!link) { await db.from("academy_learning_notices").update({ discord_status: "unlinked" }).eq("id", n.id).eq("discord_status", n.discord_status); continue; }
    if (!link.enabled || !c.discordWeekdays?.includes(weekday) || handled.has(n.user_id) || n.discord_attempts >= 5) continue;
    const reservation = await db.from("academy_discord_links").update({ last_attempt_day: localDay(now) }).eq("user_id", n.user_id).eq("discord_id", link.discord_id).eq("enabled", true).or(`last_attempt_day.is.null,last_attempt_day.lt.${localDay(now)}`).select("user_id");
    if (reservation.error) throw new ApiError("Não foi possível reservar o lembrete diário.", 503);
    if (!reservation.data?.length) continue;
    const { data: claimed, error: claimError } = await db.from("academy_learning_notices").update({ discord_status: "sending", discord_lease_at: now.toISOString(), discord_attempts: n.discord_attempts + 1 }).eq("id", n.id).eq("discord_status", n.discord_status).select("id");
    if (claimError) throw new ApiError("Não foi possível reservar o envio.", 503);
    if (!claimed?.length) continue;
    handled.add(n.user_id);
    try {
      // Refresh permissions, assignment relevance and recipient preferences immediately before sending.
      const fresh = await trailContext(db), subject = fresh.profiles.find(p => p.id === n.subject_id);
      const still = subject && alertCandidates(fresh, subject, now).find(c => c.userId === n.user_id && c.discord && n.dedupe_key.startsWith(c.key + ":"));
      const currentLink = await db.from("academy_discord_links").select("*").eq("user_id", n.user_id).maybeSingle();
      if (currentLink.error) throw new Error("Não foi possível confirmar o vínculo.");
      if (!still || !fresh.profiles.some(p => p.id === n.user_id && internal(p)) || !currentLink.data?.enabled || currentLink.data.discord_id !== link.discord_id || currentLink.data.guild_id !== link.guild_id) {
        await db.from("academy_learning_notices").update({ discord_status: "cancelled" }).eq("id", n.id).eq("discord_status", "sending"); continue;
      }
      const delivered = await sendDiscordNotice(link.discord_id, { id: n.id, title: still.title, message: still.message, link: still.link });
      if (!delivered.id) throw new Error("Envio sem confirmação.");
      const result = await db.from("academy_learning_notices").update({ discord_status: "sent", discord_sent_at: now.toISOString(), discord_message_id: delivered.id, discord_error: null }).eq("id", n.id).eq("discord_status", "sending");
      if (result.error) throw new Error("Não foi possível registrar a confirmação."); sent++;
    } catch (e) {
      const status = e instanceof DiscordError ? e.code === 50007 ? "blocked" : "failed" : "uncertain";
      await db.from("academy_learning_notices").update({ discord_status: status, discord_error: e instanceof DiscordError ? e.message : "Entrega não confirmada; revisar no histórico antes de reenviar." }).eq("id", n.id).eq("discord_status", "sending"); failed++;
      if (e instanceof DiscordError && [401, 429].includes(e.status)) break;
    }
  }
  return { configured: true, sent, failed };
}
