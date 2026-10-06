import { WORKBENCH_PROTOCOL_VERSION } from "@llm-workbench/runtime";

import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const origin = await siteOrigin();
  const body = {
    name: "llm-workbench",
    version: WORKBENCH_PROTOCOL_VERSION,
    description:
      "Drive LLM Workbench runs (start, list, get, verify integrity, validate bundle, write artifact, resolve gate, export bundle) over MCP.",
    transport: "streamable-http",
    endpoint: `${origin}/api/mcp`,
    auth: {
      type: "clerk-bearer",
      documentation: `${origin}/agents.md#authentication`,
    },
    tools: [
      {
        name: "list_runs",
        description: "Return SavedRunMeta[] for the caller's tenant",
      },
      {
        name: "get_run",
        description: "Return the serialized RunStoreState for a runId",
      },
      {
        name: "verify_run_integrity",
        description: "Verify a RunBundle's integrity.sha256 against its canonical JSON",
      },
      {
        name: "validate_run_bundle",
        description: "Validate a RunBundle's schema and structural invariants",
      },
      {
        name: "start_run",
        description: "Start a new run from jobSearchWorkflow (the only supported workflow id)",
      },
      {
        name: "resolve_gate",
        description: "Resolve a human gate for a step in a saved run",
      },
      {
        name: "write_artifact",
        description: "Write a typed artifact to a saved run",
      },
      {
        name: "export_bundle",
        description: "Return a tamper-evident, integrity-hashed RunBundle JSON (full profile, with engine snapshot)",
      },
    ],
  } as const;
  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}
