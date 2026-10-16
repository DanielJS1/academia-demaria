import { authenticate, ApiError } from "@/lib/pilot-server";
import { academyUrl, codeHash, discordConfigured, guildMember, newLinkCode, snowflake } from "@/lib/discord";
import { authorizationUrl, discordOAuthIdentity, oauthCookie, oauthState, requestOAuthCookie, verifyOAuthState } from "@/lib/discord-oauth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  const headers: Record<string,string> = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" };
  try {
    const { db, me } = await authenticate(request);
    if (me.audience === "client") throw new ApiError("Disponível para colaboradores internos.", 403);
    const raw = await request.text(); if (raw.length > 1500) throw new ApiError("Solicitação inválida.");
    const input = JSON.parse(raw);
    if (!discordConfigured() || !process.env.DISCORD_CLIENT_SECRET) throw new ApiError("Login do Discord ainda em configuração.", 503);
    if (input.type === "connect") {
      const state = oauthState(me.id); headers["Set-Cookie"] = oauthCookie(state.cookie);
      return Response.json({ url: authorizationUrl(state.state) }, { headers });
    }
    if (input.type !== "finish" || typeof input.code !== "string" || input.code.length > 256 || typeof input.state !== "string") throw new ApiError("Autorização inválida.");
    verifyOAuthState(requestOAuthCookie(request), input.state, me.id); headers["Set-Cookie"] = oauthCookie("", 0);
    const user = await discordOAuthIdentity(input.code); snowflake.parse(user.id);
    await guildMember(user.id);
    const hash = codeHash(newLinkCode());
    const issued = await db.rpc("academy_discord_mutate", { actor: me.id, command: { type: "code", hash } });
    if (issued.error) throw new ApiError(issued.error.message, 409);
    const linked = await db.rpc("academy_discord_mutate", { actor: null, command: { type: "consume", hash, discordId: user.id, guildId: process.env.DISCORD_GUILD_ID, username: String(user.username ?? "Discord").slice(0,100) } });
    if (linked.error) throw new ApiError(linked.error.message, 409);
    return Response.json({ linked: true, returnUrl: academyUrl("/aprender/trilhas") }, { headers });
  } catch (e) { return Response.json({ error: e instanceof Error ? e.message : "Não foi possível conectar ao Discord." }, { status: e instanceof ApiError ? e.status : 400, headers }); }
}
