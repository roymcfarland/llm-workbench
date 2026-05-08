# `@llm-workbench/mcp`

**Proprietary** — Transport-agnostic Model Context Protocol (MCP) glue for the LLM Workbench runtime.

Use this package when you want assistants or tools speaking MCP to start runs, resolve gates, or inspect traces against any [`RunRepository`](https://github.com/llmworkbench/llm-workbench/tree/main/packages/runtime) implementation.

## API surface

| Export | Role |
| --- | --- |
| `createWorkbenchMcpServer` | Builds an MCP `McpServer` from runtime wiring options. |
| `createWorkbenchMcpHttpHandler` | Wraps that server as `(req: Request) => Promise<Response>` for Next.js Route Handlers, Hono, etc. |

Authentication and tenancy are **host-defined**: supply a repository already scoped to the caller (see `apps/web/app/api/mcp/route.ts` for a reference binding).

## Docs elsewhere

- Product overview and license split: repository root [`README.md`](../../README.md).
- Deployed MCP endpoint + discovery: [`DEPLOY.md`](../../apps/web/DEPLOY.md) smoke-test table and `/.well-known/mcp.json`.
