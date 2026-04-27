// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: Apache-2.0
//
// Unit tests for the bootstrap script. We deliberately exercise the
// pure helpers (plan builder, token validation, env-var collection)
// rather than the network-driven provisioners — those are integration
// concerns and would need recorded fixtures to test responsibly.

import { describe, expect, it } from "vitest";

import { parseArgs } from "./lib/args.mjs";
import { buildPlan, serializePlan } from "./lib/plan.mjs";
import {
  extractTokens,
  listMissingTokens,
  perTokenStatus,
  requiredTokenError,
  TOKEN_ENV_VARS,
} from "./lib/tokens.mjs";
import { collectEnvVars } from "./bootstrap.mjs";

const DETERMINISTIC_OPTS = {
  region: "us-east-1",
  org: "demo-org",
  repo: "octo/llm-workbench",
};

describe("buildPlan", () => {
  it("matches the deterministic snapshot for a fresh install", () => {
    const plan = buildPlan(DETERMINISTIC_OPTS);
    expect(serializePlan(plan)).toMatchSnapshot();
  });

  it("emits 11 steps in fixed provider order", () => {
    const plan = buildPlan(DETERMINISTIC_OPTS);
    const ids = plan.steps.map((s) => s.id);
    expect(ids).toEqual([
      "supabase.create_project",
      "supabase.await_ready",
      "supabase.apply_migrations",
      "supabase.run_advisors",
      "supabase.fetch_keys",
      "clerk.create_application",
      "clerk.fetch_api_keys",
      "vercel.ensure_project",
      "vercel.set_env_vars",
      "vercel.trigger_deploy",
      "vercel.await_deploy",
    ]);
  });

  it("redacts ai-gateway-key in the captured options", () => {
    const plan = buildPlan({ ...DETERMINISTIC_OPTS, aiGatewayKey: "vck_secret" });
    expect(plan.options.aiGatewayKey).toBe("<redacted>");
  });

  it("includes the five smoke-test endpoints", () => {
    const plan = buildPlan(DETERMINISTIC_OPTS);
    expect(plan.smokeTests.map((t) => t.path)).toEqual([
      "/",
      "/llms.txt",
      "/.well-known/mcp.json",
      "/api/openapi.json",
      "/api/mcp",
    ]);
  });
});

describe("buildPlan idempotency", () => {
  it("marks create steps as skipped when refs are supplied", () => {
    const plan = buildPlan({
      ...DETERMINISTIC_OPTS,
      supabaseProject: "abcd1234",
      clerkApp: "app_xyz",
      vercelProject: "llm-workbench-web",
    });

    const skipped = plan.steps.filter((s) => s.skip).map((s) => s.id);
    expect(skipped).toEqual([
      "supabase.create_project",
      "supabase.await_ready",
      "clerk.create_application",
      "vercel.ensure_project",
    ]);

    const apply = plan.steps.find((s) => s.id === "supabase.apply_migrations");
    expect(apply?.skip).toBe(false);

    const setEnv = plan.steps.find((s) => s.id === "vercel.set_env_vars");
    expect(setEnv?.skip).toBe(false);
  });

  it("threads supplied refs into downstream step inputs", () => {
    const plan = buildPlan({
      ...DETERMINISTIC_OPTS,
      supabaseProject: "abcd1234",
      vercelProject: "p-existing",
    });
    const apply = plan.steps.find((s) => s.id === "supabase.apply_migrations");
    expect(apply?.inputs.project_ref).toBe("abcd1234");

    const setEnv = plan.steps.find((s) => s.id === "vercel.set_env_vars");
    expect(setEnv?.inputs.project_id).toBe("p-existing");
  });

  it("dashboard URLs reflect the supplied refs", () => {
    const plan = buildPlan({
      ...DETERMINISTIC_OPTS,
      supabaseProject: "abcd1234",
      clerkApp: "app_xyz",
      vercelProject: "p-existing",
    });
    expect(plan.dashboardUrls.supabase).toBe(
      "https://supabase.com/dashboard/project/abcd1234",
    );
    expect(plan.dashboardUrls.clerk).toBe("https://dashboard.clerk.com/apps/app_xyz");
    expect(plan.dashboardUrls.vercel).toBe("https://vercel.com/dashboard/p-existing");
  });
});

describe("token validation", () => {
  it("flags VERCEL_TOKEN, SUPABASE_ACCESS_TOKEN, CLERK_API_KEY as the canonical names", () => {
    expect(TOKEN_ENV_VARS.vercel).toBe("VERCEL_TOKEN");
    expect(TOKEN_ENV_VARS.supabase).toBe("SUPABASE_ACCESS_TOKEN");
    expect(TOKEN_ENV_VARS.clerk).toBe("CLERK_API_KEY");
  });

  it("returns null when at least one token is set", () => {
    expect(requiredTokenError({ vercel: "v_x", supabase: null, clerk: null })).toBeNull();
    expect(requiredTokenError({ vercel: null, supabase: "s_x", clerk: null })).toBeNull();
    expect(requiredTokenError({ vercel: null, supabase: null, clerk: "c_x" })).toBeNull();
  });

  it("returns a structured error when all tokens are missing", () => {
    const err = requiredTokenError({ vercel: null, supabase: null, clerk: null });
    expect(err).not.toBeNull();
    expect(err?.message).toMatch(/VERCEL_TOKEN/);
    expect(err?.message).toMatch(/SUPABASE_ACCESS_TOKEN/);
    expect(err?.message).toMatch(/CLERK_API_KEY/);
    expect(err?.hint).toMatch(/MCP=1/);
  });

  it("listMissingTokens names each absent env var", () => {
    expect(listMissingTokens({ vercel: null, supabase: "x", clerk: null })).toEqual([
      "VERCEL_TOKEN",
      "CLERK_API_KEY",
    ]);
  });

  it("perTokenStatus reports per-provider hints when missing", () => {
    const statuses = perTokenStatus({ vercel: null, supabase: "s", clerk: null });
    const byKey = Object.fromEntries(statuses.map((s) => [s.key, s]));
    expect(byKey.vercel.present).toBe(false);
    expect(byKey.vercel.manualHint).toMatch(/vercel\.com\/new/);
    expect(byKey.supabase.present).toBe(true);
    expect(byKey.clerk.present).toBe(false);
    expect(byKey.clerk.manualHint).toMatch(/dashboard\.clerk\.com/);
  });

  it("extractTokens reads only the canonical env vars", () => {
    const env = {
      VERCEL_TOKEN: "v",
      SUPABASE_ACCESS_TOKEN: "s",
      CLERK_API_KEY: "c",
      OTHER: "noise",
    };
    expect(extractTokens(env)).toEqual({ vercel: "v", supabase: "s", clerk: "c" });
  });
});

describe("collectEnvVars", () => {
  it("emits the eight Vercel env vars in canonical order with placeholders for unresolved values", () => {
    const vars = collectEnvVars(
      { siteOrigin: "https://workbench.example.com" },
      {
        projectUrl: "https://abc.supabase.co",
      },
      {
        publishableKey: "pk_live_x",
        secretKey: null,
      },
    );
    expect(vars.map((v) => v.key)).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
      "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
      "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
      "NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL",
      "NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL",
      "NEXT_PUBLIC_SITE_ORIGIN",
    ]);
    const serviceRole = vars.find((v) => v.key === "SUPABASE_SERVICE_ROLE_KEY");
    expect(serviceRole?.value).toBeNull();
    expect(serviceRole?.note).toMatch(/dashboard/);
    const secret = vars.find((v) => v.key === "CLERK_SECRET_KEY");
    expect(secret?.note).toMatch(/clerk\.com/);
  });

  it("appends AI_GATEWAY_API_KEY only when --ai-gateway-key is supplied", () => {
    const without = collectEnvVars({}, null, null);
    expect(without.find((v) => v.key === "AI_GATEWAY_API_KEY")).toBeUndefined();
    const withKey = collectEnvVars({ aiGatewayKey: "vck_x" }, null, null);
    const aig = withKey.find((v) => v.key === "AI_GATEWAY_API_KEY");
    expect(aig?.value).toBe("vck_x");
    expect(aig?.sensitive).toBe(true);
  });
});

describe("parseArgs", () => {
  it("parses flags and value pairs (both --k=v and --k v forms)", () => {
    const opts = parseArgs([
      "--mcp",
      "--supabase-project=abc",
      "--vercel-project",
      "p1",
      "--region=us-west-2",
      "--repo",
      "octo/llm-workbench",
    ]);
    expect(opts.mcp).toBe(true);
    expect(opts.supabaseProject).toBe("abc");
    expect(opts.vercelProject).toBe("p1");
    expect(opts.region).toBe("us-west-2");
    expect(opts.repo).toBe("octo/llm-workbench");
  });

  it("ignores unknown flags rather than throwing", () => {
    const opts = parseArgs(["--unknown-flag", "--mcp"]);
    expect(opts.mcp).toBe(true);
  });

  it("defaults to .bootstrap-plan.json", () => {
    expect(parseArgs([]).out).toBe(".bootstrap-plan.json");
  });
});
