import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) throw new Error("Defina E2E_BASE_URL para a implantação de staging antes de executar os testes E2E.");
const target = new URL(baseURL);
if (target.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(target.hostname)) {
  throw new Error("E2E_BASE_URL deve usar HTTPS (ou localhost para desenvolvimento).");
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: target.origin,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
