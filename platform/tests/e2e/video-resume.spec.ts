import { test, expect, academy, login, requiredCourse } from "./fixtures";

async function vimeoValue(page: import("@playwright/test").Page, method: "getCurrentTime" | "getDuration"): Promise<number> {
  return page.evaluate(method => new Promise<number>((resolve) => {
    const frame = document.querySelector<HTMLIFrameElement>('iframe[src*="player.vimeo.com"]');
    if (!frame?.contentWindow) { resolve(-1); return; }
    const origin = new URL(frame.src).origin;
    let finished = false;
    const cleanup = () => {
      finished = true;
      clearInterval(interval);
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
    };
    const timeout = window.setTimeout(() => { cleanup(); resolve(-1); }, 4000);
    function onMessage(event: MessageEvent) {
      if (finished) return;
      if (event.source !== frame?.contentWindow || event.origin !== origin) return;
      let data: { method?: string; value?: number };
      try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      if (data.method !== method || typeof data.value !== "number") return;
      cleanup();
      resolve(data.value);
    }
    window.addEventListener("message", onMessage);
    const send = () => {
      try {
        frame.contentWindow?.postMessage({ method }, origin);
      } catch {}
    };
    send();
    const interval = window.setInterval(send, 500);
  }), method);
}

async function vimeoCommand(page: import("@playwright/test").Page, method: string, value?: unknown): Promise<void> {
  await page.evaluate(({ method, value }) => {
    const frame = document.querySelector<HTMLIFrameElement>('iframe[src*="player.vimeo.com"]');
    if (!frame?.contentWindow) return;
    const origin = new URL(frame.src).origin;
    frame.contentWindow.postMessage(value !== undefined ? { method, value } : { method }, origin);
  }, { method, value });
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
  await expect.poll(() => vimeoValue(colaborador.page, "getDuration"), { timeout: 30_000 }).toBeGreaterThan(0);
  const duration = await vimeoValue(colaborador.page, "getDuration");
  if (target >= duration - 5) throw new Error("Vídeo precisa ter tempo restante para testar retomada.");
  await vimeoCommand(colaborador.page, "setCurrentTime", target);
  await expect.poll(() => vimeoValue(colaborador.page, "getCurrentTime"), { timeout: 30_000 }).toBeGreaterThanOrEqual(target - 2);
  const savedResponse = await colaborador.page.request.post("/api/academy", {
    headers: { Authorization: `Bearer ${colaborador.token}` },
    data: { type: "video", courseId: course.id, version: course.version, lessonId: lesson.id, duration, position: target, ranges: [] },
  });
  expect(savedResponse.status(), await savedResponse.text()).toBe(200);
  await expect.poll(async () => (await academy(colaborador)).videoProgress[course.id]?.[lesson.id]?.position ?? 0).toBeGreaterThanOrEqual(target);
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
    await expect.poll(() => vimeoValue(second.page, "getCurrentTime"), { timeout: 30_000 }).toBeGreaterThanOrEqual(saved - 5);
    await expect.poll(() => vimeoValue(second.page, "getCurrentTime"), { timeout: 10_000 }).toBeLessThan(saved + 15);
  } finally { await second.context.close(); }
});
