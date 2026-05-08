// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: LicenseRef-Proprietary
//
// Tiny dependency-free argv parser tailored for the bootstrap CLI.
// Supports `--flag`, `--flag=value`, and `--flag value`. Unknown flags
// are silently ignored so the script stays forward-compatible with
// wrappers that pass extra noise (e.g. npm's `--`).

const KNOWN_VALUE_FLAGS = new Set([
  "out",
  "supabase-project",
  "clerk-app",
  "vercel-project",
  "region",
  "org",
  "repo",
  "site-origin",
  "ai-gateway-key",
]);

const KNOWN_BOOL_FLAGS = new Set(["mcp", "help", "h", "force-token"]);

/**
 * Parse argv (the slice after `node script.mjs`) into a normalized
 * options object. Pure: no env access, no I/O.
 *
 * `env.MCP === "1"` is mapped to `mcp: true` by the caller, not here,
 * so this stays trivially testable.
 */
export function parseArgs(argv) {
  const out = {
    mcp: false,
    forceToken: false,
    help: false,
    out: ".bootstrap-plan.json",
    supabaseProject: null,
    clerkApp: null,
    vercelProject: null,
    region: "us-east-1",
    org: null,
    repo: null,
    siteOrigin: null,
    aiGatewayKey: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (typeof raw !== "string" || !raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    const name = (eq === -1 ? raw.slice(2) : raw.slice(2, eq)).trim();
    const inlineValue = eq === -1 ? null : raw.slice(eq + 1);

    if (KNOWN_BOOL_FLAGS.has(name)) {
      assignBool(out, name);
      continue;
    }
    if (!KNOWN_VALUE_FLAGS.has(name)) continue;

    const value = inlineValue !== null ? inlineValue : argv[++i];
    if (value === undefined) continue;
    assignValue(out, name, value);
  }

  if (argv.includes("-h")) out.help = true;
  return out;
}

function assignBool(out, name) {
  switch (name) {
    case "mcp":
      out.mcp = true;
      return;
    case "force-token":
      out.forceToken = true;
      return;
    case "help":
    case "h":
      out.help = true;
      return;
    default:
      // Unreachable because of KNOWN_BOOL_FLAGS membership check, but
      // exhaustive switch keeps lint happy.
      return;
  }
}

function assignValue(out, name, value) {
  switch (name) {
    case "out":
      out.out = value;
      return;
    case "supabase-project":
      out.supabaseProject = value;
      return;
    case "clerk-app":
      out.clerkApp = value;
      return;
    case "vercel-project":
      out.vercelProject = value;
      return;
    case "region":
      out.region = value;
      return;
    case "org":
      out.org = value;
      return;
    case "repo":
      out.repo = value;
      return;
    case "site-origin":
      out.siteOrigin = value;
      return;
    case "ai-gateway-key":
      out.aiGatewayKey = value;
      return;
    default:
      return;
  }
}

export function helpText() {
  return [
    "Usage: npm run bootstrap [-- <flags>]",
    "",
    "Provision the LLM Workbench hosted reference plane (apps/web).",
    "",
    "Recommended path (MCP):",
    "  Run inside a Cursor agent that has the Vercel + Supabase + Clerk MCP",
    "  plugins available. Set MCP=1 or pass --mcp; the script emits a",
    "  structured plan file the agent will execute.",
    "",
    "Fallback path (token):",
    "  Provide VERCEL_TOKEN, SUPABASE_ACCESS_TOKEN, and CLERK_API_KEY in the",
    "  environment. The script drives the public APIs directly.",
    "",
    "Flags:",
    "  --mcp                       Emit a plan file for an MCP-equipped agent.",
    "  --force-token               Force the token path even if MCP=1 is set.",
    "  --out <path>                Plan output path (default: .bootstrap-plan.json).",
    "  --supabase-project <ref>    Reuse an existing Supabase project ref.",
    "  --clerk-app <id>            Reuse an existing Clerk application id.",
    "  --vercel-project <name>     Reuse an existing Vercel project name.",
    "  --region <slug>             Supabase region (default: us-east-1).",
    "  --org <slug>                Supabase organisation slug (token path).",
    "  --repo <owner/name>         GitHub repo to import on Vercel.",
    "  --site-origin <url>         Override NEXT_PUBLIC_SITE_ORIGIN.",
    "  --ai-gateway-key <key>      Optional AI_GATEWAY_API_KEY (omit for OIDC).",
    "  -h, --help                  Show this message.",
  ].join("\n");
}
