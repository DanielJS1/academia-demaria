import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizationUrl, discordOAuthIdentity, oauthCookie, oauthState, verifyOAuthState } from "./discord-oauth";
import { GET } from "../app/api/discord/oauth/callback/route";

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "test-signing-secret");
  vi.stubEnv("DISCORD_APPLICATION_ID", "1558246474578665562");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://academia-demaria.vercel.app");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("vinculação OAuth Discord", () => {
  it("vincula autorização ao usuário e rejeita adulteração e outro estado", () => {
    const a = oauthState("person-a"), b = oauthState("person-a");
    expect(a.state).not.toBe(b.state);
    expect(verifyOAuthState(a.cookie, a.state, "person-a").userId).toBe("person-a");
    expect(() => verifyOAuthState(a.cookie, a.state, "person-b")).toThrow();
    expect(() => verifyOAuthState(a.cookie, b.state)).toThrow();
    expect(() => verifyOAuthState(a.cookie + "0", a.state)).toThrow();
    expect(() => verifyOAuthState("", a.state)).toThrow();
  });
  it("expira em dez minutos e usa cookie seguro sem acesso JavaScript", () => {
    const a = oauthState("person");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 600001);
    expect(() => verifyOAuthState(a.cookie, a.state)).toThrow();
    expect(oauthCookie(a.cookie)).toContain("HttpOnly; Secure; SameSite=Lax; Max-Age=600");
    expect(oauthCookie("", 0)).toContain("Max-Age=0");
  });
  it("solicita apenas identidade e usa callback fixo da Academia", () => {
    const url = new URL(authorizationUrl("state"));
    expect(url.origin).toBe("https://discord.com");
    expect(url.searchParams.get("scope")).toBe("identify");
    expect(url.searchParams.get("redirect_uri")).toBe("https://academia-demaria.vercel.app/api/discord/oauth/callback");
    expect(url.searchParams.has("client_secret")).toBe(false);
  });
  it("recusa token de bot como substituto do segredo OAuth", async () => {
    vi.stubEnv("DISCORD_CLIENT_SECRET", ""); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(discordOAuthIdentity("code")).rejects.toThrow("configurado");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("troca código por formulário e revoga token depois de obter identidade", async () => {
    vi.stubEnv("DISCORD_CLIENT_SECRET", "test-client-secret");
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ access_token: "test-access" })).mockResolvedValueOnce(Response.json({ id: "111111111111111111", username: "Pessoa" })).mockResolvedValueOnce(new Response(null));
    vi.stubGlobal("fetch", fetcher);
    expect((await discordOAuthIdentity("code")).username).toBe("Pessoa");
    expect(fetcher.mock.calls[0][1].body.get("grant_type")).toBe("authorization_code");
    expect(fetcher.mock.calls[0][1].headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe("Bearer test-access");
    expect(fetcher.mock.calls[2][0]).toContain("/token/revoke");
  });
  it("revoga token mesmo quando consulta da identidade falha", async () => {
    vi.stubEnv("DISCORD_CLIENT_SECRET", "test-client-secret");
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ access_token: "test-access" })).mockResolvedValueOnce(new Response(null, { status: 403 })).mockResolvedValueOnce(new Response(null));
    vi.stubGlobal("fetch", fetcher);
    await expect(discordOAuthIdentity("code")).rejects.toThrow("confirmar");
    expect(fetcher.mock.calls[2][0]).toContain("/token/revoke");
  });
  it("callback rejeita estado ausente e ignora endereço externo", async () => {
    const response = await GET(new Request("https://academia-demaria.vercel.app/api/discord/oauth/callback?code=x&redirect=https://evil.example"));
    const target = new URL(response.headers.get("location")!);
    expect(response.status).toBe(303); expect(target.origin).toBe("https://academia-demaria.vercel.app");
    expect(target.searchParams.has("discord_error")).toBe(true); expect(target.searchParams.has("discord_code")).toBe(false);
  });
  it("callback encaminha apenas autorização vinculada ao cookie assinado", async () => {
    const a = oauthState("person"), response = await GET(new Request(`https://academia-demaria.vercel.app/api/discord/oauth/callback?code=abc&state=${a.state}`, { headers: { Cookie: oauthCookie(a.cookie) } }));
    const target = new URL(response.headers.get("location")!);
    expect(target.searchParams.get("discord_code")).toBe("abc"); expect(target.searchParams.get("discord_state")).toBe(a.state);
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
});
