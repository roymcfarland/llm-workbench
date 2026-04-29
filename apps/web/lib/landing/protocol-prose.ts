import { WORKBENCH_PROTOCOL_VERSION } from "@llm-workbench/runtime";

/**
 * Long-form prose primer on the LLM Workbench protocol. Reused by
 * `/docs/protocol` (HTML) and `/llms-full.txt` (plain markdown). The Markdown
 * conventions are intentionally narrow so the same string serializes cleanly
 * in both contexts: H2 / H3 headings, paragraphs separated by blank lines,
 * fenced code blocks for JSON.
 */
export const PROTOCOL_OVERVIEW = `# Protocol overview

LLM Workbench v${WORKBENCH_PROTOCOL_VERSION} is a runtime-and-wire-format pair for
recording, gating, and replaying LLM-powered work. It is deliberately boring
on the surface — JSON in, JSON out, structured trace events — so it survives
upgrades, model swaps, framework migrations, and audits.

## Host boundaries

The runtime **never** chooses models, executes prompts, or registers tools on
your behalf. Your application owns orchestration policy; LLM Workbench exposes
explicit APIs (\`WorkbenchSession\`) so **recording is intentional**. Every
meaningful action turns into typed facts (\`TraceEvent\`) rather than inferred
guesses from stderr or vendor dashboards.

That separation matters when you swap providers or refactor prompts: semantic
gates and artifact schemas travel with the run; vendor IDs remain annotations on
\`model_io\`, not primary keys for truth.

## Run bundles

A run bundle is the canonical **export** of a single run — the interchange format
for email attachments, audit ZIPs, cold storage, or compliance tooling. It is a
JSON document with these top-level fields:

- \`protocolVersion\`: literal protocol identifier (currently \`${WORKBENCH_PROTOCOL_VERSION}\`).
- \`run\`: the \`RunInstance\` (id, workflow snapshot, status, timestamps, optional subject and metadata).
- \`trace\`: ordered array of \`TraceEvent\`s, each carrying a stable id and ISO timestamp.
- \`artifacts\`: every version of every artifact ever written (artifacts are append-only in bundle land).
- \`ruleSets\`: every version of every rule set referenced by the run.
- \`engine\` (optional): an internal snapshot of step status, gate state, and idempotency keys for byte-faithful rehydration. When absent, the runtime can re-derive these from the trace.
- \`integrity.sha256\`: hex SHA-256 over **canonical JSON** of \`{run, trace, artifacts, ruleSets, engine?}\`. The bundle is tamper-evident — verify on import.

Bundles are content-addressed in spirit: canonical serialization sorts object keys
lexicographically, drops undefined properties consistently, and rejects cyclic or
non-JSON-safe values before hashing — so two semantically equal exports bit-match.

## Live persistence versus export bundles

Day-to-day HTTP persistence (\`PUT /api/runs/{runId}\` in this reference app)
stores a **\`RunStoreState\`** snapshot: maps for artifacts, gate state,
idempotency keys, and step status — optimized for merging and optimistic
concurrency. A **\`RunBundle\`**, by contrast, is the denormalized archive you
hand to another system or verify offline. The runtime translates between them:
export flattens maps to ordered arrays for signing; import rehydrates into
session state. When you read the OpenAPI spec, you are looking at **store** wire
format, not necessarily a fully materialized bundle with \`integrity\` — use
\`export_bundle\` via MCP (or equivalent) when you need a signed artifact.

## Trace events

Every observable runtime fact is a typed trace event. The discriminated union
covers:

- \`step_started\` / \`step_completed\`: lifecycle of a workflow step.
- \`artifact_written\` / \`artifact_patch\`: creating or evolving structured outputs (with idempotency keys to dedupe writes).
- \`model_io\`: a model call's request, response, or stream chunk, with optional usage, cost, duration, summary, and a redacted payload.
- \`tool_call\`: a tool invocation with arguments and result.
- \`human_gate_requested\` / \`human_gate_resolved\`: pause-and-decide events with explicit decisions (\`approved\`, \`rejected\`, \`edited\`) and optional notes.
- \`rule_changed\`: snapshot of a new rule-set revision.
- \`policy_changed\`: a step's gate policy was overridden mid-run.
- \`error\`: a structured error with optional code and \`fatal\` flag.
- \`run_forked\`: the run was branched off another (\`parentRunId\` or \`parentRunIds\`).
- \`annotation\`: free-text human note with optional tags.
- \`run_status_changed\`: terminal transitions (\`completed\`, \`failed\`, \`cancelled\`).
- \`span_started\` / \`span_ended\`: hierarchical spans modeled after OpenTelemetry's GenAI semantic conventions; convertible to OTel spans.

Every event has \`id\`, \`runId\`, \`ts\`, and an optional \`stepId\` and
\`correlationId\`. The \`TraceEventSchema\` Zod parser is the authoritative
contract — any host that emits structured trace events should validate against
it before persistence.

### Ordering, replay, and correlation

The trace is an **append-only** narrative. UIs and replay tooling usually expect
events in time order; the schema does not enforce monotonic timestamps (clocks
skew happens), but exporters should preserve append order as the source of truth
for human review. Use \`correlationId\` to stitch a **single logical operation**
split across multiple events — for example every \`stream_chunk\` for one
completion should share one id so downstream analysis can collapse a stream back
into one row without heuristics.

### Spans and external observability

\`span_started\` / \`span_ended\` mirror GenAI semantic layers: you can convert
the trace to vendor spans with \`traceEventsToOtelSpans\` (see \`@llm-workbench/runtime\`)
and ship them to whichever OTLP backend you already operate. That path is complementary,
not redundant: OTLP answers “where was latency?” while the bundle still answers “which
artifact version did a reviewer approve before it reached a customer?”.

## Gates

Every workflow step carries a gate policy:

- \`AUTO\`: no gate; runs whenever predecessors are ready.
- \`PAUSE_BEFORE\`: hold until a reviewer approves **before** the step executes.
- \`PAUSE_AFTER\`: hold after the step completes until a reviewer approves the result.
- \`CHECKPOINT\`: arbitrary named checkpoints **inside** a long step — each checkpoint is independently approved.

Gate state is part of the run state and persists across reloads. Resuming a
paused run is a \`resolveGate\` call followed by the next eligible \`beginStep\`.
Rejections (\`human_gate_resolved\` with \`decision: "rejected"\`) are explicit trace facts — they **stop forward progress** until product logic forks or retries; there is no silent skip.

## Artifacts and schemas

Artifacts are versioned, JSON-shaped values keyed by \`artifactKey\`. They
carry a \`typeId\` that maps to a schema in the \`SchemaRegistry\`. Writes are
either full replacements (\`writeArtifact\`) or RFC 6902 JSON Patches
(\`patchArtifact\`), and both flavours produce structured trace events so
diffs survive replay.

Schemas live in the host: \`registerDemoSchemas\` ships a useful set of
examples; in production you bring your own Ajv-validated JSON Schemas. The
runtime refuses to write artifacts that do not validate against the registered
schema for their \`typeId\`.

### Idempotency

Heavy steps may retry — network flakes, duplicate webhook deliveries — so artifact
writes carry **idempotency keys** where the host needs deduplication. Replays with
the same key collapse to one version bump, which keeps forensic traces readable
without duplicate \`artifact_written\` noise.

## Telemetry

\`summarizeModelTelemetry(state)\` reduces the trace into a typed ledger keyed
by provider, model, step, user, tenant, and plan. It surfaces input/output
token totals, cached and reasoning tokens, and per-currency cost rollups. The
ledger is a derived view — the underlying \`model_io\` events are the system of
record.

For **billing truth**, reconcile against your gateway or cloud invoice APIs; the trace
ledger is the fast, run-scoped approximation that makes product decisions legible next
to workflow structure.

## Forks and lineage

\`run_forked\` plus \`RunInstance\` parent linkage (\`parentRunId\` or plural
\`parentRunIds\`) lets you express forks (human branches an investigation) or
supervisor/worker graphs without losing ancestry. Consumers should prefer helpers that
normalize plural vs singular parents — older bundles may only carry \`parentRunId\`.

## Migrations

Bundle migration is a single \`migrateRunBundle\` step keyed off
\`protocolVersion\`. Bumping the version forces an explicit migration path —
older bundles are accepted, transformed, and re-signed before they enter the
runtime. The runtime refuses to import a bundle whose declared protocol
version it does not understand (unless migration hooks extend the importer).

## Sample minimal RunBundle

\`\`\`json
{
  "protocolVersion": "${WORKBENCH_PROTOCOL_VERSION}",
  "run": {
    "id": "run_demo_001",
    "workflowId": "jobSearchWorkflow",
    "workflowVersion": 1,
    "workflowSnapshot": {
      "id": "jobSearchWorkflow",
      "version": 1,
      "steps": [
        { "id": "parse",   "gatePolicy": "PAUSE_BEFORE" },
        { "id": "score",   "gatePolicy": "AUTO" }
      ],
      "edges": [{ "id": "e1", "from": "parse", "to": "score" }]
    },
    "startedAt": "2026-04-01T12:00:00.000Z",
    "endedAt":   "2026-04-01T12:00:42.000Z",
    "status": "completed"
  },
  "trace": [
    { "id": "evt_1", "type": "human_gate_resolved", "runId": "run_demo_001",
      "ts": "2026-04-01T12:00:01.000Z",
      "stepId": "parse", "gate": "PAUSE_BEFORE", "decision": "approved" },
    { "id": "evt_2", "type": "step_started", "runId": "run_demo_001",
      "ts": "2026-04-01T12:00:02.000Z", "stepId": "parse" },
    { "id": "evt_3", "type": "model_io", "runId": "run_demo_001",
      "ts": "2026-04-01T12:00:03.000Z", "stepId": "parse",
      "direction": "response", "provider": "anthropic",
      "model": "claude-haiku-4-5",
      "usage": { "inputTokens": 110, "outputTokens": 40, "totalTokens": 150 },
      "cost":  { "amount": 0.003, "currency": "USD" },
      "durationMs": 220 },
    { "id": "evt_4", "type": "artifact_written", "runId": "run_demo_001",
      "ts": "2026-04-01T12:00:04.000Z",
      "artifact": {
        "artifactKey": "compiledProfile", "typeId": "compiledProfile",
        "version": 1, "createdAt": "2026-04-01T12:00:04.000Z",
        "data": { "headline": "Senior TypeScript engineer",
                  "skills": ["typescript","react","systems"],
                  "summary": "Strong full-stack builder." }
      } }
  ],
  "artifacts": [],
  "ruleSets": [],
  "integrity": { "sha256": "<hex>" }
}
\`\`\`

## Driving the workbench programmatically

Two complementary surfaces are intended for agents and integrations:

- **REST.** \`GET /api/runs\` lists runs for the caller's tenant; \`GET /api/runs/{runId}\` returns serialized **live state** (\`RunStoreState\` shape); \`PUT /api/runs/{runId}\` persists the next revision (same wire shape); \`DELETE /api/runs/{runId}\` removes it. Responses mirror what \`HttpRunRepository\` reads and writes — **not** automatically the signed bundle envelope unless your exporter wraps it. See \`/api/openapi.json\` for schemas.
- **MCP.** \`/api/mcp\` is a Streamable HTTP MCP endpoint. The \`@llm-workbench/mcp\` core registers \`list_runs\`, \`get_run\`, \`verify_run_integrity\`, and \`validate_run_bundle\`; this reference app adds \`start_run\`, \`resolve_gate\`, \`write_artifact\`, and \`export_bundle\` (tamper-evident **RunBundle** JSON with engine snapshot — use this when automation needs hashes, not only row state). Discovery lives at \`/.well-known/mcp.json\`.

Both surfaces share Clerk-based auth and the tenant-scoping rules described in
\`/agents.md\`.
`;
