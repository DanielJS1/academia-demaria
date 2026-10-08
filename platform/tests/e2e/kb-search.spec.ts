import { test, expect } from "@playwright/test";

test("pesquisa da base preserva a página ao enviar, limpar e voltar", async ({ page }) => {
  await page.route("**/api/kb?*", async route => {
    const term = new URL(route.request().url()).searchParams.get("q") || "";
    await route.fulfill({ json: { results: [{ slug: "selo-pr", title: term ? `Busca: ${term}` : "Todos os artigos", summary: "Orientações de selagem", product: "DOC-Windows", category: "Procedimento", tags: ["selagem"], published_at: "2026-10-08T12:00:00Z", total: 1 }] } });
  });
  await page.goto("/bc");
  await expect(page.getByRole("link", { name: "Todos os artigos" })).toBeVisible();
  const documents: string[] = [];
  page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()); });
  const input = page.getByRole("searchbox", { name: "O que você precisa consultar?" });
  await input.fill(" selo ");
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await expect(page).toHaveURL(/\/bc\?q=selo$/);
  await expect(page.getByRole("link", { name: "Busca: selo" })).toBeVisible();
  await input.fill("FUNARPEN");
  await input.press("Enter");
  await expect(page.getByRole("link", { name: "Busca: FUNARPEN" })).toBeVisible();
  await page.goBack();
  await expect(input).toHaveValue("selo");
  await expect(page.getByRole("link", { name: "Busca: selo" })).toBeVisible();
  await input.fill("");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/bc$/);
  await expect(page.getByRole("link", { name: "Todos os artigos" })).toBeVisible();
  expect(documents).toEqual([]);
});
