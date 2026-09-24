import { test, expect, academy, requiredCourse } from "./fixtures";

test("conclusão repetida registra um único evento de XP", async ({ colaborador }) => {
  const course = requiredCourse(colaborador.state, "E2E_XP_COURSE_ID", "reading");
  const lesson = course.lessons.find(item => item.type === "reading")!;
  const eventLabel = `Aula concluída · ${lesson.title}`;
  await colaborador.page.goto(`/aprender/${course.id}/aula?aula=${lesson.id}`);
  await expect(colaborador.page.getByRole("heading", { name: lesson.title }).first()).toBeVisible();
  const initial = await academy(colaborador);
  const wasComplete = (initial.completed[course.id] || []).includes(lesson.id);
  await colaborador.page.getByRole("button", { name: /Concluir e continuar|Continuar/ }).last().click();
  await expect.poll(async () => (await academy(colaborador)).completed[course.id]?.includes(lesson.id)).toBe(true);

  const command = { type: "complete", courseId: course.id, version: course.version, lessonId: lesson.id };
  const duplicateResponses = await Promise.all(Array.from({ length: 3 }, () => colaborador.page.request.post("/api/academy", {
    headers: { Authorization: `Bearer ${colaborador.token}` }, data: command,
  })));
  for (const response of duplicateResponses) expect(response.status(), await response.text()).toBe(200);
  await colaborador.page.reload();
  await colaborador.page.reload();
  const final = await academy(colaborador);
  const events = final.xpEvents.filter(event => event.label === eventLabel);
  expect(events).toHaveLength(1);
  expect(new Set(events.map(event => event.id)).size).toBe(1);
  expect(final.completed[course.id].filter(id => id === lesson.id)).toHaveLength(1);
  if (!wasComplete) expect(initial.xpEvents.some(event => event.label === eventLabel)).toBe(false);
});
