/**
 * Architecture overview rendered by `/docs/architecture` alone.
 */
export const ARCHITECTURE_OVERVIEW = `# Architecture

LLM Workbench splits into three layers: a headless runtime, an optional React
presentation layer, and optional integration adapters — plus a hosted
reference deployment that wires all three together for real users.

## The five packages

- **\`@llm-workbench/runtime\`** — Headless, model-agnostic runtime for LLM
  workflows — records state, artifacts, rules, human-review gates, traces,
  cost telemetry, and tamper-evident run bundles.
- **\`@llm-workbench/ui\`** — React control-surface components (\`WorkbenchShell\`)
  for inspecting and editing LLM Workbench runs — artifacts, rules, traces,
  gates, and bundle import/export.
- **\`@llm-workbench/adapters-react\`** — React hooks for subscribing components
  to live LLM Workbench runtime state.
- **\`@llm-workbench/ai-sdk\`** — Vercel AI SDK wrappers that emit correlated
  model-I/O, tool-call, and cost trace events into an LLM Workbench run.
- **\`@llm-workbench/mcp\`** — Model Context Protocol (MCP) server factory and
  HTTP handler that exposes an LLM Workbench runtime over MCP.

Only \`runtime\` is required. Everything else is additive — a headless backend
can ship with zero UI, and a UI app can swap in a different persistence layer
without touching runtime logic.

## Runtime internals

\`WorkbenchRuntime.startRun()\` registers a workflow and returns a \`runId\`.
\`WorkbenchRuntime.session(runId)\` returns a \`WorkbenchSession\` — a thin facade
over six controllers, each owning one concern:

\`\`\`text
WorkbenchSession
├─ RunLifecycleController   completeRun / failRun / cancelRun / exportRunBundle
├─ GateController           requestGate / resolveGate / resolveCheckpoint
├─ StepController           beginStep / completeStep / failStep
├─ ArtifactController       writeArtifact / patchArtifact / materializeArtifact
├─ TraceController          logModelIO / beginSpan / logToolCall
└─ RuleController           replaceRuleSet / reorderRules / annotate
\`\`\`

Every method call on any controller ends the same way: a typed \`TraceEvent\`
appended to \`RunStoreState\`. Nothing is inferred after the fact from logs —
if it happened, there's an event for it. The full wire format (\`RunBundle\`
vs. \`RunStoreState\`, canonical hashing, correlation IDs) is documented in the
[protocol reference](/docs/protocol).

## The hosted reference deployment (apps/web)

\`apps/web\` is a real Next.js application built on the same public packages —
proof the runtime is genuinely usable, not just a diagram. It exposes public
marketing/discovery routes (this site) and session-gated application routes
(\`/runs\`, \`/playground\`). Server-side API traffic is handled by Next.js route
handlers under \`apps/web/app/api/\`; the browser/React entry points are the
page components themselves.

Tenancy is enforced at the API layer via \`requireTenant()\` in
\`apps/web/lib/auth/tenant.ts\`, which derives a stable tenant scope from the
Clerk session. This is a hard security boundary: the Supabase persistence
layer (\`apps/web/lib/supabase/runs-store.ts\`) uses a service-role key that
bypasses Row Level Security, so the tenant check at the API layer is the only
thing standing between one tenant's runs and another's.

## Where to go next

- [Getting started](/docs/getting-started) — install the runtime and run the
  60-second example.
- [Protocol reference](/docs/protocol) — the full RunBundle/RunStoreState wire
  format, integrity hashing, and MCP/REST surfaces.
- [API reference](/docs/api) — generated API details for every public package export.
- [PROJECT.md on GitHub](https://github.com/roymcfarland/llm-workbench/blob/main/PROJECT.md) —
  the authoritative spec: purpose, non-goals, and conventions.
`;
