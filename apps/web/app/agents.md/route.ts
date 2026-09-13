import { WORKBENCH_PROTOCOL_VERSION } from "@llm-workbench/runtime";

import { GITHUB_URL, LICENSE_NAME, siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const origin = await siteOrigin();
  const body = `# agents.md

The contract for AI agents (and other automated callers) driving LLM
Workbench. Protocol v${WORKBENCH_PROTOCOL_VERSION}. Last updated alongside the
runtime release.

## Read affordances

- \`${origin}/llms.txt\` — short summary, links, license, contact.
- \`${origin}/llms-full.txt\` — full reference: README, protocol overview, REST + MCP usage, every trace event type.
- \`${origin}/api/openapi.json\` — OpenAPI 3.1 schema for the REST surface.
- \`${origin}/.well-known/mcp.json\` — MCP descriptor for the streamable HTTP endpoint.
- \`${origin}/runs/demo\` — public, read-only sample run rendered the same way auth-gated runs are.

## Write affordances

Two surfaces expose mutating operations. Both are tenant-scoped via Clerk auth.

### REST

\`\`\`
GET    /api/runs?limit=N             → SavedRunMeta[]
GET    /api/runs/{runId}             → SerializedRunStoreState
PUT    /api/runs/{runId}             body: SerializedRunStoreState   → 204
DELETE /api/runs/{runId}                                             → 204
\`\`\`

The wire format is the JSON body \`HttpRunRepository.save()\` sends and \`load()\` parses
in \`@llm-workbench/runtime\`. Maps are serialized as \`Array<[key, value]>\`
entries; everything else is plain JSON.

### MCP (Streamable HTTP)

\`\`\`
POST/GET /api/mcp
\`\`\`

Tools (every \`tools/call\` requires a Clerk session; run tools are tenant-scoped):

- \`list_runs(limit?: number)\` → \`SavedRunMeta[]\`
- \`get_run(runId: string)\` → serialized \`RunStoreState\`
- \`verify_run_integrity(bundle)\` → \`{ ok, sha256 }\`
- \`validate_run_bundle(bundle)\` → \`{ ok }\` or \`{ ok: false, error }\`
- \`start_run(workflowId: "jobSearchWorkflow")\` → \`{ runId }\`
- \`resolve_gate(runId, stepId, gate, decision, note?)\` → \`{ ok: true }\`
- \`write_artifact(runId, artifactKey, typeId, data, idempotencyKey?)\` → \`{ version }\`
- \`export_bundle(runId)\` → tamper-evident \`RunBundle\` JSON

Mutating tools (\`start_run\`, \`resolve_gate\`, \`write_artifact\`) are
intentionally narrow in this reference deployment: they unblock the most
common agent workflows but stop short of every \`WorkbenchSession\` API. Open
a PR or use the REST PUT for everything else.

## Authentication

The REST API requires a Clerk-issued session. On \`/api/mcp\`, discovery methods (\`initialize\`, \`ping\`, \`tools/list\`, \`resources/list\` and similar) are public, and every \`tools/call\` requires a session.

- **Browser context:** Clerk's session cookie is forwarded automatically on \`fetch(..., { credentials: "include" })\`.
- **Server-to-server / agent context:** issue a Clerk M2M token (or use a Clerk JWT template) and pass \`Authorization: Bearer <token>\` on every request. The MCP descriptor advertises \`auth.type = "clerk-bearer"\`.

The runtime resolves \`tenantId = orgId ?? "user:" + userId\` and refuses to
serve cross-tenant data. There is no public anonymous access to mutating
endpoints. The \`/runs/demo\` page and read-only descriptors (\`llms.txt\`,
\`llms-full.txt\`, \`agents.md\`, \`mcp.json\`, \`openapi.json\`,
\`robots.txt\`, \`sitemap.xml\`) are public machine-readable surfaces; marketing pages, docs, the blog, the FAQ, \`/feed.xml\`, \`/api/health\` and MCP discovery are also public.

## Search engines, crawlers & link previews

- \`${origin}/robots.txt\` uses a single \`User-agent: *\` block so every bot inherits the same \`Allow\` / \`Disallow\`: marketing URLs stay reachable; Clerk-gated shells (\`/playground\`, \`/runs…\`), private APIs (\`/api/runs…\`, \`/api/llm\`, \`/api/mcp\`), and sign-in/up flows stay out of the crawl frontier. Public exception: \`/runs/demo\`.
- \`${origin}/sitemap.xml\` lists indexable URLs only (no authenticated app shells).
- Open Graph / Twitter preview fetches OG image routes without cookies—the hosted server keeps \`/opengraph-image\`, \`/twitter-image\`, and blog image routes reachable outside the Clerk gate (\`apps/web/proxy.ts\`).

## Expected request shape

REST PUT bodies match exactly the JSON body \`HttpRunRepository.save()\` sends and \`load()\` parses.
Reject anything that fails \`assertRunStoreStateStructuralInvariants\`. JSON
must be well-formed; bodies > 25 MB are rejected with HTTP 413.

MCP tool calls follow the JSON-RPC 2.0 envelope expected by the Streamable
HTTP transport. Use the \`@modelcontextprotocol/sdk\` client or any conformant
implementation. Each tool's input schema is published in the tools/list
response.

## Error model

Both surfaces emit JSON errors:

\`\`\`json
{ "error": "<human-readable>", "code": "<optional canonical code>" }
\`\`\`

Canonical codes match \`WorkbenchError.code\`: \`HTTP_INVALID_JSON\`,
\`INVALID_TRACE_EVENT\`, \`INVALID_RUN_BUNDLE\`, \`INTEGRITY_MISMATCH\`,
\`UNKNOWN_RUN\`, \`INVALID_STATE_TRANSITION\`, etc.

## Rate limits

Proxy-matched \`/api/*\` routes are rate-limited per client IP using sliding
windows: 120 requests/minute by default, and 30/minute for \`/api/llm\` and
\`/api/mcp\`. \`/api/health\` and paths containing a dot, such as \`/api/openapi.json\`,
are excluded. Exceeding a limit returns 429 with \`Retry-After\`.
Production without Upstash configuration returns 503 ("Rate limiter not configured")
with \`Retry-After: 60\` on those matched API routes unless \`RATE_LIMIT_ALLOW_UNCONFIGURED=1\`.
Missing configuration is a no-op in development and test. Limits are per IP,
not per tenant; add a per-tenant limiter before exposing the surface to untrusted clients. We
recommend treating MCP tool calls as if each were a REST call for budgeting
purposes.

## License & terms

LLM Workbench is open source under the ${LICENSE_NAME} license — free to use,
modify, and distribute, including commercially. Source: ${GITHUB_URL}.
Agent integrations should:

- identify themselves with a stable \`User-Agent\` (e.g. \`my-agent/1.2 (+https://example.com)\`),
- not retry failed requests with backoff < 1s,
- treat exported run bundles as the source of truth for replay, not the live API.

For security disclosures, see ${GITHUB_URL}/blob/main/SECURITY.md.
`;
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
