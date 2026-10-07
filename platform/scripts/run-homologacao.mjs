import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
Object.assign(process.env, parseEnv(readFileSync(resolve(root, ".env.homologacao.local"), "utf8")));
await import("./assert-e2e-isolation.mjs");
const [mode = "dev", ...extra] = process.argv.slice(2);
const args = mode === "e2e" ? [resolve(root, "node_modules/@playwright/test/cli.js"), "test", ...extra]
  : mode === "dev" ? [resolve(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "4174"]
  : mode === "build" ? [resolve(root, "node_modules/next/dist/bin/next"), "build", "--webpack"] : null;
if (!args) throw new Error("Use dev, build or e2e");
const child = spawn(process.execPath, args, { cwd: root, env: process.env, stdio: "inherit", windowsHide: true });
child.on("exit", code => process.exit(code ?? 1));
