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
  publicInternalErrorMessage,
  publicToolFailureMessage,
} from "@/lib/server/internal-error";
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

/** JSON-RPC payloads larger than this are rejected before parsing (DoS guard). */
const MAX_MCP_BODY_BYTES = 2 * 1024 * 1024;

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

/**
 * No-op `RunRepository` used while serving unauthenticated MCP discovery
 * requests (`initialize`, `tools/list`, `prompts/list`, `resources/list`,
 * `ping`, and protocol notifications). The McpServer registers tools and
 * resources eagerly; with this stub it can answer discovery without ever
 * touching tenant data.
 */
function emptyRepository(): RunRepository {
  return {
    async list() {
      return [];
    },
    async load() {
      return null;
    },
    async save() {
      // no-op; tools that need to write are gated behind auth.
    },
    async delete() {
      // no-op.
    },
  };
}

/**
 * JSON-RPC methods that MCP clients call before they know whether the server
 * requires auth. Per the MCP spec these MUST be reachable unauthenticated so
 * that headless agentic clients can discover the server's capabilities. We
 * still register the same tool surface for everyone — `tools/list` is just a
 * description; actual invocation goes through `tools/call` which requires
 * auth (see `methodNeedsAuth`).
 */
const PUBLIC_METHODS = new Set<string>([
  "initialize",
  "ping",
  "tools/list",
  "prompts/list",
  "resources/list",
  "resources/templates/list",
  "completion/complete",
]);

function methodNeedsAuth(method: unknown): boolean {
  if (typeof method !== "string") return false;
  // Notifications (no `id`, fire-and-forget) are always part of the
  // transport-level handshake; gating them would break `notifications/initialized`.
  if (method.startsWith("notifications/")) return false;
  return !PUBLIC_METHODS.has(method);
}

type JsonRpcMessage = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

function asMessages(parsed: unknown): JsonRpcMessage[] {
  if (Array.isArray(parsed)) return parsed as JsonRpcMessage[];
  if (parsed && typeof parsed === "object") return [parsed as JsonRpcMessage];
  return [];
}

function jsonRpcUnauthorized(messages: JsonRpcMessage[]): Response {
  // -32001 sits in the JSON-RPC "implementation-defined server error" range
  // (-32000..-32099). MCP clients surface the protocol-shaped error to the
  // caller; bare HTTP 401 would short-circuit them before they ever see it.
  const replies = messages.map((m) => ({
    jsonrpc: "2.0" as const,
    id: m && typeof m === "object" && "id" in m ? (m.id ?? null) : null,
    error: {
      code: -32001,
      message: "Unauthorized",
      data: { reason: "Authentication required for this MCP method" },
    },
  }));
  const body = replies.length === 1 ? replies[0] : replies;
  return new Response(JSON.stringify(body), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

async function buildHandler(
  repository: RunRepository,
): Promise<(req: Request) => Promise<Response>> {
  const server = createWorkbenchMcpServer({
    runRepository: repository,
    listRunIds: async () => {
      const metas = await repository.list();
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
        await repository.save(rt.getState(runId)!);
        return asJsonText({ runId, workflowId, status: "running" });
      } catch (e) {
        return toolError(
          publicToolFailureMessage("mcp:start_run", e, "start_run failed"),
        );
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
        const state = await repository.load(runId);
        if (!state) return toolError(`No run named ${runId}`);
        const rt = new WorkbenchRuntime();
        rt.importState(state);
        rt.session(runId).resolveGate({ stepId, gate, decision, note });
        await repository.save(rt.getState(runId)!);
        return asJsonText({ ok: true, runId, stepId, decision });
      } catch (e) {
        return toolError(
          publicToolFailureMessage("mcp:resolve_gate", e, "resolve_gate failed"),
        );
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
        const state = await repository.load(runId);
        if (!state) return toolError(`No run named ${runId}`);
        const rt = new WorkbenchRuntime();
        rt.importState(state);
        const artifact = rt.session(runId).writeArtifact({
          artifactKey,
          typeId,
          data,
          idempotencyKey,
        });
        await repository.save(rt.getState(runId)!);
        return asJsonText({
          ok: true,
          runId,
          artifactKey: artifact.artifactKey,
          version: artifact.version,
        });
      } catch (e) {
        return toolError(
          publicToolFailureMessage("mcp:write_artifact", e, "write_artifact failed"),
        );
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
        const state = await repository.load(runId);
        if (!state) return toolError(`No run named ${runId}`);
        const rt = new WorkbenchRuntime();
        rt.importState(state);
        const bundle = await rt.session(runId).exportRunBundle({ profile: "full" });
        return asJsonText(bundle);
      } catch (e) {
        return toolError(
          publicToolFailureMessage("mcp:export_bundle", e, "export_bundle failed"),
        );
      }
    },
  );

  return createWorkbenchMcpHttpHandler({ server });
}

/**
 * Resolve the repository to use for this request. Authenticated callers get a
 * tenant-scoped view; unauthenticated callers either get a no-op repository
 * (for protocol-level discovery methods) or a JSON-RPC `Unauthorized` error
 * envelope (for method calls that read or mutate tenant data).
 */
async function resolveRepository(
  needsAuth: boolean,
  messages: JsonRpcMessage[],
): Promise<{ repo: RunRepository } | { unauthorized: Response }> {
  try {
    const { tenantId } = await requireTenant();
    return { repo: tenantRepository(tenantId) };
  } catch (e) {
    if (!(e instanceof TenantAuthError)) throw e;
    if (needsAuth) {
      return { unauthorized: jsonRpcUnauthorized(messages) };
    }
    return { repo: emptyRepository() };
  }
}

async function handlePost(req: Request): Promise<Response> {
  const len = req.headers.get("content-length");
  if (len) {
    const n = Number(len);
    if (Number.isFinite(n) && n > MAX_MCP_BODY_BYTES) {
      return new Response(
        JSON.stringify({ error: "Payload too large" }),
        {
          status: 413,
          headers: { "content-type": "application/json" },
        },
      );
    }
  }

  const bodyText = await req.text();
  if (bodyText.length > MAX_MCP_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "Payload too large" }), {
      status: 413,
      headers: { "content-type": "application/json" },
    });
  }

  let parsed: unknown = undefined;
  try {
    parsed = bodyText.length > 0 ? JSON.parse(bodyText) : undefined;
  } catch {
    // Defer to the MCP transport's own JSON-RPC parse error. We just need to
    // not block the request on auth when we can't even read the method.
  }

  const messages = asMessages(parsed);
  // Conservative: if ANY message in the (legacy) batch needs auth, the whole
  // request is gated. Modern MCP (>= 2025-03-26) drops batches, so in practice
  // this is a single message.
  const needsAuth = messages.some((m) => methodNeedsAuth(m.method));

  const resolved = await resolveRepository(needsAuth, messages);
  if ("unauthorized" in resolved) return resolved.unauthorized;

  const handler = await buildHandler(resolved.repo);
  // Re-create the request because we already consumed its body. Web Standard
  // `Request` bodies are single-shot streams.
  const fresh = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: bodyText,
  });
  return handler(fresh);
}

async function handleNonPost(req: Request): Promise<Response> {
  // GET (SSE reconnect) and DELETE (terminate session) are protocol transport
  // operations that don't read tenant data. In stateless mode the SDK responds
  // with method-not-allowed / 405 anyway, so it's safe to wire a no-op repo.
  // Authenticated callers still get tenant-aware behavior if a future SDK
  // version starts honoring these verbs.
  let repo: RunRepository;
  try {
    const { tenantId } = await requireTenant();
    repo = tenantRepository(tenantId);
  } catch (e) {
    if (!(e instanceof TenantAuthError)) throw e;
    repo = emptyRepository();
  }
  const handler = await buildHandler(repo);
  return handler(req);
}

export async function GET(req: Request): Promise<Response> {
  try {
    return await handleNonPost(req);
  } catch (e) {
    const msg = publicInternalErrorMessage("api/mcp GET", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    return await handlePost(req);
  } catch (e) {
    const msg = publicInternalErrorMessage("api/mcp POST", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function DELETE(req: Request): Promise<Response> {
  try {
    return await handleNonPost(req);
  } catch (e) {
    const msg = publicInternalErrorMessage("api/mcp DELETE", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
