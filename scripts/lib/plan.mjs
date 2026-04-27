// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: Apache-2.0
//
// Pure plan-builder for the MCP path. The plan describes the operations
// a Cursor agent (with the Vercel + Supabase + Clerk MCP plugins
// available) should perform on the user's behalf. The Node script
// itself never calls MCP tools — it can't from inside a script.
//
// Shape mirrors the request/response patterns used by `@llm-workbench/mcp`:
// every step is a small, named, idempotent operation with explicit
// inputs and named outputs that downstream steps reference.

const PLAN_VERSION = 1;

const SMOKE_TESTS = [
  { method: "GET", path: "/", expect: 200, description: "Landing page renders" },
  { method: "GET", path: "/llms.txt", expect: 200, description: "LLM-friendly site map" },
  { method: "GET", path: "/.well-known/mcp.json", expect: 200, description: "MCP discovery doc" },
  { method: "GET", path: "/api/openapi.json", expect: 200, description: "OpenAPI 3.1 description" },
  {
    method: "POST",
    path: "/api/mcp",
    expect: 200,
    description: "MCP HTTP transport responds to tools/list",
    body: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
  },
];

const FOLLOW_UPS = [
  {
    title: "Stripe billing",
    href: "https://dashboard.stripe.com/",
    note: "Manual: connect a Stripe account once 0.6.0 multi-tenant billing lands.",
  },
  {
    title: "Vercel AI Gateway spend caps",
    href: "https://vercel.com/dashboard/ai/usage",
    note: "Manual: set per-tenant spend caps in the AI Gateway dashboard.",
  },
];

/**
 * Normalize and freeze the input options the plan was built from. We
 * intentionally drop `undefined` and any keys not part of the public
 * shape so the snapshot stays stable across runs.
 */
function normalizeOptions(input) {
  const o = input ?? {};
  return Object.freeze({
    supabaseProject: o.supabaseProject ?? null,
    clerkApp: o.clerkApp ?? null,
    vercelProject: o.vercelProject ?? null,
    region: o.region ?? "us-east-1",
    org: o.org ?? null,
    repo: o.repo ?? null,
    siteOrigin: o.siteOrigin ?? null,
    aiGatewayKey: o.aiGatewayKey ? "<redacted>" : null,
    rootDirectory: "apps/web",
    framework: "nextjs",
    migrationFile: "apps/web/supabase/migrations/0001_init.sql",
  });
}

function step(provider, action, description, opts) {
  const id = `${provider}.${action}`;
  const skip = Boolean(opts.skip);
  return {
    id,
    provider,
    action,
    description,
    inputs: opts.inputs ?? {},
    outputs: opts.outputs ?? [],
    skip,
    skipReason: skip ? opts.skipReason ?? null : null,
    suggestedTool: opts.suggestedTool ?? null,
  };
}

function supabaseSteps(o) {
  const reuse = Boolean(o.supabaseProject);
  return [
    step("supabase", "create_project", "Create the Supabase project (or reuse the supplied ref).", {
      inputs: {
        organization: o.org,
        region: o.region,
        name: "llm-workbench-web",
        existingRef: o.supabaseProject,
      },
      outputs: ["supabase.project_ref", "supabase.project_url"],
      skip: reuse,
      skipReason: reuse ? `existing project ref ${o.supabaseProject}` : null,
      suggestedTool: "plugin-supabase-supabase.create_project",
    }),
    step("supabase", "await_ready", "Poll project status until it leaves PROVISIONING.", {
      inputs: { project_ref: o.supabaseProject ?? "${supabase.project_ref}" },
      outputs: [],
      skip: reuse,
      skipReason: reuse ? "existing project assumed ready" : null,
      suggestedTool: "plugin-supabase-supabase.get_project_status",
    }),
    step("supabase", "apply_migrations", "Apply 0001_init.sql against the project's Postgres.", {
      inputs: {
        project_ref: o.supabaseProject ?? "${supabase.project_ref}",
        migration_file: "apps/web/supabase/migrations/0001_init.sql",
      },
      outputs: [],
      suggestedTool: "plugin-supabase-supabase.apply_migration",
    }),
    step("supabase", "run_advisors", "Run the security + performance advisors and surface findings.", {
      inputs: { project_ref: o.supabaseProject ?? "${supabase.project_ref}" },
      outputs: ["supabase.advisors"],
      suggestedTool: "plugin-supabase-supabase.get_advisors",
    }),
    step(
      "supabase",
      "fetch_keys",
      "Surface the project URL and ask the user to copy the service_role key from the dashboard. The Supabase API never returns service_role for security reasons.",
      {
        inputs: {
          project_ref: o.supabaseProject ?? "${supabase.project_ref}",
          dashboard_url: "https://supabase.com/dashboard/project/${supabase.project_ref}/settings/api",
        },
        outputs: ["supabase.service_role_key (manual)"],
        suggestedTool: "plugin-supabase-supabase.get_project_url",
      },
    ),
  ];
}

function clerkSteps(o) {
  const reuse = Boolean(o.clerkApp);
  return [
    step("clerk", "create_application", "Create a Clerk application (or reuse the supplied id).", {
      inputs: {
        name: "llm-workbench-web",
        existing_application_id: o.clerkApp,
      },
      outputs: ["clerk.application_id"],
      skip: reuse,
      skipReason: reuse ? `existing application id ${o.clerkApp}` : null,
      suggestedTool: "plugin-clerk-clerk.create_application",
    }),
    step("clerk", "fetch_api_keys", "Read the publishable key and secret key for the application.", {
      inputs: {
        application_id: o.clerkApp ?? "${clerk.application_id}",
        deep_link: "https://dashboard.clerk.com/last-active?path=api-keys",
      },
      outputs: ["clerk.publishable_key", "clerk.secret_key"],
      suggestedTool: "plugin-clerk-clerk.get_api_keys",
    }),
  ];
}

function envVarBindings(o) {
  return [
    { key: "NEXT_PUBLIC_SUPABASE_URL", from: "supabase.project_url", target: ["production", "preview", "development"] },
    { key: "SUPABASE_SERVICE_ROLE_KEY", from: "supabase.service_role_key", target: ["production", "preview", "development"], sensitive: true },
    { key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", from: "clerk.publishable_key", target: ["production", "preview", "development"] },
    { key: "CLERK_SECRET_KEY", from: "clerk.secret_key", target: ["production", "preview", "development"], sensitive: true },
    { key: "NEXT_PUBLIC_CLERK_SIGN_IN_URL", literal: "/sign-in", target: ["production", "preview", "development"] },
    { key: "NEXT_PUBLIC_CLERK_SIGN_UP_URL", literal: "/sign-up", target: ["production", "preview", "development"] },
    { key: "NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL", literal: "/playground", target: ["production", "preview", "development"] },
    { key: "NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL", literal: "/playground", target: ["production", "preview", "development"] },
    { key: "NEXT_PUBLIC_SITE_ORIGIN", from: o.siteOrigin ? "literal" : "vercel.production_url", literal: o.siteOrigin ?? null, target: ["production", "preview"] },
    ...(o.aiGatewayKey
      ? [{ key: "AI_GATEWAY_API_KEY", from: "options.aiGatewayKey", target: ["production", "preview", "development"], sensitive: true }]
      : []),
  ];
}

function vercelSteps(o) {
  const reuse = Boolean(o.vercelProject);
  return [
    step(
      "vercel",
      "ensure_project",
      "Import the GitHub repo as a Vercel project (or reuse the supplied name). Set Root Directory to apps/web and Framework to nextjs.",
      {
        inputs: {
          name: o.vercelProject ?? "llm-workbench-web",
          repo: o.repo,
          root_directory: "apps/web",
          framework: "nextjs",
          existing_project_name: o.vercelProject,
        },
        outputs: ["vercel.project_id", "vercel.production_url"],
        skip: reuse,
        skipReason: reuse ? `existing project ${o.vercelProject}` : null,
        suggestedTool: "plugin-vercel-plugin-vercel.create_project",
      },
    ),
    step(
      "vercel",
      "set_env_vars",
      "Push the environment variables produced by the Supabase + Clerk steps to the Vercel project (Production + Preview + Development).",
      {
        inputs: {
          project_id: o.vercelProject ?? "${vercel.project_id}",
          env_vars: envVarBindings(o),
        },
        outputs: [],
        suggestedTool: "plugin-vercel-plugin-vercel.upsert_env_vars",
      },
    ),
    step("vercel", "trigger_deploy", "Trigger a production deploy of the project.", {
      inputs: { project_id: o.vercelProject ?? "${vercel.project_id}" },
      outputs: ["vercel.deployment_id"],
      suggestedTool: "plugin-vercel-plugin-vercel.create_deployment",
    }),
    step(
      "vercel",
      "await_deploy",
      "Poll the deployment until status is READY (success) or ERROR/CANCELED (fail). Surface the build log URL on failure.",
      {
        inputs: { deployment_id: "${vercel.deployment_id}" },
        outputs: ["vercel.deployment_url", "vercel.deployment_state"],
        suggestedTool: "plugin-vercel-plugin-vercel.get_deployment",
      },
    ),
  ];
}

function buildAgentPrompt(o) {
  const lines = [
    "You are running inside Cursor with the Vercel, Supabase, and Clerk MCP",
    "plugins available. Execute the steps in `.bootstrap-plan.json` in order,",
    "honoring `skip: true` entries (just record the supplied id/ref). For each",
    "step, prefer the `suggestedTool` MCP tool, fall back to the closest",
    "equivalent your plugin exposes if the name has drifted. Capture every",
    "value listed in `outputs` and substitute `${name}` placeholders in",
    "downstream `inputs`.",
    "",
    "Sensitive secrets (service_role, secret keys) must be written directly",
    "to the Vercel env-vars step — never echo them into chat. service_role is",
    "not returned by the Supabase API; ask the user to paste it once when you",
    "reach `supabase.fetch_keys`.",
    "",
    "When `vercel.await_deploy` returns READY, run the smoke tests listed in",
    "`.bootstrap-plan.json` (`smokeTests` array) and print the production URL,",
    "the dashboard links from `dashboardUrls`, and any advisor warnings from",
    "`supabase.run_advisors`. Stop on the first non-200 smoke-test response.",
  ];
  if (o.repo) lines.push("", `GitHub repo: ${o.repo}`);
  if (o.org) lines.push(`Supabase org slug: ${o.org}`);
  return lines.join("\n");
}

/**
 * Build a fully-deterministic plan object from the supplied options.
 * No clocks, no random ids, no env reads — safe to snapshot.
 */
export function buildPlan(input) {
  const options = normalizeOptions(input);
  const steps = [...supabaseSteps(options), ...clerkSteps(options), ...vercelSteps(options)];

  return {
    version: PLAN_VERSION,
    options,
    steps,
    envVars: envVarBindings(options),
    smokeTests: SMOKE_TESTS,
    followUps: FOLLOW_UPS,
    dashboardUrls: {
      supabase: options.supabaseProject
        ? `https://supabase.com/dashboard/project/${options.supabaseProject}`
        : "https://supabase.com/dashboard/projects",
      clerk: options.clerkApp
        ? `https://dashboard.clerk.com/apps/${options.clerkApp}`
        : "https://dashboard.clerk.com/last-active?path=api-keys",
      vercel: options.vercelProject
        ? `https://vercel.com/dashboard/${options.vercelProject}`
        : "https://vercel.com/new",
      aiGateway: "https://vercel.com/dashboard/ai",
    },
    agentPrompt: buildAgentPrompt(options),
  };
}

/**
 * Stable JSON serializer for the plan. Two-space indent, sorted top-level
 * keys, deterministic ordering of nested arrays (because `buildPlan`
 * emits them in a fixed order). Used both by the writer and the test
 * snapshot so they stay in lockstep.
 */
export function serializePlan(plan) {
  return JSON.stringify(plan, null, 2) + "\n";
}

export { PLAN_VERSION, SMOKE_TESTS };
