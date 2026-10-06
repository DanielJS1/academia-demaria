import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, authenticate } from "./pilot-server";
import { GET as list } from "../app/api/quizzes/route";
import { GET as detail } from "../app/api/quizzes/[id]/route";
import { POST as submit } from "../app/api/quizzes/[id]/submit/route";
import { PATCH, DELETE } from "../app/api/quizzes/manage/route";

vi.mock("@/lib/pilot-server", async importOriginal => ({
  ...await importOriginal<typeof import("./pilot-server")>(), authenticate: vi.fn(),
}));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const actor = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const question = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const rpc = vi.fn();
const result = { attemptId: id, scorePercentage: 60, passed: false, xpGranted: 6, newlyGrantedXp: 0,
  correctCount: 3, questionCount: 5, passingScore: 70, xpReward: 70, revision: 1, scoringVersion: 2,
  completedAt: "2026-10-06T00:00:00Z", replayed: true, reviewAvailable: true, results: [] };
function request(body?: unknown) {
  return new Request(`http://localhost/api/quizzes/${id}`, { method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer private-token", "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
}
const context = { params: Promise.resolve({ id }) };
beforeEach(() => {
  rpc.mockReset();
  vi.mocked(authenticate).mockReset().mockResolvedValue({ db: { rpc }, me: { id: actor, role: "admin", audience: "internal" } } as unknown as Awaited<ReturnType<typeof authenticate>>);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
describe("contratos HTTP dos desafios", () => {
  it("lista apenas resumo e usa o ator da sessão", async () => {
    rpc.mockResolvedValue({ data: { available: [], completed: [{ id, title: "Histórico", result: { ...result, answers: { secret: true } } }] } });
    const response = await list(new Request("http://localhost/api/quizzes?actor=outro"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(rpc).toHaveBeenCalledWith("academy_list_periodic_quizzes", { actor });
    const data = await response.json();
    expect(data.completed[0].result).not.toHaveProperty("results");
    expect(data.completed[0].result).not.toHaveProperty("answers");
  });
  it("detalhe remove campos privados das perguntas antes da tentativa", async () => {
    rpc.mockResolvedValue({ data: { quiz: { id, title: "Desafio", description: "", category: "sistema", xp_reward: 70, passing_score: 70, revision: 1,
      questions: [{ id: question, prompt: "Pergunta", options: [{ id: "a", text: "Sim" }, { id: "b", text: "Não" }], image_url: null, image_alt: null,
        correct_option_id: "a", explanation: "Não divulgar" }] }, result: null } });
    const response = await detail(request(), context);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.quiz.questions[0]).not.toHaveProperty("correct_option_id");
    expect(data.quiz.questions[0]).not.toHaveProperty("explanation");
    expect(rpc).toHaveBeenCalledWith("academy_read_periodic_quiz", { actor, quiz: id });
  });
  it("recupera resultado legado sem snapshot", async () => {
    rpc.mockResolvedValue({ data: { quiz: null, result: { ...result, reviewAvailable: false, correctCount: null, questionCount: null, passingScore: null, xpReward: null, revision: null, scoringVersion: 1 } } });
    const response = await detail(request(), context);
    expect(response.status).toBe(200);
    expect((await response.json()).quiz).toBeNull();
  });
  it("reenvio retorna 200 e zero XP novo e encaminha revisão", async () => {
    rpc.mockResolvedValue({ data: result });
    const response = await submit(request({ answers: { [question]: "a" }, expectedRevision: 4 }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(rpc).toHaveBeenCalledWith("academy_submit_periodic_quiz", { actor, quiz: id, submitted_answers: { [question]: "a" }, expected_revision: 4 });
  });
  it("clientes antigos sem revisão recebem conflito estável antes da primeira tentativa", async () => {
    rpc.mockResolvedValue({ error: { code: "P0001", details: "QUIZ_REVISION_CONFLICT" } });
    const response = await submit(request({ answers: { [question]: "a" } }), context);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("QUIZ_REVISION_CONFLICT");
    expect(rpc.mock.calls[0][1].expected_revision).toBeNull();
  });
  it.each([list, (req: Request) => detail(req, context), (req: Request) => submit(req, context)])("exige sessão em cada endpoint", async handler => {
    vi.mocked(authenticate).mockRejectedValue(new ApiError("Entre na sua conta.", 401));
    expect((await handler(request({ answers: {} }))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("recusa identidade forjada no payload e ID inválido antes da RPC", async () => {
    expect((await submit(request({ answers: {}, actor }), context)).status).toBe(400);
    expect((await detail(request(), { params: Promise.resolve({ id: "inválido" }) })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([PATCH, DELETE])("mutações administrativas encaminham revisão", async handler => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect((await handler(request({ id, expectedRevision: 4, ...(handler === PATCH ? { active: false } : {}) }))).status).toBe(200);
    expect(rpc.mock.calls[0][1]).toMatchObject({ actor, quiz: id, expected_revision: 4 });
  });
  it("público incorreto ou tentativa alheia indisponível retorna 404", async () => {
    rpc.mockResolvedValue({ error: { code: "P0001", details: "QUIZ_NOT_FOUND" } });
    const response = await detail(request(), context);
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("QUIZ_NOT_FOUND");
  });
});
