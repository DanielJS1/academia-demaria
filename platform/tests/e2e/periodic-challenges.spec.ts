import { test, expect, login } from "./fixtures";

test.beforeAll(() => {
  const ref = process.env.E2E_ISOLATED_SUPABASE_REF;
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://invalid").hostname;
  if (!ref || ref === "ktmymzokgxmmkleacclq" || host !== `${ref}.supabase.co`)
    throw new Error("Desafios E2E exigem E2E_ISOLATED_SUPABASE_REF igual ao Supabase isolado da aplicação. Produção é proibida.");
});

test("publicação, aviso, tentativa única e histórico prospectivo", async ({ browser, colaborador, cartorio }) => {
  test.setTimeout(180_000);
  const admin = await login(browser, "admin");
  const auth = { Authorization: `Bearer ${admin.token}` };
  const studentAuth = { Authorization: `Bearer ${colaborador.token}` };
  let id: string | undefined;
  let revision = 1;
  const title = `Desafio E2E ${Date.now()}`;
  const draft = { title, slug: `e2e-${Date.now()}`, description: "Dados dedicados de homologação", category: "sistema", xpReward: 70, passingScore: 70, periodType: "weekly", targetAudience: "internal", isActive: true, isFeatured: false, availableFrom: new Date(Date.now() - 60_000).toISOString(), expiresAt: null,
    questions: Array.from({ length: 5 }, (_, i) => ({ prompt: `Pergunta ${i + 1}: ${"Enunciado longo de homologação. ".repeat(8)}`, options: [{ id: "a", text: "Correta" }, { id: "b", text: "Incorreta" }], correctOptionId: "a", explanation: "Gabarito de homologação", imageUrl: "", imageAlt: "" })) };
  try {
    await colaborador.page.goto("/desafios");
    await expect(colaborador.page.getByRole("button", { name: /^(Habilitar avisos|Cancelar avisos)$/ })).toBeVisible();
    const enable = colaborador.page.getByRole("button", { name: "Habilitar avisos", exact: true });
    if (await enable.isVisible()) await enable.click();
    await expect(colaborador.page.getByRole("button", { name: "Cancelar avisos" })).toBeVisible();
    await colaborador.page.reload();
    await expect(colaborador.page.getByRole("button", { name: "Cancelar avisos" })).toBeVisible();
    const created = await admin.page.request.post("/api/quizzes/manage", { headers: auth, data: draft });
    expect(created.status()).toBe(200);
    id = (await created.json()).id;
    const notices = await colaborador.page.request.get("/api/quizzes/notifications", { headers: studentAuth });
    expect(notices.status()).toBe(200);
    expect(JSON.stringify(await notices.json())).toContain(`quiz-published:${id}`);
    const forbidden = await cartorio.page.request.get(`/api/quizzes/${id}`, { headers: { Authorization: `Bearer ${cartorio.token}` } });
    expect(forbidden.status()).toBe(404);
    const detail = await colaborador.page.request.get(`/api/quizzes/${id}`, { headers: studentAuth });
    const quiz = (await detail.json()).quiz;
    expect(JSON.stringify(quiz)).not.toContain("correct_option_id");
    const questionIds = quiz.questions.map((q: { id: string }) => q.id);
    const editable = { ...draft, id, expectedRevision: revision, questions: draft.questions.map((q, i) => ({ ...q, id: questionIds[i] })) };
    const edit = await admin.page.request.post("/api/quizzes/manage", { headers: auth, data: { ...editable, passingScore: 60 } });
    expect(edit.status()).toBe(200); revision++;
    await colaborador.page.goto("/desafios");
    const card = colaborador.page.locator("article").filter({ has: colaborador.page.getByRole("heading", { name: title, exact: true }) });
    await expect(card).toContainText("3 de 5");
    await card.getByRole("link", { name: `Começar: ${title}`, exact: true }).click();
    for (let i = 0; i < 5; i++) {
      await expect(colaborador.page.getByRole("heading", { name: `Questão ${i + 1} de 5`, exact: true })).toBeFocused();
      await colaborador.page.getByRole("radio").nth(i < 3 ? 0 : 1).check();
      await colaborador.page.getByRole("button", { name: i === 4 ? "Finalizar desafio" : "Próxima questão" }).click();
    }
    await expect(colaborador.page.locator(".challenge-result")).toContainText("70");
    const persisted = await colaborador.page.request.get(`/api/quizzes/${id}`, { headers: studentAuth });
    const result = (await persisted.json()).result;
    expect(result).toMatchObject({ xpGranted: 70, newlyGrantedXp: 0, passingScore: 60, correctCount: 3 });
    const answers = Object.fromEntries(questionIds.map((questionId: string) => [questionId, "b"]));
    const replay = await colaborador.page.request.post(`/api/quizzes/${id}/submit`, { headers: studentAuth, data: { answers, expectedRevision: revision } });
    expect(await replay.json()).toMatchObject({ attemptId: result.attemptId, xpGranted: 70, newlyGrantedXp: 0, replayed: true });
    const cutoff = await admin.page.request.post("/api/quizzes/manage", { headers: auth, data: { ...editable, expectedRevision: revision, passingScore: 70 } });
    expect(cutoff.status()).toBe(200); revision++;
    const locked = await admin.page.request.post("/api/quizzes/manage", { headers: auth, data: { ...editable, expectedRevision: revision, questions: editable.questions.map((q, i) => i === 0 ? { ...q, prompt: "Alterada" } : q) } });
    expect(locked.status()).toBe(409);
    await colaborador.page.reload();
    await expect(colaborador.page.getByRole("radio")).toHaveCount(0);
    const unchanged = await colaborador.page.request.get(`/api/quizzes/${id}`, { headers: studentAuth });
    expect((await unchanged.json()).result).toMatchObject({ attemptId: result.attemptId, xpGranted: 70, passingScore: 60 });
    const after = await colaborador.page.request.get("/api/quizzes/notifications", { headers: studentAuth });
    expect(JSON.stringify(await after.json())).not.toContain(`quiz-published:${id}`);
  } finally {
    if (id) {
      const removed = await admin.page.request.delete("/api/quizzes/manage", { headers: auth, data: { id, expectedRevision: revision } });
      expect(removed.status()).toBe(200);
    }
    await admin.context.close();
  }
});
