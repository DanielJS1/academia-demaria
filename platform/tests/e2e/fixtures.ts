import { test as base, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

type Role = "colaborador" | "gestor" | "cartorio";
type Lesson = { id: string; type: string; title: string; minutes: number; attachmentPath?: string };
type Course = { id: string; version: number; audience: string; title: string; lessons: Lesson[] };
export type AcademyState = { courses: Course[]; completed: Record<string, string[]>; xpEvents: Array<{ id: string; label: string; amount: number }>; videoProgress: Record<string, Record<string, { position: number }>> };
export type AuthSession = { context: BrowserContext; page: Page; token: string; userId: string; state: AcademyState };

function credentials(role: Role) {
  const prefix = `E2E_${role.toUpperCase()}`;
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) throw new Error(`Defina ${prefix}_EMAIL e ${prefix}_PASSWORD para staging.`);
  return { email, password };
}

export async function login(browser: Browser, role: Role): Promise<AuthSession> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const { email, password } = credentials(role);
  await page.goto("/acesso", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Bom ter você por aqui." })).toBeVisible({ timeout: 30_000 });
  if (role === "cartorio") {
    await page.getByRole("button", { name: "Cliente do Cartório" }).click();
  } else {
    const colabBtn = page.getByRole("button", { name: "Colaborador DeMaria" });
    await colabBtn.click();
    await expect(colabBtn).toHaveAttribute("aria-pressed", "true");
  }
  const emailInput = page.getByRole("textbox", { name: role === "cartorio" ? "E-mail credenciado da serventia" : "E-mail corporativo" });
  await expect(emailInput).toBeVisible({ timeout: 30_000 });
  await emailInput.fill(email);
  await page.locator('#access-password').fill(password);
  const academy = page.waitForResponse(response => response.url().endsWith("/api/academy") && response.request().method() === "GET");
  await page.getByRole("button", { name: "Entrar na minha jornada" }).click();
  const response = await academy;
  expect(response.status(), `Login ${role}: ${await response.text()}`).toBe(200);
  const payload = await response.json() as { me: { id: string; role: string; audience: string }; state: AcademyState };
  expect(payload.me.audience).toBe(role === "cartorio" ? "client" : "internal");
  expect(payload.me.role).toBe(role === "gestor" ? "manager" : "student");
  const token = response.request().headers().authorization?.replace(/^Bearer /, "");
  if (!token) throw new Error(`Token de ${role} ausente no request /api/academy.`);
  return { context, page, token, userId: payload.me.id, state: payload.state };
}

export async function academy(session: AuthSession) {
  const response = await session.page.request.get("/api/academy", { headers: { Authorization: `Bearer ${session.token}` } });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json() as { state: AcademyState }).state;
}

export function requiredCourse(state: AcademyState, envName: string, lessonType?: string) {
  const id = process.env[envName];
  if (!id) throw new Error(`Defina ${envName} com um curso publicado de staging.`);
  const course = state.courses.find(item => item.id === id);
  if (!course) throw new Error(`${envName}=${id} não está visível à conta usada no teste.`);
  if (lessonType && !course.lessons.some(lesson => lesson.type === lessonType)) throw new Error(`${envName} precisa conter aula ${lessonType}.`);
  return course;
}

export const test = base.extend<{ colaborador: AuthSession; gestor: AuthSession; cartorio: AuthSession }>({
  colaborador: async ({ browser }, use) => { const session = await login(browser, "colaborador"); try { await use(session); } finally { await session.context.close(); } },
  gestor: async ({ browser }, use) => { const session = await login(browser, "gestor"); try { await use(session); } finally { await session.context.close(); } },
  cartorio: async ({ browser }, use) => { const session = await login(browser, "cartorio"); try { await use(session); } finally { await session.context.close(); } },
});
export { expect };
