import { readFileSync, writeFileSync } from "node:fs";
import { test, expect } from "./fixtures";

test("gestor filtra, exporta CSV e gera PDF visível nos quatro relatórios", async ({ gestor }, testInfo) => {
  const { page, token } = gestor;
  const response = await page.request.get("/api/academy", { headers: { Authorization: `Bearer ${token}` } });
  expect(response.ok()).toBe(true);
  const payload = await response.json();
  const firstId = "report-fixture-a";
  const secondId = "report-fixture-b";
  const courseId = "report-fixture-course";
  const now = new Date().toISOString();
  payload.state.people.push(
    { id: firstId, name: "Pessoa Relatório Azul", email: "report-a@example.test", department: "E2E Gestão Azul", managerId: payload.me.id, status: "active", role: "student", xp: 100, progress: 40, audience: "internal" },
    { id: secondId, name: "Pessoa Relatório Verde", email: "report-b@example.test", department: "E2E Gestão Verde", managerId: payload.me.id, status: "active", role: "student", xp: 200, progress: 100, audience: "internal" },
  );
  for (let index = 1; index <= 21; index++) {
    payload.state.people.push({ id: `report-batch-${index}`, name: `Pessoa Relatório ${index}`, email: `report-${index}@example.test`, department: "E2E Gestão Muitos", managerId: payload.me.id, status: "active", role: "student", xp: 0, progress: 10, audience: "internal" });
  }
  payload.state.courses.push({ id: courseId, title: "Curso E2E Relatório", status: "published", audience: "internal", lessons: [{ id: "report-lesson", type: "reading", minutes: 5 }] });
  payload.state.teamProgress = { ...payload.state.teamProgress, [firstId]: { [courseId]: ["report-lesson"] }, [secondId]: { [courseId]: [] } };
  payload.state.attempts.push({ id: "report-attempt", userId: firstId, courseId, courseTitle: "Curso E2E Relatório", courseVersion: 1, questions: [{ id: "q1", type: "choice", correct: "Sim", prompt: "Questão E2E" }], answers: { q1: "Sim" }, status: "approved", feedback: "Bom resultado", score: 80, passingScore: 70, submittedAt: now });
  await page.route("**/api/academy", route => route.request().method() === "GET" ? route.fulfill({ json: payload }) : route.continue());
  await page.route("**/api/engagement?days=*", route => {
    const days = Number(new URL(route.request().url()).searchParams.get("days"));
    return route.fulfill({ json: { windowDays: days, collectedSince: now, generatedAt: now, members: [
      { userId: firstId, lastAccessAt: now, activeDays: 3, activeSeconds: 3600, daily: [] },
      { userId: secondId, lastAccessAt: null, activeDays: 0, activeSeconds: 0, daily: [] },
    ] } });
  });

  await page.goto("/equipe/relatorios");
  await expect(page.getByRole("heading", { name: "Gerador de relatórios" })).toBeVisible();
  await page.getByLabel("Departamento").selectOption("E2E Gestão Azul");
  await expect(page.locator(".team-report-table tbody tr:visible")).toHaveCount(1);
  await expect(page.locator(".team-report-table")).toContainText("Pessoa Relatório Azul");
  await expect(page.locator(".team-report-table")).not.toContainText("Pessoa Relatório Verde");
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.reportPrintCalled = "true"; }; });
  await page.getByRole("button", { name: "Salvar em PDF" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.reportPrintCalled)).toBe("true");

  const verifyPdf = async (kind: string) => {
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".team-report-print")).toBeVisible();
    const pdf = await page.pdf({ format: "A4", landscape: true, printBackground: true });
    expect(pdf.length, `${kind} não pode gerar PDF vazio`).toBeGreaterThan(4000);
    writeFileSync(testInfo.outputPath(`report-${kind}.pdf`), pdf);
    await page.emulateMedia({ media: "screen" });
  };
  const verifyCsv = async (expected: string) => {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar CSV" }).click();
    const download = await downloadPromise;
    const csv = readFileSync(await download.path(), "utf8");
    expect(csv).toContain(expected);
    expect(csv).toContain("Pessoa Relatório Azul");
    expect(csv).not.toContain("Pessoa Relatório Verde");
  };

  await verifyPdf("overview");
  await verifyCsv("Progresso geral (%)");

  await page.getByRole("button", { name: /Cursos Andamento/ }).click();
  await page.getByRole("combobox", { name: "Curso", exact: true }).selectOption(courseId);
  await expect(page.locator(".team-report-table")).toContainText("Curso E2E Relatório");
  await verifyPdf("courses");
  await verifyCsv("Aulas concluídas");

  await page.getByRole("button", { name: /Avaliações Notas/ }).click();
  await expect(page.locator(".team-report-table")).toContainText("Bom resultado");
  await verifyPdf("assessments");
  await verifyCsv("Acertos");

  await page.getByRole("button", { name: /Presença Último acesso/ }).click();
  await expect(page.locator(".team-report-table")).toContainText("3");
  await page.getByLabel("Período de presença").selectOption("30");
  await expect(page.locator(".team-report-table thead")).toContainText("30 dias");
  await verifyPdf("presence");
  await verifyCsv("Dias com acesso (30 dias)");

  await page.getByLabel("Progresso geral").selectOption("completed");
  await expect(page.getByRole("button", { name: "Salvar em PDF" })).toBeDisabled();

  await page.getByLabel("Progresso geral").selectOption("all");
  await page.getByLabel("Departamento").selectOption("E2E Gestão Muitos");
  await page.getByLabel("Colaborador").selectOption("report-batch-1");
  await expect(page.locator(".team-report-table tbody tr:visible")).toHaveCount(1);
  await page.getByLabel("Colaborador").selectOption("all");
  await expect(page.locator(".team-report-table tbody tr:visible")).toHaveCount(20);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".team-report-table tbody tr:visible")).toHaveCount(21);
  if (await page.locator(".toast").count()) await expect(page.locator(".toast")).toBeHidden();
  const allRowsPdf = await page.pdf({ format: "A4", landscape: true, printBackground: true });
  expect(allRowsPdf.length).toBeGreaterThan(4000);
  writeFileSync(testInfo.outputPath("report-all-rows.pdf"), allRowsPdf);
  await page.emulateMedia({ media: "screen" });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar CSV" }).click();
  const download = await downloadPromise;
  const csv = readFileSync(await download.path(), "utf8");
  expect(csv.split("\r\n")).toHaveLength(22);
  expect(csv).toContain("Pessoa Relatório 21");

  await page.evaluate(() => {
    const overlay = document.createElement("div");
    overlay.className = "cert-modal-overlay";
    overlay.innerHTML = '<div class="cert-modal-dialog"><div class="certificate-frame">Certificado E2E</div></div>';
    document.body.append(overlay);
  });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".certificate-frame")).toBeVisible();
  await expect(page.locator(".team-report-print")).toBeHidden();
});
