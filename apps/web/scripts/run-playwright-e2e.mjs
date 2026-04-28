#!/usr/bin/env node
/**
 * Runs Playwright with a raised file-descriptor limit on Unix (same idea as
 * `webServerStartCommand` in playwright.config.ts and `run-e2e-full.mjs`).
 */
import { spawnSync } from "node:child_process";
import { platform } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appsWeb = dirname(scriptDir);

const line = "npx playwright test";
const result =
  platform() === "win32"
    ? spawnSync(line, {
        cwd: appsWeb,
        env: process.env,
        stdio: "inherit",
        shell: true,
      })
    : spawnSync(
        "bash",
        ["-lc", `ulimit -n 65536 2>/dev/null; exec ${line}`],
        { cwd: appsWeb, env: process.env, stdio: "inherit" },
      );

process.exit(result.status ?? 1);
