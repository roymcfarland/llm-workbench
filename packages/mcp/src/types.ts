import type { RunRepository } from "@llm-workbench/runtime";

/**
 * Options accepted by {@link createWorkbenchMcpServer}.
 *
 * The package is intentionally transport-agnostic: callers wire any
 * `RunRepository` implementation (Memory, HTTP, Supabase, …) and the server
 * exposes a fixed surface of LLM Workbench tools and resources over MCP.
 */
export type CreateWorkbenchMcpServerOptions = {
  /**
   * Persistence port the server reads from. Calls to `list_runs`, `get_run`,
   * and the `runs://` resources are dispatched here.
   *
   * Auth/tenant scoping is the host's responsibility — pass a repository that
   * is already scoped to the caller's tenant.
   */
  runRepository: RunRepository;

  /**
   * Optional override for resource listing. When omitted, the server lists
   * resources by calling `runRepository.list()` and emitting one
   * `runs://{runId}` URI per saved run.
   *
   * Useful when the host can produce ids cheaper than a full `list()` (e.g. a
   * Postgres view that only fetches `id`).
   */
  listRunIds?: () => Promise<string[]>;

  /**
   * MCP server name advertised on initialize. Defaults to `"llm-workbench"`.
   */
  name?: string;

  /**
   * MCP server version advertised on initialize. Defaults to the runtime's
   * `WORKBENCH_PROTOCOL_VERSION`.
   */
  version?: string;
};
