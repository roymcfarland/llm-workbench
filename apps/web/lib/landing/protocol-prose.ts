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

## Run bundles

A run bundle is the canonical export of a single run. It is a JSON document
with these top-level fields:

- \`protocolVersion\`: literal protocol identifier (currently \`${WORKBENCH_PROTOCOL_VERSION}\`).
- \`run\`: the \`RunInstance\` (id, workflow snapshot, status, timestamps, optional subject and metadata).
- \`trace\`: ordered array of \`TraceEvent\`s, each carrying a stable id and ISO timestamp.
- \`artifacts\`: every version of every artifact ever written (artifacts are append-only).
- \`ruleSets\`: every version of every rule set referenced by the run.
- \`engine\` (optional): an internal snapshot of step status, gate state, and idempotency keys for byte-faithful rehydration. When absent, the runtime can re-derive these from the trace.
- \`integrity.sha256\`: hex SHA-256 of the canonical JSON of \`{run, trace, artifacts, ruleSets, engine?}\`. The bundle is tamper-evident — verify on import.

Bundles are content-addressed in spirit: the same input always produces the
same canonical JSON, and therefore the same sha256, regardless of map ordering
or whitespace.

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
- \`run_forked\`: the run was branched off another (\`parentRunId\`).
- \`annotation\`: free-text human note with optional tags.
- \`run_status_changed\`: terminal transitions (\`completed\`, \`failed\`, \`cancelled\`).
- \`span_started\` / \`span_ended\`: hierarchical spans modeled after OpenTelemetry's GenAI semantic conventions; convertible to OTel spans.

Every event has \`id\`, \`runId\`, \`ts\`, and an optional \`stepId\` and
\`correlationId\`. The \`TraceEventSchema\` Zod parser is the authoritative
contract — any host that emits structured trace events should validate against
it before persistence.

## Gates

Every workflow step carries a gate policy:

- \`AUTO\`: no gate; runs whenever predecessors are ready.
- \`PAUSE_BEFORE\`: hold until a reviewer approves before the step runs.
- \`PAUSE_AFTER\`: hold after the step completes until a reviewer approves the result.
- \`CHECKPOINT\`: arbitrary named checkpoints inside a step, each independently approved.

Gate state is part of the run state and persists across reloads. Resuming a
paused run is just a \`resolveGate\` call followed by the next eligible
\`beginStep\`.

## Artifacts and schemas

Artifacts are versioned, JSON-shaped values keyed by \`artifactKey\`. They
carry a \`typeId\` that maps to a schema in the \`SchemaRegistry\`. Writes are
either full replacements (\`writeArtifact\`) or RFC 6902 JSON Patches
(\`patchArtifact\`), and both flavours produce a structured trace event so
diffs survive replay.

Schemas live in the host: \`registerDemoSchemas\` ships a useful set of
examples; in production you bring your own Ajv-validated JSON Schemas. The
runtime refuses to write artifacts that do not validate against the registered
schema for their \`typeId\`.

## Telemetry

\`summarizeModelTelemetry(state)\` reduces the trace into a typed ledger keyed
by provider, model, step, user, tenant, and plan. It surfaces input/output
token totals, cached and reasoning tokens, and per-currency cost rollups. The
ledger is a derived view — the underlying \`model_io\` events are the system of
record.

For accounting, pull authoritative cost from your gateway's invoice API and
treat the trace ledger as a near-real-time approximation.

## Migrations

Bundle migration is a single \`migrateRunBundle\` step keyed off
\`protocolVersion\`. Bumping the version forces an explicit migration path —
older bundles are accepted, transformed, and re-signed before they enter the
runtime. The runtime refuses to import a bundle whose declared protocol
version it does not understand.

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

- **REST.** \`GET /api/runs\` lists runs for the caller's tenant; \`GET /api/runs/{runId}\` returns the serialized run state; \`PUT /api/runs/{runId}\` persists a new revision; \`DELETE /api/runs/{runId}\` removes it. All routes return the runtime's wire format unchanged. See \`/api/openapi.json\` for the full schema.
- **MCP.** \`/api/mcp\` is a Streamable HTTP MCP endpoint exposing six tools — \`list_runs\`, \`get_run\`, \`start_run\`, \`resolve_gate\`, \`write_artifact\`, \`export_bundle\`. See \`/.well-known/mcp.json\` for discovery.

Both surfaces share Clerk-based auth and the tenant-scoping rules described in
\`/agents.md\`.
`;
