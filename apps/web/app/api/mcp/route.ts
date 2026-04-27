import { z } from "zod";

import {
  WorkbenchRuntime,
  type RunRepository,
  type RunStoreState,
  type SavedRunMeta,
} from "@llm-workbench/runtime";
import {
  createWorkbenchMcpHttpHandler,
  createWorkbenchMcpServer,
} from "@llm-workbench/mcp";

import { TenantAuthError, requireTenant } from "@/lib/auth/tenant";
import {
  deleteRunForTenant,
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

function toolError(message: string): ToolError {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Build a `RunRepository` view of the Supabase-backed runs table that is
 * already scoped to the caller's tenant. The reference deployment uses the
 * service-role key (which bypasses RLS), so this adapter is the single guard
 * that keeps tenant data isolated. Pair with `requireTenant()` upstream.
 */
function tenantRepository(tenantId: string): RunRepository {
  return {
    async list(opts) {
      return listRunsForTenant(tenantId, { limit: opts?.limit });
    },
    async load(runId): Promise<RunStoreState | null> {
      const row = await loadRunForTenant(tenantId, runId);
      if (!row) return null;
      return serializedToState(row.state);
    },
    async save(state) {
      await saveRunForTenant(tenantId, state);
    },
    async delete(runId) {
      await deleteRunForTenant(tenantId, runId);
    },
  };
}

async function buildHandler(tenantId: string): Promise<(req: Request) => Promise<Response>> {
  const repo = tenantRepository(tenantId);
  const server = createWorkbenchMcpServer({
    runRepository: repo,
    listRunIds: async () => {
      const metas = await listRunsForTenant(tenantId);
      return metas.map((m: SavedRunMeta) => m.id);
    },
  });

  // The package surface covers `list_runs`, `get_run`, `verify_run_integrity`,
  // and `validate_run_bundle`. The reference deployment also exposes a few
  // mutating tools that depend on the workflow registered at this route
  // (`jobSearchWorkflow`); keep them registered here so external embeddings
  // of the package don't have to ship workflow definitions they don't own.

  server.registerTool(
    "start_run",
    {
      description:
        "Start a new run from a workflow id. The reference deployment ships a single workflow: 'jobSearchWorkflow'.",
      inputSchema: { workflowId: z.literal("jobSearchWorkflow") },
    },
    async ({ workflowId }) => {
      try {
        if (workflowId !== "jobSearchWorkflow") {
          return notImplemented(
            `start_run only knows 'jobSearchWorkflow' in this reference deployment`,
          );
        }
        const rt = new WorkbenchRuntime();
        const { runId } = rt.startRun({
          workflow: jobSearchWorkflow,
          ruleSets: [initialRuleSet],
        });
        await repo.save(rt.getState(runId)!);
        return asJsonText({ runId, workflowId, status: "running" });
      } catch (e) {
        return toolError(e instanceof Error ? e.message : "start_run failed");
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
        const state = await repo.load(runId);
        if (!state) return toolError(`No run named ${runId}`);
        const rt = new WorkbenchRuntime();
        rt.importState(state);
        rt.session(runId).resolveGate({ stepId, gate, decision, note });
        await repo.save(rt.getState(runId)!);
        return asJsonText({ ok: true, runId, stepId, decision });
      } catch (e) {
        return toolError(e instanceof Error ? e.message : "resolve_gate failed");
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
        const state = await repo.load(runId);
        if (!state) return toolError(`No run named ${runId}`);
        const rt = new WorkbenchRuntime();
        rt.importState(state);
        const artifact = rt.session(runId).writeArtifact({
          artifactKey,
          typeId,
          data,
          idempotencyKey,
        });
        await repo.save(rt.getState(runId)!);
        return asJsonText({
          ok: true,
          runId,
          artifactKey: artifact.artifactKey,
          version: artifact.version,
        });
      } catch (e) {
        return toolError(e instanceof Error ? e.message : "write_artifact failed");
      }
    },
  );

  server.registerTool(
    "export_bundle",
    {
      description:
        "Return a tamper-evident RunBundle JSON for the run (full profile, with engine snapshot).",
      inputSchema: { runId: z.string().min(1) },
    },
    async ({ runId }) => {
      try {
        const state = await repo.load(runId);
        if (!state) return toolError(`No run named ${runId}`);
        const rt = new WorkbenchRuntime();
        rt.importState(state);
        const bundle = await rt.session(runId).exportRunBundle({ profile: "full" });
        return asJsonText(bundle);
      } catch (e) {
        return toolError(e instanceof Error ? e.message : "export_bundle failed");
      }
    },
  );

  return createWorkbenchMcpHttpHandler({ server });
}

async function handle(req: Request): Promise<Response> {
  let tenantId: string;
  try {
    ({ tenantId } = await requireTenant());
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    throw e;
  }
  const handler = await buildHandler(tenantId);
  return handler(req);
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
