import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import {
  WORKBENCH_PROTOCOL_VERSION,
  WorkbenchRuntime,
} from "@llm-workbench/runtime";

import { TenantAuthError, requireTenant } from "@/lib/auth/tenant";
import {
  listRunsForTenant,
  loadRunForTenant,
  saveRunForTenant,
  serializedToState,
} from "@/lib/supabase/runs-store";
import { initialRuleSet, jobSearchWorkflow } from "@/lib/workflow/job-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ToolError = {
  content: [{ type: "text"; text: string }];
  isError: true;
};

function unauthorized(): ToolError {
  return {
    content: [{ type: "text", text: "Unauthorized" }],
    isError: true,
  };
}

function notImplemented(reason: string): ToolError {
  return {
    content: [
      {
        type: "text",
        text: `${reason} — not yet implemented in this reference deployment; PRs welcome.`,
      },
    ],
    isError: true,
  };
}

function asJsonText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

async function buildServer(): Promise<McpServer> {
  const server = new McpServer(
    {
      name: "llm-workbench",
      version: WORKBENCH_PROTOCOL_VERSION,
    },
    {
      capabilities: { tools: {} },
    },
  );

  server.registerTool(
    "list_runs",
    {
      description: "Return SavedRunMeta[] for the caller's tenant.",
      inputSchema: {
        limit: z.number().int().min(1).max(500).optional(),
      },
    },
    async ({ limit }) => {
      try {
        const { tenantId } = await requireTenant();
        const metas = await listRunsForTenant(tenantId, { limit });
        return asJsonText(metas);
      } catch (e) {
        if (e instanceof TenantAuthError) return unauthorized();
        return {
          content: [
            { type: "text", text: e instanceof Error ? e.message : "list_runs failed" },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "get_run",
    {
      description: "Return the serialized RunStoreState for a runId.",
      inputSchema: {
        runId: z.string().min(1),
      },
    },
    async ({ runId }) => {
      try {
        const { tenantId } = await requireTenant();
        const row = await loadRunForTenant(tenantId, runId);
        if (!row) {
          return {
            content: [{ type: "text", text: `No run named ${runId}` }],
            isError: true,
          };
        }
        return asJsonText(row.state);
      } catch (e) {
        if (e instanceof TenantAuthError) return unauthorized();
        return {
          content: [
            { type: "text", text: e instanceof Error ? e.message : "get_run failed" },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "start_run",
    {
      description:
        "Start a new run from a workflow id. The reference deployment ships a single workflow: 'jobSearchWorkflow'.",
      inputSchema: {
        workflowId: z.literal("jobSearchWorkflow"),
      },
    },
    async ({ workflowId }) => {
      try {
        const { tenantId } = await requireTenant();
        if (workflowId !== "jobSearchWorkflow") {
          return notImplemented(
            `start_run only knows 'jobSearchWorkflow' in this reference deployment`,
          );
        }
        const runtime = new WorkbenchRuntime();
        const { runId } = runtime.startRun({
          workflow: jobSearchWorkflow,
          ruleSets: [initialRuleSet],
        });
        const state = runtime.getState(runId)!;
        await saveRunForTenant(tenantId, state);
        return asJsonText({ runId, workflowId, status: "running" });
      } catch (e) {
        if (e instanceof TenantAuthError) return unauthorized();
        return {
          content: [
            { type: "text", text: e instanceof Error ? e.message : "start_run failed" },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "resolve_gate",
    {
      description: "Resolve a human gate for a step.",
      inputSchema: {
        runId: z.string().min(1),
        stepId: z.string().min(1),
        gate: z.enum(["PAUSE_BEFORE", "PAUSE_AFTER", "CHECKPOINT"]),
        decision: z.enum(["approved", "rejected", "edited"]),
        note: z.string().optional(),
      },
    },
    async ({ runId, stepId, gate, decision, note }) => {
      try {
        const { tenantId } = await requireTenant();
        const row = await loadRunForTenant(tenantId, runId);
        if (!row) {
          return {
            content: [{ type: "text", text: `No run named ${runId}` }],
            isError: true,
          };
        }
        const state = serializedToState(row.state);
        const rt = new WorkbenchRuntime();
        rt.importState(state);
        const session = rt.session(runId);
        session.resolveGate({ stepId, gate, decision, note });
        const next = rt.getState(runId)!;
        await saveRunForTenant(tenantId, next);
        return asJsonText({ ok: true, runId, stepId, decision });
      } catch (e) {
        if (e instanceof TenantAuthError) return unauthorized();
        return {
          content: [
            { type: "text", text: e instanceof Error ? e.message : "resolve_gate failed" },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "write_artifact",
    {
      description: "Write a typed artifact to a run.",
      inputSchema: {
        runId: z.string().min(1),
        artifactKey: z.string().min(1),
        typeId: z.string().min(1),
        data: z.unknown(),
        idempotencyKey: z.string().optional(),
      },
    },
    async ({ runId, artifactKey, typeId, data, idempotencyKey }) => {
      try {
        const { tenantId } = await requireTenant();
        const row = await loadRunForTenant(tenantId, runId);
        if (!row) {
          return {
            content: [{ type: "text", text: `No run named ${runId}` }],
            isError: true,
          };
        }
        const state = serializedToState(row.state);
        const rt = new WorkbenchRuntime();
        rt.importState(state);
        const session = rt.session(runId);
        const artifact = session.writeArtifact({
          artifactKey,
          typeId,
          data,
          idempotencyKey,
        });
        const next = rt.getState(runId)!;
        await saveRunForTenant(tenantId, next);
        return asJsonText({
          ok: true,
          runId,
          artifactKey: artifact.artifactKey,
          version: artifact.version,
        });
      } catch (e) {
        if (e instanceof TenantAuthError) return unauthorized();
        return {
          content: [
            { type: "text", text: e instanceof Error ? e.message : "write_artifact failed" },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "export_bundle",
    {
      description:
        "Return a tamper-evident RunBundle JSON for the run (full profile, with engine snapshot).",
      inputSchema: {
        runId: z.string().min(1),
      },
    },
    async ({ runId }) => {
      try {
        const { tenantId } = await requireTenant();
        const row = await loadRunForTenant(tenantId, runId);
        if (!row) {
          return {
            content: [{ type: "text", text: `No run named ${runId}` }],
            isError: true,
          };
        }
        const state = serializedToState(row.state);
        const rt = new WorkbenchRuntime();
        rt.importState(state);
        const session = rt.session(runId);
        const bundle = await session.exportRunBundle({ profile: "full" });
        return asJsonText(bundle);
      } catch (e) {
        if (e instanceof TenantAuthError) return unauthorized();
        return {
          content: [
            { type: "text", text: e instanceof Error ? e.message : "export_bundle failed" },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}

async function handle(req: Request): Promise<Response> {
  // Stateless transport: every request spins up a transient server. This keeps
  // the route compatible with serverless / edge-style deployments.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = await buildServer();
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // Tear down so the per-request server isn't kept alive by lingering refs.
    await transport.close();
  }
}

export async function GET(req: Request): Promise<Response> {
  return handle(req);
}

export async function POST(req: Request): Promise<Response> {
  return handle(req);
}

export async function DELETE(req: Request): Promise<Response> {
  return handle(req);
}
