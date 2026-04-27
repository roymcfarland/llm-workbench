import { WORKBENCH_PROTOCOL_VERSION } from "@llm-workbench/runtime";

import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const origin = await siteOrigin();
  const body = {
    name: "llm-workbench",
    version: WORKBENCH_PROTOCOL_VERSION,
    description:
      "Drive LLM Workbench runs (start, list, get, write artifact, resolve gate, export bundle) over MCP.",
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
        description: "Return a full RunBundle for a runId",
      },
      {
        name: "start_run",
        description: "Start a new run from a workflow id",
      },
      {
        name: "resolve_gate",
        description: "Resolve a human gate",
      },
      {
        name: "write_artifact",
        description: "Write or patch a typed artifact",
      },
      {
        name: "export_bundle",
        description: "Return a tamper-evident RunBundle JSON",
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
