# Changelog

All notable changes to LLM Workbench are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet. Open a pull request._

## 0.2.0

The first cut intended for outside consumption. The four core packages
move to **Apache 2.0** so they can be embedded in commercial products
without paperwork; the hosted reference plane under `apps/web` stays
source-available under PolyForm Noncommercial 1.0.0. The runtime adds
hierarchical tracing, agent-of-agents supervision, externalizable
artifact payloads, and a Vercel AI SDK v5 adapter; the UI gets a scoped
CSS rebuild with accessible reordering and a workflow graph; and a real
hosted reference deployment ships under `apps/web`.

### Added

- **`@llm-workbench/ai-sdk`** — new package wrapping Vercel AI SDK v5
  (`tracedGenerateText`, `tracedStreamText`, `tracedGenerateObject`,
  `tracedStreamObject`, `traceTools`, plus `costFromGatewayMetadata`)
  that automatically emits correlated `model_io` and `tool_call` trace
  events for every model call and tool invocation. Apache 2.0.
- **Hierarchical tracing (Trace 2.0).** New `span_started` / `span_ended`
  trace events for nested units of work and a `WorkbenchSession.span()`
  / `beginSpan()` helper that handles duration, status, and error capture
  automatically. New `traceEventsToOtelSpans()` exporter maps the trace
  to OpenTelemetry GenAI semantic conventions (OTLP-shaped spans) so
  hosts can ship to Datadog, Honeycomb, Tempo, etc. without re-deriving
  their event model.
- **Agent-of-agents supervision.** `RunContextRef` now accepts a plural
  `parentRunIds: string[]` alongside the legacy singular `parentRunId`
  (with a refinement enforcing `parentRunIds[0] === parentRunId` when
  both are set). `getParentRunIds(ctx)` normalizes the two shapes.
  `buildAgentChildStartInput({ parents, workflow, ... })` constructs a
  child run with multiple supervising parents. `WorkbenchRuntime` gains
  `runChildrenOf(parentRunId)` and `cancelRunCascade(rootRunId, opts)`
  for breadth-first cancellation that propagates through terminal
  nodes to their descendants.
- **Externalizable artifact storage.** `ArtifactPointer` adds
  `payloadHash` (lowercase 64-hex SHA-256, preferred over the
  deprecated `sha256` alias). New `ArtifactStore` interface, reference
  `MemoryArtifactStore`, and helpers `encodeArtifactPayloadBytes` /
  `sha256Hex`. `WorkbenchRuntime` accepts `artifactStore?` and
  `artifactExternalizationThresholdBytes` (default 256 KB).
  `WorkbenchSession.writeArtifactAsync({...})` encodes → hashes →
  measures → routes payloads above the threshold to the configured
  store, stripping `data` from the in-memory state.
  `materializeArtifact(key)` resolves inline-or-external transparently
  and verifies hash on fetch.
- **Run bundle migration framework.** `migrateRunBundle()`,
  `registerRunBundleMigration()`, and `listRunBundleMigrations()` let
  hosts evolve `protocolVersion` over time without invalidating
  outstanding bundles. `parseRunBundleJson({ migrate: true })` (default)
  upgrades inputs to the current `WORKBENCH_PROTOCOL_VERSION` before
  validation. New `UNSUPPORTED_PROTOCOL_VERSION` error code.
- **JSON Patch validation.** New `JsonPatchOpSchema` (Zod discriminated
  union enforcing RFC 6902 strictly), wired into `artifact_patch` trace
  events and `WorkbenchSession.patchArtifact`.
- **`@llm-workbench/web` (apps/web).** New Next.js 16 reference
  deployment showing how to run the runtime against real infrastructure
  — Supabase Postgres for `RunRepository`, Clerk for auth, Vercel AI
  Gateway for model calls, AI SDK v5 streaming. Includes a server-side
  `RunRepository` adapter, a job-search workflow, and a saved-runs
  browser. PolyForm Noncommercial 1.0.0.
- **Headless agentic surface (apps/web).** Static
  [`/llms.txt`](https://llmstxt.org/), `/llms-full.txt`, `/agents.md`,
  `/robots.txt`, and `/sitemap.xml`; an OpenAPI 3.1 document at
  `/api/openapi.json`; an MCP server at `/api/mcp` advertised via
  `/.well-known/mcp.json`; a public read-only demo run at
  `/runs/demo`. Run API responses include
  `Link: </api/openapi.json>; rel="describedby"`.
- **`WorkflowGraph`.** New default-export React component (`@llm-workbench/ui`)
  that renders `workflowSnapshot` + `stepStatus` with `@xyflow/react`
  laid out by `dagre` and stays in sync with the live run via
  `useWorkbenchRunRevision`.
- **`MonacoArtifactEditor`.** New optional, lazy-loaded component for
  rich JSON artifact viewing/editing, opted in via `WorkbenchShell`'s
  new `useMonacoEditor` prop.
- **DCO and release CI.** New
  `.github/workflows/dco.yml` enforcing `Signed-off-by:` on every PR
  commit, and `.github/workflows/release.yml` (tag-driven, Sigstore
  provenance, refuses tags not reachable from `main`).

### Changed

- **License (BREAKING for the four core packages).** Re-licensed
  `@llm-workbench/runtime`, `@llm-workbench/adapters-react`,
  `@llm-workbench/ai-sdk`, and `@llm-workbench/ui` to **Apache 2.0**
  (full LICENSE text in each package, SPDX `Apache-2.0` in
  `package.json`). Examples follow the same Apache 2.0 license. The
  hosted reference plane under `apps/web` and the repository root keep
  PolyForm Noncommercial 1.0.0 for source-available, paid-commercial
  use. `LICENSES/Apache-2.0.txt` and
  `LICENSES/PolyForm-Noncommercial-1.0.0.txt` carry reference copies.
  See `COMMERCIAL.md` and `CONTRIBUTING.md` for the per-path inbound
  rules.
- **`WorkbenchShell` — modernized UI.** All CSS classes scoped under a
  `.lwb-root` container with `lwb-` prefixes (was `wb__`), all variables
  under `--lwb-*`. Rule reordering rebuilt on `@dnd-kit/core` +
  `@dnd-kit/sortable` for full keyboard accessibility. Trace event list
  switches to `react-virtuoso` virtualization above 100 events with an
  auto-scroll toggle. Artifact panel can opt into `MonacoArtifactEditor`.
  No public-API breakage; the existing `WorkbenchShell` props still work.
- **`stableStringify` hardening.** Now rejects `undefined` values inside
  arrays, functions, symbols, and cyclic structures with explicit
  `WorkbenchError("INVALID_INPUT")` instead of producing inconsistent
  output. Used wherever bundle integrity hashing happens.
- **`WorkbenchSession.failStep`.** Accepts a new `failFast?: boolean`
  option that transitions the run to `failed` and marks the trace error
  fatal in one step (previously two calls).
- **`WorkbenchSession.buildUserExportBundle`.** New
  `keepMetadata?: boolean` option (default `false`); previous behavior
  was unconditionally to drop `run.metadata`.
- **`inferEngineFromTrace` strictness.** `step_started`,
  `step_completed`, and `human_gate_resolved` trace events that
  reference unknown step ids now throw
  `WorkbenchError("UNKNOWN_STEP")` instead of silently being skipped.
- **Reference HTTP server hardening.** `examples/run-repo-server`
  enforces a 25 MB body limit, a 1 000-run in-memory cap, structural
  validation of `RunStoreState` payloads on `PUT`, strict JSON parsing,
  and consistent error responses. The file now opens with explicit
  `SECURITY` warnings against production use.
- **Job-search demo CSS.** Migrated from `wb__*` to `lwb-*` class names.

### Deprecated

- `ArtifactPointer.sha256` — kept as an alias for back-compat. New
  pointers should set `payloadHash`; readers should prefer
  `getArtifactPayloadHash(pointer)`.
- `RunContextRef.parentRunId` (singular) — kept for back-compat. New
  code should set `parentRunIds: string[]` and read via
  `getParentRunIds(ctx)`.

## 0.1.0 — 2026-04-27

Initial monorepo: runtime (protocol, runtime, schema registry,
persistence ports, bundle import/export with integrity), UI shell, and
React adapters. Job-search demo and reference HTTP run repo server.
