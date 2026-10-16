import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "../pilot-server";
const fixture = vi.hoisted(() => ({ client: { auth: { getUser: vi.fn() }, from: vi.fn() }, profile: vi.fn(), insert: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => fixture.client }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://isolated.example.test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "isolated-fixture");
  vi.clearAllMocks();
  fixture.client.auth.getUser.mockResolvedValue({ data: { user: { id: "actor", email: "test@demaria.com.br" } }, error: null });
  fixture.profile.mockResolvedValue({ data: null, error: null });
  const builder = { select: () => builder, eq: () => builder, maybeSingle: fixture.profile, insert: fixture.insert };
  fixture.client.from.mockReturnValue(builder);
});
afterEach(() => vi.unstubAllEnvs());
describe("report authentication never creates a missing profile", () => {
  const request = new Request("http://localhost/api/reports", { headers: { Authorization: "Bearer isolated" } });
  it("refuses missing profile without invoking registration", async () => {
    await expect(authenticate(request, { createMissingProfile: false })).rejects.toMatchObject({ status: 403 });
    expect(fixture.insert).not.toHaveBeenCalled();
  });
  it("returns an existing active profile without mutations", async () => {
    const me = { id: "actor", status: "active", role: "manager", audience: "internal" };
    fixture.profile.mockResolvedValue({ data: me, error: null });
    expect((await authenticate(request, { createMissingProfile: false })).me).toEqual(me); expect(fixture.insert).not.toHaveBeenCalled();
  });
  it("denies invalid token and absent bearer without profile reads", async () => {
    await expect(authenticate(new Request("http://localhost/api/reports"), { createMissingProfile: false })).rejects.toMatchObject({ status: 401 });
    fixture.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    await expect(authenticate(request, { createMissingProfile: false })).rejects.toMatchObject({ status: 401 });
    expect(fixture.client.from).not.toHaveBeenCalled();
  });
  it("reports failed profile reads without creating anything", async () => {
    fixture.profile.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(authenticate(request, { createMissingProfile: false })).rejects.toMatchObject({ status: 503 }); expect(fixture.insert).not.toHaveBeenCalled();
  });
});
