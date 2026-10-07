import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const platform = fileURLToPath(new URL("../", import.meta.url));
const config = parseEnv(readFileSync(new URL("../.env.homologacao.local", import.meta.url), "utf8"));
Object.assign(process.env, config);
await import("./assert-e2e-isolation.mjs");
const git = (...args) => execFileSync("git", args, {cwd: root, encoding: "utf8"}).trim();
function clean() {
  if (git("diff", "HEAD", "--name-only", "--", ".", ":!platform/next-env.d.ts") || git("ls-files", "--others", "--exclude-standard"))
    throw new Error("Commit all implementation changes before validating the live gate");
}
clean();
const sha = git("rev-parse", "HEAD");
const repo = "DanielJS1/academia-demaria";
function status(state, description) {
  execFileSync("gh", ["api", `repos/${repo}/statuses/${sha}`, "--method", "POST",
    "-f", `state=${state}`, "-f", "context=Vimeo live (homologacao)", "-f", `description=${description}`,
    "-f", `target_url=https://github.com/${repo}/commit/${sha}`], {cwd: root, stdio: ["ignore", "ignore", "pipe"]});
}
status("pending", "Vimeo real: validando SDK, retomada e Supabase isolado");
const child = spawn(process.execPath, [fileURLToPath(new URL("run-homologacao.mjs", import.meta.url)),
  "e2e", "tests/e2e/video-resume.spec.ts", "--grep", "Vimeo live:", "--retries", "0"], {
  cwd: platform, env: {...process.env, E2E_VIMEO_MODE: "live"}, stdio: "inherit", windowsHide: true,
});
const code = await new Promise((resolve, reject) => {child.on("exit", resolve); child.on("error", reject);}).catch(() => 1);
let valid = code === 0;
try {clean(); if (git("rev-parse", "HEAD") !== sha) valid = false;} catch {valid = false;}
status(valid ? "success" : "failure", valid
  ? "Vimeo real passou: SDK + retomada + Auth/API/banco isolados"
  : "Vimeo real falhou ou checkout mudou; publicacao bloqueada");
console.log(`Vimeo live gate: ${valid ? "PASS" : "FAIL"} (${sha})`);
process.exitCode = valid ? 0 : 1;
