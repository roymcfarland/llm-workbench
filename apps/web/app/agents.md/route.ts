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

The wire format is the literal output of \`HttpRunRepository.serializeState\`
from \`@llm-workbench/runtime\`. Maps are serialized as \`Array<[key, value]>\`
entries; everything else is plain JSON.

### MCP (Streamable HTTP)

\`\`\`
POST/GET /api/mcp
\`\`\`

Tools, all tenant-scoped:

- \`list_runs(limit?: number)\` → \`SavedRunMeta[]\`
- \`get_run(runId: string)\` → serialized \`RunStoreState\`
- \`start_run(workflowId: "jobSearchWorkflow")\` → \`{ runId }\`
- \`resolve_gate(runId, stepId, gate, decision, note?)\` → \`{ ok: true }\`
- \`write_artifact(runId, artifactKey, typeId, data, idempotencyKey?)\` → \`{ version }\`
- \`export_bundle(runId)\` → tamper-evident \`RunBundle\` JSON

Mutating tools (\`start_run\`, \`resolve_gate\`, \`write_artifact\`) are
intentionally narrow in this reference deployment: they unblock the most
common agent workflows but stop short of every \`WorkbenchSession\` API. Open
a PR or use the REST PUT for everything else.

## Authentication

Both surfaces require a Clerk-issued session.

- **Browser context:** Clerk's session cookie is forwarded automatically on \`fetch(..., { credentials: "include" })\`.
- **Server-to-server / agent context:** issue a Clerk M2M token (or use a Clerk JWT template) and pass \`Authorization: Bearer <token>\` on every request. The MCP descriptor advertises \`auth.type = "clerk-bearer"\`.

The runtime resolves \`tenantId = orgId ?? "user:" + userId\` and refuses to
serve cross-tenant data. There is no public anonymous access to mutating
endpoints. The \`/runs/demo\` page and read-only descriptors (\`llms.txt\`,
\`llms-full.txt\`, \`agents.md\`, \`mcp.json\`, \`openapi.json\`,
\`robots.txt\`, \`sitemap.xml\`) are the only public-by-design surfaces.

## Expected request shape

REST PUT bodies match exactly the output of \`HttpRunRepository.serializeState\`.
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

No rate limits in this reference deployment. Production deployments must add
a per-tenant limiter before exposing the surface to untrusted clients. We
recommend treating MCP tool calls as if each were a REST call for budgeting
purposes.

## License & terms

LLM Workbench is licensed under ${LICENSE_NAME}. You may consume the public
surfaces above for noncommercial work, research, and evaluation. Commercial
use requires a separate paid license — see ${GITHUB_URL}/blob/main/COMMERCIAL.md.
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
