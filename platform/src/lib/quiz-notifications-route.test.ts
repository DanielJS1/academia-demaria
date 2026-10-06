import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, authenticate, executeCommand } from "./pilot-server";
import { GET } from "../app/api/quizzes/notifications/route";

vi.mock("@/lib/pilot-server", async original => ({ ...await original<typeof import("./pilot-server")>(), authenticate: vi.fn() }));
const actor = "22222222-2222-4222-8222-222222222222";
const rpc = vi.fn();
const me = { id: actor, role: "student", audience: "internal", status: "active" } as const;
const db = { rpc } as unknown as Awaited<ReturnType<typeof authenticate>>["db"];
beforeEach(() => { rpc.mockReset(); vi.mocked(authenticate).mockReset().mockResolvedValue({ db, me } as Awaited<ReturnType<typeof authenticate>>); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());
describe("consulta leve e comando de avisos", () => {
  it("usa somente ator autenticado, sem perguntas e sem cache", async () => {
    rpc.mockResolvedValue({ data: { userId: actor, quizNotifications: { enabled: true, since: "2026-10-06T12:00:00Z" }, readNotices: ["welcome"], notifications: [], questions: ["secret"] } });
    const response = await GET(new Request("http://localhost/api/quizzes/notifications?actor=outro"));
    expect(rpc).toHaveBeenCalledWith("academy_read_quiz_notifications", { actor }); expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store"); expect(await response.json()).not.toHaveProperty("questions");
  });
  it("encaminha comando específico sem reescrever bookmarks ou datas", async () => {
    rpc.mockResolvedValue({ error: null }); await executeCommand(db, me as Awaited<ReturnType<typeof authenticate>>["me"], { type: "quiz-notifications", enabled: true });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("academy_set_quiz_notifications", { actor, enabled: true });
  });
  it("rejeita campos extras antes de chamar RPC", async () => {
    await expect(executeCommand(db, me as Awaited<ReturnType<typeof authenticate>>["me"], { type: "quiz-notifications", enabled: true, actor: "outro" })).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([401, 403])("propaga falha de sessão/perfil %s sem consultar dados", async status => {
    vi.mocked(authenticate).mockRejectedValue(new ApiError("Acesso indisponível", status));
    expect((await GET(new Request("http://localhost/api/quizzes/notifications"))).status).toBe(status); expect(rpc).not.toHaveBeenCalled();
  });
  it("indisponibilidade não devolve sucesso vazio", async () => {
    rpc.mockResolvedValue({ error: { code: "PGRST202", message: "segredo" } });
    const response = await GET(new Request("http://localhost/api/quizzes/notifications")); expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("segredo");
  });
});
