/**
 * `@llm-workbench/mcp` — a transport-agnostic Model Context Protocol server
 * that exposes the LLM Workbench runtime over MCP.
 *
 * Wire any `RunRepository` (Memory, HTTP, Supabase, …) to
 * {@link createWorkbenchMcpServer} and bind the resulting `McpServer` to a
 * transport. For HTTP runtimes (Next.js Route Handlers, Hono, edge
 * functions) use {@link createWorkbenchMcpHttpHandler} for a ready-made
 * `(req: Request) => Promise<Response>` adapter.
 *
 * Authentication is the host's responsibility — pass a `RunRepository`
 * that's already scoped to the caller's tenant.
 *
 * @packageDocumentation
 */
export {
  createWorkbenchMcpServer,
} from "./server.js";
export {
  createWorkbenchMcpHttpHandler,
  type CreateWorkbenchMcpHttpHandlerOptions,
} from "./http.js";
export type { CreateWorkbenchMcpServerOptions } from "./types.js";
