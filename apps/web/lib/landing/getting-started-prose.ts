/**
 * Beginner-friendly LLM Workbench quickstart, rendered by
 * `/docs/getting-started`. Written as plain Markdown (H1 / H2 headings,
 * paragraphs separated by blank lines, fenced code blocks, standard markdown
 * links) so it stays easy to keep in sync with README.md's own quickstart
 * section by eye.
 */
export const GETTING_STARTED_OVERVIEW = `# Getting started

Install one package, wire up a session, and you have a working LLM Workbench
integration — human review gates, artifacts, and cost telemetry included.
Everything below is copy-pasteable and runs in plain Node.

## Install

\`\`\`bash
npm install @llm-workbench/runtime
\`\`\`

The runtime has no React or framework dependency — it runs in the browser,
Node, or edge-style runtimes. Optional companion packages add a UI, React
bindings, Vercel AI SDK tracing, or an MCP server; see
[the README](https://github.com/roymcfarland/llm-workbench#install) for all
five.

## A complete run

\`\`\`ts
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
\`\`\`

## What just happened

- \`startRun\` registers a workflow (steps + edges) and a \`subject\` (who/what
  the run is for), and returns a \`runId\`.
- \`runtime.session(runId)\` is the handle you actually call — every method on
  it records a typed trace event, never a side effect only you can see.
- \`resolveGate\` clears the \`PAUSE_BEFORE\` gate on \`parse\` — human review gates
  are opt-in per step via \`gatePolicy\`, and nothing proceeds past one until a
  session method resolves it.
- \`writeArtifact\` and \`logModelIO\` are how your pipeline's actual outputs and
  model calls become durable, replayable facts instead of console noise.
- \`summarizeModelTelemetry\` rolls up token usage and cost across every
  \`model_io\` event recorded so far, grouped by provider and model.

## Add the UI

\`\`\`tsx
<WorkbenchShell runtime={runtime} runId={runId} registry={registry} />
\`\`\`

Install \`@llm-workbench/ui\` and \`@llm-workbench/adapters-react\`, drop the
shell in anywhere in your app, and the same run above renders as trace
timeline, artifacts, and gates — the exact surface the
[live demo](/runs/demo) shows.

## Where to go next

- [Protocol reference](/docs/protocol) — the full RunBundle/RunStoreState
  wire format, integrity hashing, and MCP/REST surfaces.
- [Architecture](/docs/architecture) — how the five packages and the hosted
  reference app fit together.
- [Live demo](/runs/demo) — a real run, rendered read-only, no signup.
- \`@llm-workbench/ai-sdk\` — automatic trace events for Vercel AI SDK v5 calls.
- \`@llm-workbench/mcp\` — expose runs over the Model Context Protocol.
- [Contributing](https://github.com/roymcfarland/llm-workbench/blob/main/CONTRIBUTING.md) —
  local dev setup and PR conventions.
`;
