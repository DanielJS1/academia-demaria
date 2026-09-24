import { login, test, expect, requiredCourse } from "./fixtures";

test("anotação volta após logout e login em outro navegador", async ({ browser, colaborador }) => {
  const course = requiredCourse(colaborador.state, "E2E_NOTES_COURSE_ID", "reading");
  const lesson = course.lessons.find(item => item.type === "reading")!;
  const text = `Nota E2E ${Date.now()} · persistência entre sessões`;
  await colaborador.page.goto(`/aprender/${course.id}/aula?aula=${lesson.id}`);
  const notepad = colaborador.page.getByRole("textbox", { name: "Caderno de anotações da aula" });
  await expect(colaborador.page.getByText("Salvo nesta aula")).toBeVisible();
  await notepad.fill(text);
  await expect(notepad).toHaveValue(text);
  await expect(colaborador.page.getByText("Salvo nesta aula")).toBeVisible();
  const saved = await colaborador.page.request.get(`/api/notes?courseId=${encodeURIComponent(course.id)}`, { headers: { Authorization: `Bearer ${colaborador.token}` } });
  expect(saved.status()).toBe(200);
  expect((await saved.json()).notes[lesson.id]).toBe(text);
  await colaborador.page.getByRole("button", { name: "Sair", exact: true }).last().click();
  await expect(colaborador.page.getByRole("button", { name: "Entrar na minha jornada" })).toBeVisible();

  const second = await login(browser, "colaborador");
  try {
    await second.page.goto(`/aprender/${course.id}/aula?aula=${lesson.id}`);
    await expect(second.page.getByRole("textbox", { name: "Caderno de anotações da aula" })).toHaveValue(text);
    const remote = await second.page.request.get(`/api/notes?courseId=${encodeURIComponent(course.id)}`, { headers: { Authorization: `Bearer ${second.token}` } });
    expect(remote.status()).toBe(200);
    expect((await remote.json()).notes[lesson.id]).toBe(text);
  } finally { await second.context.close(); }
});
