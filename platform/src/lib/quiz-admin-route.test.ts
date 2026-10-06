import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, authenticate } from "./pilot-server";
import { POST, PATCH, DELETE, GET } from "../app/api/quizzes/manage/route";

vi.mock("@/lib/pilot-server", async importOriginal => {
  const actual = await importOriginal<typeof import("./pilot-server")>();
  return { ...actual, authenticate: vi.fn() };
});

const rpc = vi.fn();
const payload = { title: "Desafio de teste", slug: "desafio-teste", description: "", category: "sistema",
  xpReward: 70, passingScore: 60, periodType: "weekly", targetAudience: "internal", isActive: true, isFeatured: false,
  availableFrom: "2026-10-01T00:00:00Z", expiresAt: null,
  questions: [1, 2].map(index => ({ prompt: `Pergunta ${index}`, options: [{ id: "a", text: "Sim" }, { id: "b", text: "Não" }],
    correctOptionId: "a", explanation: "Explicação da resposta", imageUrl: "", imageAlt: "" })) };
const profile = { id: "11111111-1111-4111-8111-111111111111", name: "Admin", email: "admin@example.test",
  department: "", manager_id: null, role: "admin" as const, status: "active" as const, audience: "internal" as const };
type Authentication = Awaited<ReturnType<typeof authenticate>>;
function session(me: Authentication["me"] = profile, db = { rpc } as unknown as Authentication["db"]) {
  vi.mocked(authenticate).mockResolvedValue({ db, me });
}
function request(method = "POST", body: unknown = payload) {
  return new Request("http://localhost/api/quizzes/manage", { method,
    headers: { Authorization: "Bearer secret-token", "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: "quiz-id", error: null });
  vi.mocked(authenticate).mockReset();
  session();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

describe("administração dos desafios: respostas e diagnóstico", () => {
  it("envia os dados validados e mantém o contrato de sucesso", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "quiz-id" });
    expect(rpc).toHaveBeenCalledWith("academy_save_periodic_quiz", { actor: profile.id, payload });
  });

  it("recusa payload inválido antes de chamar a RPC", async () => {
    const response = await POST(request("POST", { ...payload, passingScore: 101 }));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([401, 403])("preserva erro de autenticação/autorização %i", async status => {
    vi.mocked(authenticate).mockRejectedValue(new ApiError("Acesso negado.", status));
    expect((await POST(request())).status).toBe(status);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(["student", "manager"] as const)("recusa %s antes da escrita", async role => {
    session({ ...profile, role });
    expect((await POST(request())).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: "P0001", details: "QUIZ_INVALID_DATA" }, 400, "QUIZ_INVALID_DATA"],
    [{ code: "P0001", details: "QUIZ_FORBIDDEN" }, 403, "QUIZ_FORBIDDEN"],
    [{ code: "P0001", details: "QUIZ_NOT_FOUND" }, 404, "QUIZ_NOT_FOUND"],
    [{ code: "P0001", details: "QUIZ_ALREADY_ANSWERED" }, 409, "QUIZ_ALREADY_ANSWERED"],
    [{ code: "23505" }, 409, "QUIZ_CONFLICT"],
    [{ code: "42P01", message: 'missing FROM-clause entry for table "academy_save_periodic_quiz"' }, 500, "QUIZ_INTERNAL_ERROR"],
    [{ code: "PGRST202" }, 503, "QUIZ_SCHEMA_UNAVAILABLE"],
    [{ code: "PGRST003" }, 503, "QUIZ_UNAVAILABLE"],
  ])("classifica falha %j como %i", async (error, status, code) => {
    rpc.mockResolvedValue({ data: null, error });
    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(status);
    expect(body.code).toBe(code);
    expect(body.requestId).toBe(response.headers.get("X-Request-Id"));
    expect(body.requestId).toMatch(/^[\da-f-]{36}$/);
    expect(console.error).toHaveBeenCalledWith("[quizzes/manage]", expect.objectContaining({ requestId: body.requestId, operation: "save" }));
    expect(body.error).not.toContain("Confira a migration");
  });

  it("suporta a restrição de respondido na RPC anterior durante rollout", async () => {
    rpc.mockResolvedValue({ error: { code: "P0001", message: "Desafio já respondido: crie uma nova edição para alterar perguntas" } });
    expect((await POST(request())).status).toBe(409);
  });

  it("não expõe valores arbitrários de message/details/hint nos logs ou resposta", async () => {
    const secret = "secret-token secret-key respostas-confidenciais";
    rpc.mockResolvedValue({ error: { code: "42P01", message: secret, details: secret, hint: secret } });
    const response = await POST(request());
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain(secret);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain(secret);
    expect(logged).toContain("42P01");
  });

  it.each([PATCH, DELETE])("identifica inexistente também nas outras mutações", async handler => {
    rpc.mockResolvedValue({ error: { code: "P0001", message: "Desafio não encontrado" } });
    const method = handler === PATCH ? "PATCH" : "DELETE";
    expect((await handler(request(method, { id: profile.id, ...(method === "PATCH" ? { active: true } : {}) }))).status).toBe(404);
  });

  it("classifica falha SQL na listagem sem culpar migrations automaticamente", async () => {
    const result = { error: { code: "42P01", message: "consulta inválida" }, data: null };
    const chain = { select: () => chain, is: () => chain, order: async () => result };
    session(profile, { from: () => chain } as unknown as Authentication["db"]);
    const response = await GET(new Request("http://localhost/api/quizzes/manage"));
    expect(response.status).toBe(500);
  });
});
