# LLM Workbench

A **modular, model-agnostic GUI harness** for applications that call LLMs.
Bolt it on to any pipeline that produces artifacts and traces, and give
non-technical users meaningful control without rewriting the host app.

The runtime is **headless and environment-agnostic** (browser, Node,
edge). It records workflows, artifacts, rules, human gates, and traces;
optional UI and React helpers subscribe to live state; persistence and
run-bundle import/export support audits, reproducibility, and reuse.

> Source-available, not OSI open source. Free for noncommercial use under
> PolyForm Noncommercial 1.0.0; commercial use requires a paid license.
> See [`LICENSE`](LICENSE) and [`COMMERCIAL.md`](COMMERCIAL.md).

## Why bolt this on

- **Model-agnostic.** The runtime never talks to a model itself. The host
  decides which provider, model, prompt strategy, and tool registry to use,
  and reports back via `logModelIO` / `logToolCall` / `writeArtifact`.
- **Workflow-shaped.** Workflows are a DAG of steps with explicit
  `gatePolicy` (`AUTO`, `PAUSE_BEFORE`, `PAUSE_AFTER`, `CHECKPOINT`), so
  you can hand non-technical users a "review before continuing" experience
  out of the box.
- **Schema-validated artifacts and rules.** Bring your own JSON Schemas
  (Ajv-backed) and the runtime validates writes, patches, and exports.
- **Run bundles with integrity.** Every export is SHA-256 hashed; every
  import verifies the hash by default. Two profiles: `full` for
  engineering replay, `user` for redacted, shareable bundles.
- **Telemetry-ready traces.** Model I/O events can carry provider,
  model, token usage, cost, and duration metadata. Runs can also carry a
  host-provided `subject` (`userId`, `tenantId`, `accountId`, `planId`)
  and JSON metadata, so host apps can later add quotas, tiered access, or
  per-user billing without changing the protocol shape. The runtime also
  exports `summarizeModelTelemetry` to convert raw trace events into a typed
  usage and cost ledger grouped by provider, model, step, user, tenant, and
  plan.
- **Pluggable persistence.** Memory, IndexedDB, or HTTP, behind a single
  `RunRepository` interface. The HTTP adapter supports timeouts, retries,
  and abort signals.
- **Composable UI.** `WorkbenchShell` is a single React component with
  themeable CSS variables. Adopt it as-is, or write your own UI against
  the runtime — the entire surface is documented in code.

## Repository layout

```
packages/
  runtime/            @llm-workbench/runtime          (no DOM, no React)
  ui/                 @llm-workbench/ui               (React + theme.css)
  adapters-react/     @llm-workbench/adapters-react   (React hooks)
examples/
  job-search-demo/    Vite app exercising the full surface
  run-repo-server/    Reference Express server for HttpRunRepository
```

| Package | What it gives you |
|---------|-------------------|
| `@llm-workbench/runtime` | Protocol types, `WorkbenchRuntime` / `WorkbenchSession`, `SchemaRegistry` (Ajv), persistence ports (`MemoryRunRepository`, `IndexedDbRunRepository`, `HttpRunRepository`), bundle import/export with integrity, structured `WorkbenchError`. |
| `@llm-workbench/ui` | `WorkbenchShell`: artifact editor, rules editor, trace timeline, import/export controls. Themeable via CSS variables. |
| `@llm-workbench/adapters-react` | `useWorkbenchRunRevision` hook for subscribing components to live run state. |

## Quick start

```bash
npm install
npm test
npm run build
npm run demo               # Vite demo app at http://localhost:5173
npm run demo:http-server   # Reference REST store for HttpRunRepository
```

Node.js 18.18+ is required. CI runs on Node 18 and 20.

### 60-second host integration

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
});

const session = runtime.session(runId);
session.resolveGate({ stepId: "parse", gate: "PAUSE_BEFORE", decision: "approved" });
session.beginStep("parse");
session.writeArtifact({
  artifactKey: "compiledProfile",
  typeId: "compiledProfile",
  data: { headline: "TS engineer", skills: ["ts"], summary: "..." },
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
console.log(telemetry.totals.costByCurrency, telemetry.byProviderModel);
```

Drop `<WorkbenchShell runtime={runtime} runId={runId} registry={registry} />`
anywhere in your app to get the artifact editor, rules CRUD, trace timeline,
and bundle import/export UI for free.

## License

- **Default:** [PolyForm Noncommercial 1.0.0](LICENSE) — read, fork, study,
  and use for noncommercial purposes (research, hobby, charities,
  schools, government, public-benefit organizations).
- **Commercial use:** requires a paid license. See
  [`COMMERCIAL.md`](COMMERCIAL.md).
- **Contributing:** see [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Security reports:** see [`SECURITY.md`](SECURITY.md).
