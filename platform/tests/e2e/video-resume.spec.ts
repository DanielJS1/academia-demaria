import { test, expect, academy, login, requiredCourse } from "./fixtures";

async function vimeoTime(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => new Promise<number>((resolve, reject) => {
    const frame = document.querySelector<HTMLIFrameElement>('iframe[src*="player.vimeo.com"]');
    if (!frame?.contentWindow) { reject(new Error("Player Vimeo ausente")); return; }
    const timeout = window.setTimeout(() => { window.removeEventListener("message", onMessage); reject(new Error("Vimeo não respondeu getCurrentTime")); }, 5000);
    const origin = new URL(frame.src).origin;
    function onMessage(event: MessageEvent) {
      if (event.source !== frame?.contentWindow || event.origin !== origin) return;
      let data: { method?: string; value?: number };
      try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      if (data.method !== "getCurrentTime" || typeof data.value !== "number") return;
      window.clearTimeout(timeout); window.removeEventListener("message", onMessage); resolve(data.value);
    }
    window.addEventListener("message", onMessage);
    frame.contentWindow.postMessage({ method: "getCurrentTime" }, origin);
  }));
}

test("Vimeo retoma do minuto salvo após fechar e reabrir pelo catálogo", async ({ browser, colaborador }) => {
  test.setTimeout(180_000);
  const course = requiredCourse(colaborador.state, "E2E_VIDEO_COURSE_ID", "video");
  const lesson = course.lessons[0];
  if (lesson.type !== "video" || lesson.minutes < 2) throw new Error("E2E_VIDEO_COURSE_ID precisa começar com vídeo Vimeo de ao menos 2 minutos.");
  const initial = (await academy(colaborador)).videoProgress[course.id]?.[lesson.id]?.position ?? 0;
  const target = Math.max(60, initial + 10);
  if (target > lesson.minutes * 60 - 15) throw new Error("Vídeo de staging precisa ter tempo restante para testar retomada.");
  await colaborador.page.goto(`/aprender/${course.id}/aula?aula=${lesson.id}`);
  const frame = colaborador.page.locator('iframe[src*="player.vimeo.com"]');
  await expect(frame).toBeVisible();
  await colaborador.page.frameLocator('iframe[src*="player.vimeo.com"]').getByRole("button", { name: /play|reproduzir/i }).first().click();
  await expect.poll(async () => (await academy(colaborador)).videoProgress[course.id]?.[lesson.id]?.position ?? 0, { timeout: 100_000, intervals: [5000] }).toBeGreaterThanOrEqual(target);
  const saved = (await academy(colaborador)).videoProgress[course.id][lesson.id].position;
  await colaborador.context.close();

  const second = await login(browser, "colaborador");
  try {
    await second.page.goto("/aprender");
    await second.page.getByRole("tab", { name: /Todos os cursos/ }).click();
    await second.page.locator(`a[href="/aprender/${course.id}"]`).first().click();
    await expect(second.page.getByRole("heading", { name: course.title })).toBeVisible();
    await second.page.getByRole("link", { name: /Continuar aprendendo|Começar minha jornada/ }).click();
    if (!second.page.url().includes(`aula=${encodeURIComponent(lesson.id)}`)) {
      await second.page.locator(".curriculum-list .lesson-button").filter({ hasText: lesson.title }).click();
    }
    await expect(second.page.locator('iframe[src*="player.vimeo.com"]')).toBeVisible();
    await expect.poll(() => vimeoTime(second.page), { timeout: 20_000 }).toBeGreaterThanOrEqual(saved - 5);
    expect(await vimeoTime(second.page)).toBeLessThan(saved + 15);
  } finally { await second.context.close(); }
});
