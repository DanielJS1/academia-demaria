import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { GET, POST } from "./route";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
const single = vi.fn(), generateLink = vi.fn(), verifyOtp = vi.fn();
const origin = "https://academia-demaria-homologacao.vercel.app";
const request = (body: object, source = origin) => new Request(`${origin}/api/auth/demo`, {
  method: "POST", headers: { "Content-Type": "application/json", Origin: source }, body: JSON.stringify(body),
});
const profile = { id: "demo-user", role: "admin", status: "active", audience: "internal" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("DEMO_LOGIN_ENABLED", "true"); vi.stubEnv("NEXT_PUBLIC_APP_ENV", "homologacao");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://attnodzrjlhqydhrgqtr.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-key-for-test"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-key-for-test");
  single.mockResolvedValue({ data: profile, error: null });
  generateLink.mockResolvedValue({ data: { user: { id: profile.id }, properties: { hashed_token: "one-time-token" } }, error: null });
  verifyOtp.mockResolvedValue({ data: { user: { id: profile.id }, session: { access_token: "session-token", refresh_token: "refresh-token" } }, error: null });
  vi.mocked(createClient).mockImplementation(((_url: string, key: string) => key === "server-key-for-test"
    ? { from: () => ({ select: () => ({ eq: () => ({ single }) }) }), auth: { admin: { generateLink } } }
    : { auth: { verifyOtp } }) as unknown as typeof createClient);
});
afterEach(() => vi.unstubAllEnvs());

describe("login de demonstração isolado", () => {
  it.each([
    ["DEMO_LOGIN_ENABLED", "false"], ["NEXT_PUBLIC_APP_ENV", "production"],
    ["NEXT_PUBLIC_SUPABASE_URL", "https://ktmymzokgxmmkleacclq.supabase.co"], ["SUPABASE_SERVICE_ROLE_KEY", ""],
  ])("bloqueia configuração insegura: %s", async (key, value) => {
    vi.stubEnv(key, value);
    expect(await (await GET()).json()).toEqual({ enabled: false });
    expect((await POST(request({ profile: "admin" }))).status).toBe(404);
    expect(createClient).not.toHaveBeenCalled();
  });
  it("recusa outra origem e perfis ou campos arbitrários", async () => {
    expect((await POST(request({ profile: "admin" }, "https://other.example"))).status).toBe(403);
    for (const body of [{ profile: "other" }, { profile: "admin", email: "other@example.test" }, {}]) {
      expect((await POST(request(body))).status).toBe(400);
    }
    expect(createClient).not.toHaveBeenCalled();
  });
  it("reconhece o host público quando o Next usa uma URL interna", async () => {
    const proxied = new Request("https://localhost/api/auth/demo", { method: "POST", headers: { Origin: origin, Host: new URL(origin).host }, body: JSON.stringify({ profile: "admin" }) });
    expect((await POST(proxied)).status).toBe(200);
  });
  it.each([
    ["admin", "admin", "internal", "demo.apresentacao.admin@demaria.com.br"],
    ["gestor", "manager", "internal", "demo.gestor.1@demaria.com.br"],
    ["colaborador", "student", "internal", "demo.colaborador.1.1@demaria.com.br"],
    ["cartorio", "student", "client", "demo.cartorio.apresentacao@demaria.com.br"],
  ])("abre apenas a identidade fixa de %s sem expor link ou senha", async (selected, role, audience, email) => {
    single.mockResolvedValue({ data: { ...profile, role, audience }, error: null });
    const response = await POST(request({ profile: selected }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.json()).toEqual({ access_token: "session-token", refresh_token: "refresh-token" });
    expect(generateLink).toHaveBeenCalledWith({ type: "magiclink", email });
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "one-time-token", type: "email" });
  });
  it.each([{ status: "inactive" }, { role: "student" }, { audience: "client" }])("recusa perfil fora do contrato: %j", async change => {
    single.mockResolvedValue({ data: { ...profile, ...change }, error: null });
    expect((await POST(request({ profile: "admin" }))).status).toBe(403);
    expect(generateLink).not.toHaveBeenCalled();
  });
  it("recusa vínculo de identidade divergente", async () => {
    generateLink.mockResolvedValue({ data: { user: { id: "another-user" } }, error: null });
    expect((await POST(request({ profile: "admin" }))).status).toBe(503);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
