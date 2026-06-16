# `@llm-workbench/mcp`

**MIT-licensed** — transport-agnostic Model Context Protocol (MCP) glue for the [LLM Workbench](../../README.md) runtime.

Use this package when you want assistants or tools speaking MCP to start runs, resolve gates, or inspect traces against any [`RunRepository`](../runtime) implementation.

```bash
npm install @llm-workbench/mcp @llm-workbench/runtime
```

## API surface

| Export | Role |
| --- | --- |
| `createWorkbenchMcpServer` | Builds an MCP `McpServer` from runtime wiring options. |
| `createWorkbenchMcpHttpHandler` | Wraps that server as `(req: Request) => Promise<Response>` for Next.js Route Handlers, Hono, etc. |

Authentication and tenancy are **host-defined**: supply a repository already scoped to the caller (see `apps/web/app/api/mcp/route.ts` for a reference binding).

## Docs elsewhere

- Product overview and architecture: repository root [`README.md`](../../README.md).
- Deployed MCP endpoint + discovery: [`DEPLOY.md`](../../apps/web/DEPLOY.md) smoke-test table and `/.well-known/mcp.json`.
