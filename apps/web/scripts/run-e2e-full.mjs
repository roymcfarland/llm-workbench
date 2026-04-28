#!/usr/bin/env node
/**
 * Optional one-shot smoke: clean `.next`, `next build` with E2E env, then Playwright.
 * Port parsing must stay aligned with `e2e/listen-port.ts` (`parseListenPortFromEnv`).
 */
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PLAYWRIGHT_PORT = 3399;

function parseListenPortFromEnv(env) {
  const raw = (env.PLAYWRIGHT_WEB_PORT ?? "").trim();
  if (!raw) return DEFAULT_PLAYWRIGHT_PORT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 65535) return DEFAULT_PLAYWRIGHT_PORT;
  return n;
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appsWeb = dirname(scriptDir);

/**
 * On macOS/Linux, run under bash with a raised `ulimit -n` to avoid EMFILE during
 * `next build` / Playwright + `next start` (Next 16 opens many files).
 */
function runWithRaisedFdLimit(commandLine, options) {
  if (platform() === "win32") {
    return spawnSync(commandLine, { ...options, shell: true });
  }
  return spawnSync(
    "bash",
    ["-lc", `ulimit -n 65536 2>/dev/null; exec ${commandLine}`],
    options,
  );
}

const port = parseListenPortFromEnv(process.env);
const origin = `http://127.0.0.1:${port}`;
const clerkPk =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  "pk_test_ZXhhbXBsZS5hY2NvdW50cy5kZXYk";
const clerkSk =
  process.env.CLERK_SECRET_KEY ??
  "sk_test_dGVzdCUyMF9zZWNyZXRfa2V5X2Zvcl9lMmU";

const env = {
  ...process.env,
  PLAYWRIGHT_WEB_PORT: String(port),
  NEXT_PUBLIC_SITE_ORIGIN: origin,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPk,
  CLERK_SECRET_KEY: clerkSk,
  HOST: "127.0.0.1",
  HOSTNAME: "127.0.0.1",
};

const nextDir = join(appsWeb, ".next");
if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true });
  console.log("[e2e-full] removed", nextDir);
}

const build = runWithRaisedFdLimit("npm run build", {
  cwd: appsWeb,
  env,
  stdio: "inherit",
});

if ((build.status ?? 1) !== 0) {
  process.exit(build.status ?? 1);
}

const test = spawnSync("node", ["./scripts/run-playwright-e2e.mjs"], {
  cwd: appsWeb,
  env,
  stdio: "inherit",
});

process.exit(test.status ?? 1);
