import { test, expect, requiredCourse } from "./fixtures";

test("URL de PDF confidencial exige autenticação", async ({ colaborador, browser }) => {
  const course = requiredCourse(colaborador.state, "E2E_ATTACHMENT_COURSE_ID", "reading");
  const lesson = course.lessons.find(item => item.attachmentPath);
  if (!lesson) throw new Error("E2E_ATTACHMENT_COURSE_ID precisa ter uma leitura com PDF privado.");
  const endpoint = `/api/attachments?courseId=${encodeURIComponent(course.id)}&lessonId=${encodeURIComponent(lesson.id)}`;
  const authorized = await colaborador.page.request.get(endpoint, { headers: { Authorization: `Bearer ${colaborador.token}` } });
  expect(authorized.status(), await authorized.text()).toBe(200);
  expect((await authorized.json()).url).toMatch(/^https:\/\//);

  const anonymous = await browser.newContext();
  try {
    const denied = await anonymous.request.get(endpoint);
    expect([401, 403]).toContain(denied.status());
    expect(denied.headers()["cache-control"]).toContain("no-store");
  } finally { await anonymous.close(); }
});
