import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { academyUrl } from "./discord";
export const OAUTH_COOKIE = "__Host-academy-discord";
export const redirectUri = () => academyUrl("/api/discord/oauth/callback");
export function oauthState(userId: string) {
  const state = randomBytes(32).toString("hex");
  const payload = Buffer.from(JSON.stringify({ userId, state, expires: Date.now() + 600000 })).toString("base64url");
  return { state, cookie: `${payload}.${signature(payload)}` };
}
function signature(value: string) {
  if (!process.env.CRON_SECRET) throw new Error("OAuth indisponível.");
  return createHmac("sha256", process.env.CRON_SECRET).update("discord-oauth:" + value).digest("hex");
}
export function verifyOAuthState(cookie: string, state: string, userId?: string) {
  const [payload, sig, extra] = cookie.split(".");
  if (extra || !payload || !/^[a-f0-9]{64}$/.test(sig ?? "") || !/^[a-f0-9]{64}$/.test(state)) throw new Error("Conexão expirada. Tente novamente.");
  const expected = signature(payload);
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) throw new Error("Conexão inválida.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (data.state !== state || data.expires < Date.now() || userId && data.userId !== userId) throw new Error("Entre na mesma conta da Academia e conecte novamente.");
  return data;
}
export function oauthCookie(value: string, maxAge = 600) { return `${OAUTH_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
export function requestOAuthCookie(request: Request) { return request.headers.get("cookie")?.split(";").map(p => p.trim()).find(p => p.startsWith(OAUTH_COOKIE + "="))?.slice(OAUTH_COOKIE.length + 1) ?? ""; }
export function authorizationUrl(state: string) {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({ client_id: process.env.DISCORD_APPLICATION_ID!, response_type: "code", scope: "identify", state, redirect_uri: redirectUri(), prompt: "consent" }).toString();
  return url.href;
}
export async function discordOAuthIdentity(code: string) {
  const secret = process.env.DISCORD_CLIENT_SECRET; if (!secret) throw new Error("Login do Discord ainda não configurado.");
  const response = await fetch("https://discord.com/api/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.DISCORD_APPLICATION_ID!, client_secret: secret, grant_type: "authorization_code", code, redirect_uri: redirectUri() }), signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!response.ok) throw new Error("A autorização do Discord expirou. Conecte novamente.");
  const tokens = await response.json();
  try {
    const identity = await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!identity.ok) throw new Error("Não foi possível confirmar sua conta do Discord.");
    return await identity.json();
  } finally {
    // Identity is needed only during linking; never retain Discord access/refresh tokens.
    try { await fetch("https://discord.com/api/oauth2/token/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.DISCORD_APPLICATION_ID!, client_secret: secret, token: tokens.access_token, token_type_hint: "access_token" }), signal: AbortSignal.timeout(4000) }); } catch { /* No persistent token is stored. */ }
  }
}
