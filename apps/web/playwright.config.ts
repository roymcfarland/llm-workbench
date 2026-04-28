import { createRequire } from "node:module";
import { platform } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { defineConfig, devices } from "@playwright/test";

import {
  E2E_CLERK_PUBLISHABLE_KEY,
  E2E_CLERK_SECRET_KEY,
  E2E_LISTEN_PORT,
  E2E_ORIGIN,
} from "./e2e/env";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const localhostLookupShim = path.join(
  rootDir,
  "scripts",
  "node-localhost-lookup-shim.mjs",
);

function appendNodeImportOption(
  existing: string | undefined,
  importTarget: string,
): string {
  const href = pathToFileURL(importTarget).href;
  const fragment = `--import=${href}`;
  const base = existing?.trim() ?? "";
  if (base.includes(href)) return base;
  return base ? `${base} ${fragment}` : fragment;
}

/**
 * Start Next without `npm run` so `NODE_OPTIONS` (DNS shim, ipv4first) reaches the same
 * Node process as `next start`. Resolve the CLI via `createRequire` so hoisted workspaces
 * (next under repo root) still work on CI.
 */
function webServerStartCommand(port: number): string {
  const nextCli = require.resolve("next/dist/bin/next");
  const portStr = String(port);
  const inner = `node ${JSON.stringify(nextCli)} start --hostname 127.0.0.1 --port ${portStr}`;
  if (platform() === "win32") {
    return inner;
  }
  return `bash -lc 'ulimit -n 65536 2>/dev/null; exec ${inner}'`;
}

/**
 * Variables for the child `next start` process. Keep string-only entries (Playwright typings).
 *
 * HOST/HOSTNAME reduce cases where tooling resolves `localhost` during smoke runs.
 *
 * LLM_WB_E2E_DNS_SHIM + NODE_OPTIONS preload rewrite `localhost` DNS to 127.0.0.1 so
 * Next.js 16's internal middleware→Node proxy (which targets `http://localhost:…`) does
 * not hit ENOTFOUND on machines with a broken `localhost` name.
 *
 * PLAYWRIGHT_WEB_PORT is echoed so `node` children see the same value as `./e2e/env.ts`.
 */
function webServerEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) out[k] = v;
  }
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || E2E_CLERK_PUBLISHABLE_KEY;
  const sk = process.env.CLERK_SECRET_KEY || E2E_CLERK_SECRET_KEY;

  Object.assign(out, {
    PLAYWRIGHT_WEB_PORT: String(E2E_LISTEN_PORT),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk,
    CLERK_SECRET_KEY: sk,
    NEXT_PUBLIC_SITE_ORIGIN: E2E_ORIGIN,
    HOST: "127.0.0.1",
    HOSTNAME: "127.0.0.1",
  });

  if (process.env.LLM_WB_E2E_DISABLE_DNS_SHIM !== "1") {
    out.LLM_WB_E2E_DNS_SHIM = "1";
    out.NODE_OPTIONS = appendNodeImportOption(
      out.NODE_OPTIONS,
      localhostLookupShim,
    );
  }

  return out;
}

export default defineConfig({
  testDir: path.join(rootDir, "e2e"),
  fullyParallel: true,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: E2E_ORIGIN,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer:
    process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1"
      ? undefined
      : {
          command: webServerStartCommand(E2E_LISTEN_PORT),
          cwd: rootDir,
          env: webServerEnv(),
          url: `${E2E_ORIGIN}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
});
