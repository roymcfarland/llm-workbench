import { promises as fs } from "node:fs";
import path from "node:path";

import { WORKBENCH_PROTOCOL_VERSION } from "@llm-workbench/runtime";

import { GITHUB_URL, LICENSE_NAME, siteOrigin } from "@/lib/site";
import { PROTOCOL_OVERVIEW } from "@/lib/landing/protocol-prose";

export const dynamic = "force-dynamic";

const APP_README_FALLBACK = `# @llm-workbench/web

Hosted reference deployment for LLM Workbench. Next.js 16 App Router,
Tailwind v4, Clerk auth, Supabase persistence, AI SDK v5 routed through
Vercel AI Gateway.

Marketing & discoverability (auth optional): \`/\`, \`/blog\`, \`/docs/protocol\`,
\`/runs/demo\`, \`/feed.xml\`, \`/llms.txt\`, \`/robots.txt\`, \`/sitemap.xml\`, Open Graph
routes (\`/opengraph-image\`, \`/twitter-image\`). Authenticated shells: \`/playground\`,
\`/runs\` (middleware + Clerk). APIs: \`/api/openapi.json\`, \`/.well-known/mcp.json\`
(public discovery); \`/api/runs…\`, \`/api/llm\`, \`/api/mcp\` require credentials.
`;

const ROOT_README_FALLBACK = `# LLM Workbench

An open-source (MIT) control plane for LLM-powered products. Workflow state,
artifacts, rules, human review gates, trace history, model I/O, cost
telemetry, import/export, and replay. Protocol v${WORKBENCH_PROTOCOL_VERSION}.
MIT licensed — free to use, modify, and distribute.
`;

const TRACE_EVENT_REFERENCE = `# Trace event reference

Every observable runtime fact is one of these typed events. The discriminated
union is the authoritative contract — host code should validate against
\`TraceEventSchema\` before persistence. All events carry \`id\`, \`runId\`,
\`ts\`, optional \`stepId\`, optional \`correlationId\`.

- \`step_started\` — a workflow step has started executing.
- \`step_completed\` — a step finished; \`ok: boolean\` plus optional \`error\`.
- \`artifact_written\` — a new artifact version was written (full replacement).
- \`artifact_patch\` — an artifact was advanced via RFC 6902 JSON Patch ops.
- \`model_io\` — a model call (\`request\`, \`response\`, or \`stream_chunk\`) with optional provider, model, usage, cost, durationMs, summary, and a redacted payload.
- \`tool_call\` — a tool was invoked, with arguments and result.
- \`human_gate_requested\` — runtime is paused waiting for a human decision (PAUSE_BEFORE | PAUSE_AFTER | CHECKPOINT).
- \`human_gate_resolved\` — a human delivered a decision (\`approved\`, \`rejected\`, \`edited\`) plus an optional note.
- \`rule_changed\` — a rule set was updated; the snapshot is embedded.
- \`policy_changed\` — a step's gate policy was overridden mid-run.
- \`error\` — a structured error with optional code and \`fatal\` flag.
- \`run_forked\` — the run was branched off another run (\`parentRunId\`).
- \`annotation\` — free-text human annotation with optional tags.
- \`run_status_changed\` — terminal transitions: \`completed\`, \`failed\`, \`cancelled\`.
- \`span_started\` / \`span_ended\` — hierarchical spans modeled after OpenTelemetry GenAI semconv; convertible to OTel via \`traceEventsToOtelSpans\`.
`;

const PROGRAMMATIC_ACCESS = `# Driving the workbench programmatically

Two surfaces expose the runtime over the network:

## REST (\`/api/runs\` and \`/api/runs/{runId}\`)

- \`GET /api/runs?limit=N\` returns \`SavedRunMeta[]\` for the caller's tenant.
- \`GET /api/runs/{runId}\` returns the serialized \`RunStoreState\` (the same wire format \`HttpRunRepository\` produces).
- \`PUT /api/runs/{runId}\` persists a serialized state. Body limit is 25 MB. Validates structural invariants and rejects \`state.run.id !== runId\`.
- \`DELETE /api/runs/{runId}\` removes a run.
- All responses carry \`Link: </api/openapi.json>; rel="describedby"\`.
- Auth is Clerk-based: the request must carry a session cookie (or a Clerk bearer token in production deployments). Tenants are derived as \`orgId ?? "user:" + userId\`.

The full schema lives at \`/api/openapi.json\` (OpenAPI 3.1).

## MCP (\`/api/mcp\`)

A Streamable HTTP MCP endpoint registers:

- Core (\`@llm-workbench/mcp\`): \`list_runs\`, \`get_run\`, \`verify_run_integrity\`, \`validate_run_bundle\`.
- Reference app additions: \`start_run\`, \`resolve_gate\`, \`write_artifact\`, \`export_bundle\` (full-profile tamper-evident bundle).

Discovery via \`/.well-known/mcp.json\`. Resources expose \`runs://{runId}\` bundle URIs — see \`packages/mcp/README.md\`.

HTML crawlers and link previews do not carry Clerk sessions. Middleware explicitly allows OG/Twitter metadata image routes (\`/opengraph-image\`, \`/twitter-image\`) and marketing paths; tenant APIs and MCP stay behind auth (\`robots.txt\` \`Disallow\` on private APIs for crawl-budget hygiene).

## Error model

Errors are JSON: \`{ "error": "<human message>", "code": "<optional canonical code>" }\`. Status codes follow standard REST conventions: \`400\` invalid body, \`401\` missing session, \`404\` unknown run, \`413\` body too large, \`500\` for unexpected failures.

## Rate limits

No rate limits are enforced in this reference deployment. Production
deployments must add a per-tenant limiter at the API or MCP layer before
exposing this surface to untrusted clients.
`;

async function readWithFallback(filePath: string, fallback: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return fallback;
  }
}

export async function GET(): Promise<Response> {
  const origin = await siteOrigin();
  const cwd = process.cwd();

  // The Next.js process cwd is `apps/web` in dev and the deployed bundle
  // root in production. Fall back to embedded constants when the on-disk
  // README is not reachable (e.g. read-only Vercel filesystem after build).
  const [appReadme, rootReadme] = await Promise.all([
    readWithFallback(path.join(cwd, "README.md"), APP_README_FALLBACK),
    readWithFallback(path.join(cwd, "..", "..", "README.md"), ROOT_README_FALLBACK),
  ]);

  const body = [
    `# llms-full.txt — LLM Workbench (protocol v${WORKBENCH_PROTOCOL_VERSION})`,
    "",
    `Canonical site: ${origin}`,
    `Source: ${GITHUB_URL}`,
    `License: ${LICENSE_NAME}`,
    "",
    "---",
    "",
    "## App README",
    "",
    appReadme.trim(),
    "",
    "---",
    "",
    "## Project README",
    "",
    rootReadme.trim(),
    "",
    "---",
    "",
    PROTOCOL_OVERVIEW.trim(),
    "",
    "---",
    "",
    PROGRAMMATIC_ACCESS.trim(),
    "",
    "---",
    "",
    TRACE_EVENT_REFERENCE.trim(),
    "",
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
