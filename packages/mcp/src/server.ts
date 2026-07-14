import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  WORKBENCH_PROTOCOL_VERSION,
  WorkbenchRuntime,
  parseRunBundleJson,
  verifyRunBundleIntegrity,
} from "@llm-workbench/runtime";

import type { CreateWorkbenchMcpServerOptions } from "./types.js";

type ToolError = {
  content: [{ type: "text"; text: string }];
  isError: true;
};

function asJsonText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

function asError(message: string): ToolError {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/** Cap on serialized bundle size accepted by verify/validate tools (chars ≈ bytes for ASCII JSON). */
export const MAX_BUNDLE_JSON_CHARS = 25 * 1024 * 1024;

function safeBundleJson(bundle: unknown):
  | { ok: true; json: string }
  | { ok: false; error: string } {
  let json: string | undefined;
  try {
    json = JSON.stringify(bundle);
  } catch {
    return {
      ok: false,
      error: "bundle is not JSON-serializable (circular reference or unsupported value)",
    };
  }
  if (json === undefined) {
    return {
      ok: false,
      error: "bundle is not JSON-serializable (circular reference or unsupported value)",
    };
  }
  if (json.length > MAX_BUNDLE_JSON_CHARS) {
    return { ok: false, error: "bundle exceeds maximum size (25 MiB serialized)" };
  }
  return { ok: true, json };
}

/**
 * Build a transport-agnostic LLM Workbench MCP server.
 *
 * The returned {@link McpServer} exposes a fixed surface:
 *
 * **Tools**
 * - `list_runs({ limit? })` — `SavedRunMeta[]` from the supplied repository.
 * - `get_run({ runId })` — the serialized `RunStoreState` for `runId`.
 * - `verify_run_integrity({ bundle })` — `{ ok }` indicating whether the
 *   bundle's `integrity.sha256` matches its canonical content.
 * - `validate_run_bundle({ bundle })` — `{ ok }` (with `error` when invalid)
 *   from running the runtime's structural + schema validators.
 *
 * **Resources**
 * - `runs:` listing — every saved run as a `runs://{runId}` URI.
 * - `runs://{runId}` — the run's full `RunBundle` JSON (with attached
 *   integrity), suitable for replay or verification.
 *
 * The server is purely a request-response surface; it does not own a
 * transport. Wire it to a transport via {@link McpServer.connect}, or use
 * {@link createWorkbenchMcpHttpHandler} for an HTTP adapter.
 *
 * @param options Repository and optional metadata for the server.
 * @returns A transport-agnostic `McpServer` exposing the fixed tool/resource
 * surface described above.
 */
export function createWorkbenchMcpServer(
  options: CreateWorkbenchMcpServerOptions,
): McpServer {
  const { runRepository, listRunIds, name, version } = options;

  const server = new McpServer(
    {
      name: name ?? "llm-workbench",
      version: version ?? WORKBENCH_PROTOCOL_VERSION,
    },
    {
      capabilities: { tools: {}, resources: {} },
    },
  );

  server.registerTool(
    "list_runs",
    {
      description: "Return SavedRunMeta[] for the configured RunRepository.",
      inputSchema: {
        limit: z.number().int().min(1).max(500).optional(),
      },
    },
    async ({ limit }) => {
      try {
        const metas = await runRepository.list({ limit });
        return asJsonText(metas);
      } catch (e) {
        return asError(errorMessage(e, "list_runs failed"));
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
        const state = await runRepository.load(runId);
        if (!state) return asError(`No run named ${runId}`);
        return asJsonText(state);
      } catch (e) {
        return asError(errorMessage(e, "get_run failed"));
      }
    },
  );

  server.registerTool(
    "verify_run_integrity",
    {
      description:
        "Verify a RunBundle's `integrity.sha256` against its canonical JSON. Returns { ok: boolean }.",
      inputSchema: {
        bundle: z.unknown(),
      },
    },
    async ({ bundle }) => {
      try {
        const serialized = safeBundleJson(bundle);
        if (!serialized.ok) return asError(serialized.error);
        const parsed = parseRunBundleJson(serialized.json);
        const ok = await verifyRunBundleIntegrity(parsed);
        return asJsonText({ ok, sha256: parsed.integrity?.sha256 });
      } catch (e) {
        return asError(errorMessage(e, "verify_run_integrity failed"));
      }
    },
  );

  server.registerTool(
    "validate_run_bundle",
    {
      description:
        "Run the runtime's RunBundle schema + structural invariants against arbitrary JSON. Returns { ok } or { ok: false, error }.",
      inputSchema: {
        bundle: z.unknown(),
      },
    },
    async ({ bundle }) => {
      try {
        const serialized = safeBundleJson(bundle);
        if (!serialized.ok) return asJsonText({ ok: false, error: serialized.error });
        parseRunBundleJson(serialized.json);
        return asJsonText({ ok: true });
      } catch (e) {
        return asJsonText({ ok: false, error: errorMessage(e, "invalid bundle") });
      }
    },
  );

  // Resources -------------------------------------------------------------

  const resolveRunIds = async (): Promise<string[]> => {
    if (listRunIds) return listRunIds();
    const metas = await runRepository.list();
    return metas.map((m) => m.id);
  };

  server.registerResource(
    "runs",
    new ResourceTemplate("runs://{runId}", {
      list: async () => {
        const ids = await resolveRunIds();
        return {
          resources: ids.map((runId) => ({
            uri: `runs://${runId}`,
            name: runId,
            description: `LLM Workbench run bundle for ${runId}`,
            mimeType: "application/json",
          })),
        };
      },
    }),
    {
      description:
        "Tamper-evident RunBundle JSON for an individual saved run (full profile, with engine snapshot).",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const runId = String(variables.runId ?? "");
      if (!runId) {
        throw new Error(`Invalid runs:// URI: ${uri.toString()}`);
      }
      const state = await runRepository.load(runId);
      if (!state) {
        throw new Error(`No run named ${runId}`);
      }
      const rt = new WorkbenchRuntime();
      rt.importState(state);
      const bundle = await rt.session(runId).exportRunBundle({ profile: "full" });
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify(bundle, null, 2),
          },
        ],
      };
    },
  );

  return server;
}
