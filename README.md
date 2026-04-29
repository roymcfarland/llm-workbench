# LLM Workbench

**A source-available control plane for LLM-powered products.**

LLM Workbench gives AI applications a production-grade human interface for
the messy parts that matter: workflow state, artifacts, rules, human review
gates, trace history, model I/O, cost telemetry, import/export, and replay.

It is not another chat UI. It is the layer you bolt onto an LLM pipeline when
you want non-technical users to inspect, edit, approve, branch, audit, and
learn from the work your system is doing.

The runtime is headless, model-agnostic, and environment-agnostic. It does not
call OpenAI, Anthropic, local models, or any other provider directly. Your host
application owns prompts, tools, models, and policy. LLM Workbench records what
happened and gives humans a clean control surface over it.

> **License in one line:** the four core packages (`@llm-workbench/runtime`,
> `adapters-react`, `ai-sdk`, `ui`) and the examples ship under Apache 2.0
> and are free for commercial use. The hosted reference deployment under
> `apps/web` (and any future `apps/*` product surfaces) is source-available
> under PolyForm Noncommercial 1.0.0; commercial use of those areas
> requires a paid license. See [License](#license).

## Status

`v0.2.0` (2026-04-27): the four OSS packages relicense to **Apache 2.0**;
the runtime adds Trace 2.0 (hierarchical spans, OTel GenAI mapper),
hierarchical supervision (`runChildrenOf`, `cancelRunCascade`), and an
externalizable `ArtifactStore`; a new `@llm-workbench/ai-sdk` wraps Vercel
AI SDK v5 with automatic trace events; the UI ships scoped `lwb-` CSS,
accessible `@dnd-kit` reorder, virtualized trace, and a `WorkflowGraph`;
and a hosted reference deployment lands at [`apps/web`](apps/web).
See [CHANGELOG.md](CHANGELOG.md) for the full list.

**Engineering handoff:** [docs/HANDOFF.md](docs/HANDOFF.md) — how the repo is
structured, what shipped in `apps/web`, CI, deploy, security posture, and
suggested work for the next milestone.

## Why It Exists

LLM apps fail in boring, expensive ways:

- Outputs change and nobody knows why.
- Prompts, rules, artifacts, and human edits drift apart.
- Non-technical reviewers get a black box instead of useful controls.
- Teams cannot replay what happened after a bad run.
- Model spend is logged somewhere, but not where product decisions happen.
- "Add AI" becomes a pile of custom debugging panels and brittle JSON editors.

LLM Workbench turns that chaos into an inspectable run graph.

## What You Get

- **Model-agnostic runtime.** The host decides which provider, model, prompt
  strategy, and tool registry to use. The runtime records model I/O and tool
  calls through explicit APIs.
- **Workflow-shaped execution.** Workflows are DAGs with step-level gate
  policies: `AUTO`, `PAUSE_BEFORE`, `PAUSE_AFTER`, and `CHECKPOINT`.
- **Human review gates.** Pause before or after important steps, collect
  approvals, rejections, edits, and notes, then resume with traceable intent.
- **Schema-validated artifacts and rules.** Bring JSON Schemas, validate data
  through Ajv, patch artifacts safely, and export redacted user bundles.
- **Tamper-evident run bundles.** Exports are SHA-256 signed over canonical
  JSON. Imports verify integrity by default.
- **Telemetry-ready traces.** Track provider, model, usage, duration, cost,
  user, tenant, account, and plan metadata without locking into a vendor.
- **Cost and usage summaries.** `summarizeModelTelemetry` turns raw trace
  events into a typed ledger grouped by provider, model, step, user, tenant,
  and plan.
- **Pluggable persistence.** Use memory, IndexedDB, or HTTP behind one
  `RunRepository` interface. The HTTP adapter supports auth headers, timeouts,
  retries, and abort signals.
- **Composable UI.** Use `WorkbenchShell` as a ready-made React control panel,
  or build your own UI against the headless runtime.

## Architecture

```
host app
  owns models, prompts, tools, business logic
  calls runtime APIs as work happens

@llm-workbench/runtime
  records workflow state, artifacts, rules, gates, traces, bundles, telemetry
  runs in browser, Node, or edge-style runtimes

@llm-workbench/ui
  React shell for artifact editing, rules, trace history, gates, import/export

@llm-workbench/adapters-react
  subscription hooks for live runtime state
```

## Repository Layout

```
packages/
  runtime/              @llm-workbench/runtime
  ui/                   @llm-workbench/ui
  adapters-react/       @llm-workbench/adapters-react
  ai-sdk/               @llm-workbench/ai-sdk
  mcp/                  @llm-workbench/mcp (MCP server + HTTP adapter)
examples/
  job-search-demo/    Vite demo app exercising the full surface
  run-repo-server/    Reference REST store for HttpRunRepository
apps/
  web/                Hosted reference deployment (Next.js + Supabase + AI Gateway + Clerk)
```

| Package | What it gives you |
| --- | --- |
| `@llm-workbench/runtime` | Protocol types, `WorkbenchRuntime`, `WorkbenchSession`, `SchemaRegistry`, persistence adapters, bundle import/export, telemetry summaries, and structured `WorkbenchError`. |
| `@llm-workbench/ui` | `WorkbenchShell`, a themeable React interface for artifacts, rules, traces, gates, and bundles. |
| `@llm-workbench/adapters-react` | `useWorkbenchRunRevision` for subscribing React components to live run state. |
| `@llm-workbench/ai-sdk` | Vercel AI SDK v5 wrappers (`tracedGenerateText`, `tracedStreamText`, `tracedGenerateObject`, `tracedStreamObject`, `traceTools`) that emit correlated `model_io`, `tool_call`, and gateway-cost trace events automatically. |
| `@llm-workbench/mcp` | Model Context Protocol server factory plus HTTP handler (`createWorkbenchMcpHttpHandler`) for exposing the runtime over MCP — see [`packages/mcp/README.md`](packages/mcp/README.md). |

## Quick Start

```bash
npm install
npm test
npm run build
npm run demo               # Vite demo app at http://localhost:5173
npm run demo:http-server   # Reference REST store for HttpRunRepository
```

Node.js **22+** is required (`engines` in root `package.json`). CI runs on **Node 22 and 24** (`.github/workflows/ci.yml`).

## 60-Second Integration

```ts
import {
  WorkbenchRuntime,
  SchemaRegistry,
  registerDemoSchemas,
  summarizeModelTelemetry,
} from "@llm-workbench/runtime";

const registry = new SchemaRegistry();
registerDemoSchemas(registry);

const runtime = new WorkbenchRuntime();
const { runId } = runtime.startRun({
  workflow: {
    id: "my-pipeline",
    version: 1,
    steps: [
      { id: "parse", gatePolicy: "PAUSE_BEFORE" },
      { id: "score", gatePolicy: "AUTO" },
    ],
    edges: [{ id: "e1", from: "parse", to: "score" }],
  },
  subject: {
    userId: "user_123",
    tenantId: "team_456",
    planId: "pro",
  },
});

const session = runtime.session(runId);

session.resolveGate({
  stepId: "parse",
  gate: "PAUSE_BEFORE",
  decision: "approved",
});

session.beginStep("parse");

session.writeArtifact({
  artifactKey: "compiledProfile",
  typeId: "compiledProfile",
  data: {
    headline: "TypeScript engineer",
    skills: ["typescript", "react", "systems"],
    summary: "Strong full-stack builder with AI workflow experience.",
  },
});

session.logModelIO({
  stepId: "parse",
  direction: "response",
  provider: "openai",
  model: "gpt-example",
  usage: { inputTokens: 120, outputTokens: 40 },
  cost: { amount: 0.0012, currency: "USD" },
  durationMs: 900,
});

session.completeStep("parse");

const telemetry = summarizeModelTelemetry(session.snapshot());
console.log(telemetry.totals, telemetry.byProviderModel);
```

Drop the shell anywhere in your app:

```tsx
<WorkbenchShell runtime={runtime} runId={runId} registry={registry} />
```

## Runtime Principles

- The runtime never hides state behind provider-specific abstractions.
- Structured outputs should be schema-validated before they become product
  state.
- Human edits and approvals are first-class trace events, not side notes.
- Exported runs should be useful for debugging, audits, demos, and learning.
- Model telemetry should be close enough to the workflow that cost and quality
  can be managed together.
- The public protocol should be boring, explicit, and durable.

## License

LLM Workbench is **dual-licensed**:

- The four core packages and the examples are **Apache 2.0**, an
  OSI-approved open-source license with an explicit patent grant. You can
  use them freely, including in commercial products, with attribution and
  the standard Apache 2.0 conditions.
  - `packages/runtime` (`@llm-workbench/runtime`)
  - `packages/adapters-react` (`@llm-workbench/adapters-react`)
  - `packages/ai-sdk` (`@llm-workbench/ai-sdk`)
  - `packages/ui` (`@llm-workbench/ui`)
  - `examples/*`
  - Each package contains its own `LICENSE` file with the full Apache 2.0
    text. A reference copy lives at
    [`LICENSES/Apache-2.0.txt`](LICENSES/Apache-2.0.txt).
- The hosted reference deployment under `apps/web` (and any future
  `apps/*` product surfaces, e.g. `eval`, `marketplace`,
  `cost-reconciliation`) is source-available under
  [PolyForm Noncommercial 1.0.0](LICENSE). You can read it, fork it,
  modify it, and use it for noncommercial / public-benefit purposes.
  Commercial use of those areas requires a paid license.

The split is deliberate. The protocol, runtime, and UI primitives that the
ecosystem depends on are permissively open so they can be adopted, embedded,
and extended without friction. The hosted product surfaces — the ones that
look like a sellable SaaS — are reserved so the project can be funded like
serious infrastructure rather than only existing as a side project.

For commercial terms covering the noncommercial portions, see
[COMMERCIAL.md](COMMERCIAL.md).

## Contributing

Contributions are welcome under the inbound terms in
[CONTRIBUTING.md](CONTRIBUTING.md). Inbound license matches outbound license:
contributions to the Apache 2.0 packages come in under Apache 2.0 (DCO
sign-off via `git commit -s` is the only paperwork required); contributions
to the PolyForm-NC areas under `apps/*` come in under PolyForm-NC plus a
relicense grant so the maintainer can issue paid commercial licenses for
those product surfaces.

## Security

Please report security issues through the process in [SECURITY.md](SECURITY.md).
