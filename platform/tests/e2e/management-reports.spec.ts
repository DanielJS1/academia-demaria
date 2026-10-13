import { readFileSync, writeFileSync } from "node:fs";
import { test, expect } from "./fixtures";
import { reportFixture } from "./report-fixtures.mjs";

test("seis visões exportam o mesmo recorte, gráficos e todas as linhas", async ({ gestor }, testInfo) => {
  const { page, token, userId } = gestor;
  const response = await page.request.get("/api/academy", { headers: { Authorization: `Bearer ${token}` } });
  expect(response.ok()).toBe(true);
  const payload = await response.json();
  const people = Array.from({ length: 32 }, (_, index) => ({ ...payload.state.people[0], id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, name: index === 0 ? 'José, "Suporte";\nLinha 2' : `Pessoa Relatório ${index + 1}`, managerId: userId, department: index % 2 ? "Financeiro" : "Suporte", status: "active", role: "student", audience: "internal" }));
  payload.state.people = people;
  await page.route("**/api/academy", route => route.request().method() === "GET" ? route.fulfill({ json: payload }) : route.continue());
  let lastDataset: ReturnType<typeof reportFixture> | undefined;
  let reportCalls = 0;
  await page.route("**/api/reports?*", route => {
    reportCalls++;
    lastDataset = reportFixture(JSON.parse(new URL(route.request().url()).searchParams.get("query")!), userId, payload.state);
    return route.fulfill({ json: lastDataset });
  });
  await page.goto("/equipe/relatorios");
  await expect(page.locator(".reports-table-section[aria-labelledby=report-table-title] .reports-data-table tbody tr")).toHaveCount(25);
  await page.evaluate(() => { window.print = () => { window.dispatchEvent(new Event("beforeprint")); }; });
  for (const [label, id] of [["Visão geral", "overview"], ["Presença", "presence"], ["Aprendizagem", "learning"], ["Desafios", "challenges"], ["Comunidade", "community"], ["XP", "xp"]]) {
    await page.getByRole("navigation", { name: "Visões dos relatórios" }).getByRole("link", { name: label, exact: true }).click();
    await expect.poll(() => lastDataset?.query.view).toBe(id);
    await expect(page.locator(".reports-table-section[aria-labelledby=report-table-title] .reports-data-table tbody tr")).toHaveCount(25);
    const calls = reportCalls, stamp = lastDataset!.meta.generatedAt;
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar CSV" }).click();
    const csv = readFileSync((await (await downloadPromise).path())!, "utf8");
    expect(csv.charCodeAt(0)).toBe(0xfeff); expect(csv).toContain(stamp); expect(csv).toContain('"total_registros"'); expect(csv).toContain(people[31].id);
    await page.getByRole("button", { name: "Salvar em PDF" }).click();
    await expect(page.locator(".reports-print-results tbody tr")).toHaveCount(32);
    await expect(page.locator(".reports-print-kpis article")).toHaveCount(await page.locator(".reports-kpis article").count());
    await expect(page.locator(".reports-print-document .reports-chart")).toHaveCount(await page.locator(".reports-charts > .reports-chart").count());
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".reports-print-document")).toBeVisible();
    writeFileSync(testInfo.outputPath(`report-${id}.pdf`), await page.pdf({ preferCSSPageSize: true, printBackground: true }));
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    expect(reportCalls).toBe(calls);
  }
  await page.getByRole("navigation", { name: "Visões dos relatórios" }).getByRole("link", { name: "Aprendizagem", exact: true }).click();
  await page.getByLabel("Análise", { exact: true }).selectOption("assessments");
  await expect(page.locator('.reports-table-section[aria-labelledby=report-table-title] .reports-data-table tbody tr')).toHaveCount(25);
  await expect(page.getByRole("region", { name: "Pontos de atenção nas avaliações" })).toBeVisible();
  await page.getByRole("navigation", { name: "Visões dos relatórios" }).getByRole("link", { name: "XP", exact: true }).click();
  await page.getByLabel("Departamento", { exact: true }).selectOption("suporte");
  await expect(page.locator(".reports-table-section[aria-labelledby=report-table-title] .reports-data-table tbody tr")).toHaveCount(16);
  await page.getByLabel("Colaborador", { exact: true }).selectOption(people[0].id);
  await expect(page.locator(".reports-table-section[aria-labelledby=report-table-title] .reports-data-table tbody tr")).toHaveCount(1);
  const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "Baixar CSV" }).click();
  const csv = readFileSync((await (await downloadPromise).path())!, "utf8");
  expect(csv).toContain(people[0].id); expect(csv).not.toContain(people[1].id);
  await page.getByRole("button", { name: "Salvar em PDF" }).click();
  await expect(page.locator(".reports-print-results tbody tr")).toHaveCount(1);
  await page.evaluate(() => {
    const overlay = document.createElement("div"); overlay.className = "cert-modal-overlay";
    overlay.innerHTML = '<div class="cert-modal-dialog"><div class="certificate-frame">Certificado E2E</div></div>';
    document.body.append(overlay);
  });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".certificate-frame")).toBeVisible();
  await expect(page.locator(".reports-print-document")).toBeHidden();
  writeFileSync(testInfo.outputPath("certificate-only.pdf"), await page.pdf({ preferCSSPageSize: true, printBackground: true }));
});
