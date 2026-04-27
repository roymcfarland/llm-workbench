import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

export type CreateWorkbenchMcpHttpHandlerOptions = {
  /**
   * The MCP server to expose. Typically the value returned by
   * {@link createWorkbenchMcpServer}, but any `McpServer` will work.
   */
  server: McpServer;

  /**
   * Whether the transport should respond with `application/json` instead of
   * starting an SSE stream. Defaults to `true` because LLM Workbench tools
   * are short-lived request/response operations that don't need streaming.
   */
  enableJsonResponse?: boolean;
};

/**
 * Build a Web-standard `(req: Request) => Promise<Response>` handler that
 * speaks MCP over Streamable HTTP. Suitable for Next.js Route Handlers,
 * Hono, Cloudflare Workers, Deno, Bun, or any other runtime that consumes
 * Web standard `Request`/`Response` objects.
 *
 * Each call instantiates a fresh stateless transport so the handler is
 * safe to use in serverless / edge deployments where module state may not
 * persist between invocations. The caller's `McpServer` is reused across
 * requests (it is stateless) — close it manually if your runtime supports
 * shutdown hooks.
 */
export function createWorkbenchMcpHttpHandler(
  options: CreateWorkbenchMcpHttpHandlerOptions,
): (req: Request) => Promise<Response> {
  const { server, enableJsonResponse = true } = options;
  return async (req: Request) => {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(req);
    } finally {
      await transport.close();
    }
  };
}
