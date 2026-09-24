import { test, expect, requiredCourse } from "./fixtures";

test("cartório não enxerga curso interno nem consegue concluir aula pela API", async ({ colaborador, cartorio }) => {
  const internal = requiredCourse(colaborador.state, "E2E_INTERNAL_COURSE_ID");
  expect(internal.audience).toBe("internal");
  expect(cartorio.state.courses.some(course => course.id === internal.id)).toBe(false);

  await cartorio.page.goto(`/aprender/${internal.id}/aula`);
  await expect(cartorio.page.getByText("Uma jornada em preparação")).toBeVisible();

  const response = await cartorio.page.request.post("/api/academy", {
    headers: { Authorization: `Bearer ${cartorio.token}` },
    data: { type: "complete", courseId: internal.id, version: internal.version, lessonId: internal.lessons[0].id },
  });
  expect(response.status()).toBe(403);
});
