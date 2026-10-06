import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const config = parseEnv(readFileSync(new URL("../.env.homologacao.local", import.meta.url), "utf8"));
Object.assign(process.env, config);
await import("./assert-e2e-isolation.mjs");
const vercelCli = process.env.VERCEL_CLI_PATH;
if (!vercelCli) throw new Error("Set VERCEL_CLI_PATH to the installed Vercel CLI entry point");
const repo = "DanielJS1/academia-demaria";
const team = "team_8pTgAcqf4KxlqPkgNmWR2oLs";
function run(binary, args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    // Values are supplied through stdin and never printed in logs or command lines.
    child.stdout.resume(); child.stderr.resume();
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(`Configuration failed: ${args.slice(0, 3).join(" ")} (exit ${code})`)));
    child.stdin.end(input);
  });
}
await run("gh", ["api", `repos/${repo}/environments/homologacao`, "--method", "PUT"]);
for (const [key, value] of Object.entries(config)) {
  if (key === "E2E_BASE_URL") continue;
  if (key.endsWith("COURSE_ID")) await run("gh", ["variable", "set", key, "--repo", repo, "--env", "homologacao", "--body", value]);
  else await run("gh", ["secret", "set", key, "--repo", repo, "--env", "homologacao"], value);
  console.log(`GitHub homologacao: ${key} configured`);
}
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_APP_ENV"]) {
  await run(process.execPath, [vercelCli, "env", "add", key, "preview", "--project", "academia-demaria", "--scope", team, "--force", "--yes", key === "SUPABASE_SERVICE_ROLE_KEY" ? "--sensitive" : "--no-sensitive"], config[key]);
  console.log(`Vercel preview: ${key} configured`);
}
console.log("Homologacao configuration completed. Production environment variables were not changed.");
