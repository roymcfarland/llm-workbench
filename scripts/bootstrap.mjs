#!/usr/bin/env node
// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: Apache-2.0
//
// `npm run bootstrap` — one-command provisioner for the LLM Workbench
// hosted reference plane (apps/web). Replaces the manual checklist in
// `apps/web/DEPLOY.md`.
//
// Two execution paths:
//
//   MCP path (recommended; default when MCP=1 or --mcp):
//     The script never calls MCP tools directly (Node can't). It emits
//     a structured plan file (.bootstrap-plan.json) and a copy-pasteable
//     prompt that a Cursor agent with the Vercel + Supabase + Clerk MCP
//     plugins executes on the user's behalf.
//
//   Token path (fallback):
//     Reads VERCEL_TOKEN, SUPABASE_ACCESS_TOKEN, CLERK_API_KEY from the
//     environment and drives the public REST APIs directly. Missing
//     tokens produce structured errors with remediation hints, not crashes.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";
import process from "node:process";

import { parseArgs, helpText } from "./lib/args.mjs";
import { logger, fail, colors } from "./lib/log.mjs";
import { buildPlan, serializePlan } from "./lib/plan.mjs";
import { provisionSupabase } from "./lib/supabase.mjs";
import { provisionClerk } from "./lib/clerk.mjs";
import { provisionVercel } from "./lib/vercel.mjs";
import { extractTokens, perTokenStatus, requiredTokenError } from "./lib/tokens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolvePath(HERE, "..");
const MIGRATION_PATH = resolvePath(REPO_ROOT, "apps/web/supabase/migrations/0001_init.sql");

export async function main(argv = process.argv.slice(2), env = process.env) {
  const opts = parseArgs(argv);
  if (opts.help) {
    process.stdout.write(helpText() + "\n");
    return 0;
  }

  if (env.MCP === "1" && !opts.forceToken) opts.mcp = true;

  if (opts.mcp) {
    return runMcpPath(opts);
  }
  return runTokenPath(opts, env);
}

async function runMcpPath(opts) {
  const log = logger("plan");
  const plan = buildPlan(opts);
  const out = resolvePath(process.cwd(), opts.out);
  await writeFile(out, serializePlan(plan));
  log.ok(`wrote ${plan.steps.length}-step plan to ${out}`);
  log.info("paste the prompt below into a Cursor agent that has the Vercel + Supabase + Clerk MCP plugins enabled:");
  process.stdout.write("\n" + colors.bold("--- agent prompt ---") + "\n");
  process.stdout.write(plan.agentPrompt + "\n");
  process.stdout.write(colors.bold("--- end prompt ---") + "\n\n");
  log.note(`re-run with --supabase-project / --clerk-app / --vercel-project to regenerate an idempotent plan against existing resources.`);
  return 0;
}

async function runTokenPath(opts, env) {
  const tokens = extractTokens(env);
  const fatal = requiredTokenError(tokens);
  if (fatal) {
    return fail(fatal.message, { hint: fatal.hint });
  }

  for (const status of perTokenStatus(tokens)) {
    if (!status.present) {
      logger(status.key).warn(`${status.env} not set — skipping. ${status.manualHint}`);
    }
  }

  const supabaseLog = logger("supabase");
  const clerkLog = logger("clerk");
  const vercelLog = logger("vercel");

  let supabaseResult = null;
  let clerkResult = null;
  let vercelResult = null;

  if (tokens.supabase) {
    const sql = await readFile(MIGRATION_PATH, "utf8");
    supabaseResult = await provisionSupabase({
      token: tokens.supabase,
      options: opts,
      log: supabaseLog,
      migrationSql: sql,
    });
  }

  if (tokens.clerk) {
    clerkResult = await provisionClerk({
      token: tokens.clerk,
      options: opts,
      log: clerkLog,
    });
  }

  if (tokens.vercel) {
    if (!supabaseResult || !clerkResult) {
      vercelLog.warn("upstream provisioners skipped — Vercel env vars will be incomplete; finish them in the dashboard");
    }
    vercelResult = await provisionVercel({
      token: tokens.vercel,
      options: opts,
      envVars: collectEnvVars(opts, supabaseResult, clerkResult),
      log: vercelLog,
    });
  }

  printSummary({ opts, supabaseResult, clerkResult, vercelResult });
  return 0;
}

/**
 * Map provisioner outputs onto the env-var bindings the Vercel project
 * needs. Returned in stable order so logs and tests stay deterministic.
 */
export function collectEnvVars(opts, supabase, clerk) {
  const out = [];
  out.push(maybe("NEXT_PUBLIC_SUPABASE_URL", supabase?.projectUrl));
  out.push({
    key: "SUPABASE_SERVICE_ROLE_KEY",
    value: null,
    sensitive: true,
    note: "manually copy from https://supabase.com/dashboard → Project Settings → API",
  });
  out.push(maybe("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", clerk?.publishableKey));
  out.push({
    key: "CLERK_SECRET_KEY",
    value: clerk?.secretKey ?? null,
    sensitive: true,
    note: clerk?.secretKey ? null : "manually copy from https://dashboard.clerk.com/last-active?path=api-keys",
  });
  out.push({ key: "NEXT_PUBLIC_CLERK_SIGN_IN_URL", value: "/sign-in" });
  out.push({ key: "NEXT_PUBLIC_CLERK_SIGN_UP_URL", value: "/sign-up" });
  out.push({ key: "NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL", value: "/playground" });
  out.push({ key: "NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL", value: "/playground" });
  out.push({
    key: "NEXT_PUBLIC_SITE_ORIGIN",
    value: opts.siteOrigin ?? null,
    note: opts.siteOrigin ? null : "set after a Vercel domain is attached",
  });
  if (opts.aiGatewayKey) {
    out.push({ key: "AI_GATEWAY_API_KEY", value: opts.aiGatewayKey, sensitive: true });
  }
  return out.filter(Boolean);
}

function maybe(key, value) {
  return { key, value: value ?? null };
}

function printSummary(ctx) {
  const { opts, supabaseResult, clerkResult, vercelResult } = ctx;
  const log = logger("summary");
  const productionUrl = vercelResult?.productionUrl ?? opts.siteOrigin ?? "(set NEXT_PUBLIC_SITE_ORIGIN after attaching a domain)";

  process.stdout.write("\n" + colors.bold("=== bootstrap summary ===") + "\n");
  process.stdout.write(`Production URL : ${productionUrl}\n`);
  process.stdout.write(`Supabase       : ${supabaseResult?.projectRef ?? "(skipped)"}\n`);
  process.stdout.write(`Clerk          : ${clerkResult?.applicationId ?? "(skipped)"}\n`);
  process.stdout.write(`Vercel project : ${vercelResult?.projectName ?? "(skipped)"}\n`);

  process.stdout.write("\n" + colors.bold("Smoke tests:") + "\n");
  for (const t of [
    { method: "GET", path: "/" },
    { method: "GET", path: "/llms.txt" },
    { method: "GET", path: "/.well-known/mcp.json" },
    { method: "GET", path: "/api/openapi.json" },
    { method: "POST", path: "/api/mcp", body: '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' },
  ]) {
    const url = productionUrl?.startsWith?.("http") ? `${productionUrl}${t.path}` : t.path;
    process.stdout.write(`  ${t.method.padEnd(4)} ${url}${t.body ? ` -d '${t.body}'` : ""}\n`);
  }

  process.stdout.write("\n" + colors.bold("Dashboards:") + "\n");
  process.stdout.write(`  Supabase : ${supabaseResult?.projectRef ? `https://supabase.com/dashboard/project/${supabaseResult.projectRef}` : "https://supabase.com/dashboard"}\n`);
  process.stdout.write(`  Clerk    : ${clerkResult?.applicationId ? `https://dashboard.clerk.com/apps/${clerkResult.applicationId}` : "https://dashboard.clerk.com"}\n`);
  process.stdout.write(`  Vercel   : ${vercelResult?.projectId ? `https://vercel.com/dashboard` : "https://vercel.com/new"}\n`);

  process.stdout.write("\n" + colors.bold("Manual follow-up:") + "\n");
  process.stdout.write("  • Stripe billing          https://dashboard.stripe.com/  (manual until 0.6.0)\n");
  process.stdout.write("  • AI Gateway spend caps   https://vercel.com/dashboard/ai/usage\n");
  if (!supabaseResult || !clerkResult || !vercelResult) {
    process.stdout.write(colors.dim("\nOne or more steps were skipped. See `apps/web/DEPLOY.md` for the manual checklist.\n"));
  } else {
    log.ok("all three planes provisioned");
  }
}

const isMain = (() => {
  if (!process.argv[1]) return false;
  try {
    return resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMain) {
  main().then(
    (code) => process.exit(code ?? 0),
    (err) => {
      const message = err instanceof Error ? err.message : String(err);
      fail(message, { hint: "run with --help for usage" });
    },
  );
}
