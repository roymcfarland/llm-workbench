#!/usr/bin/env node
/**
 * Builds the app, serves `next start` on LIGHTHOUSE_PORT, runs Lighthouse on `/`,
 * prints category scores, and writes JSON plus LIGHTHOUSE.md under `reports/`.
 *
 * Loads `apps/web/.env.local` when present. If Clerk vars are unset, falls back to the
 * same harmless test shapes as Playwright/E2E (see `e2e/env.ts`). Not for production.
 */

import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(__dirname, "..");
const REPORTS_DIR = join(WEB_ROOT, "reports");
const PORT = process.env.LIGHTHOUSE_PORT ?? "47821";
/** Prefer `localhost` — matches Next's bind + Host header expectations (avoid root 404 vs 127.0.0.1). */
const HOST = process.env.LIGHTHOUSE_HOST ?? "localhost";
const ORIGIN = `http://${HOST}:${PORT}`;
const HEALTH_URL = `${ORIGIN}/api/health`;

/** Mirrors `apps/web/e2e/env.ts` so `next build`/`next start` can satisfy Clerk SSR. */
const E2E_CLERK_PUBLISHABLE_FALLBACK =
  "pk_test_ZXhhbXBsZS5hY2NvdW50cy5kZXYk";
const E2E_CLERK_SECRET_FALLBACK =
  "sk_test_dGVzdCUyMF9zZWNyZXRfa2V5X2Zvcl9lMmU";

/**
 * Minimal KEY=VALUE reader (quotes + `#` comments). Does not shell-expand variables.
 */
function parseDotEnv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();

    const q = val[0];
    const quoted = q === '"' || q === "'";
    if (quoted && val.length >= 2 && val.endsWith(q)) {
      val = val.slice(1, -1);
    } else {
      val = val.replace(/\s+#.*$/u, "").trim();
    }

    if (key) out[key] = val;
  }
  return out;
}

function loadDotEnv(path) {
  try {
    if (!existsSync(path)) return {};
    return parseDotEnv(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function lighthouseEnv() {
  const fromLocal = {
    ...loadDotEnv(join(WEB_ROOT, ".env.local")),
    ...loadDotEnv(join(WEB_ROOT, ".env.production.local")),
  };

  const base = { ...process.env, ...fromLocal };

  const clerkPk =
    base.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ||
    E2E_CLERK_PUBLISHABLE_FALLBACK;
  const clerkSk =
    base.CLERK_SECRET_KEY?.trim() || E2E_CLERK_SECRET_FALLBACK;

  return {
    ...base,
    NODE_ENV: "production",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPk,
    CLERK_SECRET_KEY: clerkSk,
    NEXT_PUBLIC_SITE_ORIGIN: base.NEXT_PUBLIC_SITE_ORIGIN?.trim() || ORIGIN,
    NEXT_TELEMETRY_DISABLED: base.NEXT_TELEMETRY_DISABLED || "1",
    PORT,
  };
}

function buildEnvVars() {
  const e = lighthouseEnv();
  const { PORT: _drop, ...rest } = e;
  return rest;
}

const PAGE_URL = `${ORIGIN.replace(/\/$/, "")}/`;

const req = createRequire(import.meta.url);
const resolveNextCli = () =>
  join(dirname(req.resolve("next/package.json")), "dist", "bin", "next");

const resolveLighthouseCli = () =>
  join(dirname(req.resolve("lighthouse/package.json")), "cli/index.js");

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitUntilOk(url, maxMs = 120_000) {
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await wait(450);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function raceServerReady(childProcess) {
  return new Promise((_, reject) => {
    childProcess.once("exit", (code, signal) => {
      reject(
        new Error(
          `next start exited before READY (code=${code}, signal=${signal}). Is port ${PORT} free?`,
        ),
      );
    });
  });
}

function scoreAudit(audits, id) {
  const s = audits?.[id]?.score;
  if (typeof s !== "number") return "(n/a)";
  const display = audits[id]?.displayValue ?? audits[id]?.title ?? "";
  return `${Math.round(s * 100)}${display ? ` (${display})` : ""}`;
}

mkdirSync(REPORTS_DIR, { recursive: true });

const nextCli = resolveNextCli();
const lighthouseCli = resolveLighthouseCli();
if (!existsSync(nextCli)) {
  console.error("Missing Next CLI — run npm install first.");
  process.exit(1);
}
if (!existsSync(lighthouseCli)) {
  console.error(
    "Missing Lighthouse CLI — run npm install in apps/web (lighthouse devDependency).",
  );
  process.exit(1);
}

console.log("(1/4) npm run build …");
execFileSync("npm", ["run", "build"], {
  cwd: WEB_ROOT,
  stdio: "inherit",
  env: buildEnvVars(),
});

console.log("(2/4) next start (PORT=", PORT, ") …");

let stopped = false;
const spawnEnv = lighthouseEnv();

const child = spawn(process.execPath, [nextCli, "start"], {
  cwd: WEB_ROOT,
  stdio: "inherit",
  env: spawnEnv,
});

function stopServer() {
  if (stopped) return;
  stopped = true;
  try {
    child.kill("SIGTERM");
  } catch {
    /* ignore */
  }
}

process.on("SIGINT", () => {
  stopServer();
  process.exit(130);
});

try {
  await Promise.race([
    waitUntilOk(HEALTH_URL, 150_000),
    raceServerReady(child),
  ]);
  console.log("      Listening —", HEALTH_URL);

  console.log("(3/4) Lighthouse …");
  const jsonOut = join(REPORTS_DIR, "lighthouse.latest.json");
  execFileSync(
    process.execPath,
    [
      lighthouseCli,
      PAGE_URL,
      "--preset=desktop",
      "--quiet",
      "--ignore-status-code",
      "--output=json",
      `--output-path=${jsonOut}`,
      "--chrome-flags=--headless=new --no-sandbox --disable-setuid-sandbox",
    ],
    { cwd: WEB_ROOT, stdio: "inherit", env: process.env },
  );

  const raw = readFileSync(jsonOut, "utf8");
  const report = JSON.parse(raw);
  const cats = report.categories ?? {};
  const audits = report.audits ?? {};

  const lines = [
    "# Lighthouse snapshot (home `/`)",
    "",
    `Generated by \`npm run lighthouse:smoke\` (${new Date().toISOString()}).`,
    "",
    "## Category scores (0–100)",
    "",
    `- Performance — ${Math.round((cats.performance?.score ?? 0) * 100)}`,
    `- Accessibility — ${Math.round((cats.accessibility?.score ?? 0) * 100)}`,
    `- Best practices — ${Math.round((cats["best-practices"]?.score ?? 0) * 100)}`,
    `- SEO — ${Math.round((cats.seo?.score ?? 0) * 100)}`,
    "",
    "## Key audits",
    "",
    `- LCP — ${scoreAudit(audits, "largest-contentful-paint")}`,
    `- CLS — ${scoreAudit(audits, "cumulative-layout-shift")}`,
    `- FCP — ${scoreAudit(audits, "first-contentful-paint")}`,
    "",
    "Full JSON: `reports/lighthouse.latest.json`. This directory is gitignored.",
    "",
  ];

  const mdPath = join(REPORTS_DIR, "LIGHTHOUSE.md");
  writeFileSync(mdPath, lines.join("\n"), "utf8");

  console.log("(4/4) Wrote", jsonOut);
  console.log("       ", mdPath);
  console.log(
    "\nScores — Perf",
    Math.round((cats.performance?.score ?? 0) * 100),
  );
} finally {
  stopServer();
}
