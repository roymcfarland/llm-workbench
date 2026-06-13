# Changelog

All notable changes to LLM Workbench are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Error-path hardening (runtime + MCP).** `cancelRunCascade` now logs
  nodes that refuse cancellation instead of silently skipping them;
  `materializeArtifact` JSON errors include the store ref and payload size;
  MCP `verify_run_integrity` / `validate_run_bundle` reject non-serializable
  bundles with a clean message and cap serialized input at 25 MiB.

### Security

- **Production CSP script hardening.** `script-src` now uses a per-request
  nonce with `'strict-dynamic'` for production-rendered pages, and
  `'unsafe-eval'` is removed from the effective production script policy.
  `'unsafe-inline'` and script host sources remain only as CSP2 fallbacks that
  nonce-supporting browsers ignore. Development keeps the permissive script
  policy for Turbopack HMR. `style-src 'unsafe-inline'` is unchanged and
  accepted for now because Monaco, React Flow, and theme inline styles depend
  on it.
- **Production CSP Ajv eval hotfix.** Corrected the nonce policy to retain
  `'unsafe-eval'` because Ajv compiles schema validators in the browser via
  `new Function`. This was discovered as a production EvalError on
  `/runs/demo` after #17; nonce + `'strict-dynamic'` inline-injection
  protection is unaffected. Removal is tracked behind an Ajv standalone
  precompilation slice.
- **Production-scope dependency audit gate.** CI now runs
  `npm audit --omit=dev --audit-level=high`, so the gate covers
  shippable dependency exposure while dev-toolchain-only esbuild/vite/vitest
  majors remain tracked in a scoped dependency-upgrade slice. A non-force
  `npm audit fix` updated only `package-lock.json`; current registry metadata
  still reports non-gating moderate `dompurify` / `uuid` findings through the
  locked Monaco/Resend transitive paths, so those remain follow-up items.
- **Dependency advisory remediation (lockfile-only).** `npm audit fix`
  cleared the high/critical audit gate from the 21-vulnerability baseline
  (1 critical, 4 high), including the Next.js middleware/proxy bypass
  (GHSA-26hh-7cqf-hhc6) and the Vitest UI arbitrary-file-read
  (GHSA-5xrq-8626-4rwp). No `package.json` ranges changed; no major
  versions changed. `npm audit` now reports 12 residual moderate/low
  findings for follow-up dependency slices.
- **Rate limiting fails closed in production.** When Upstash Redis is not
  configured, `/api/*` routes (except `/api/health`) now return `503` in
  production instead of silently running unlimited. Deliberate opt-out via
  `RATE_LIMIT_ALLOW_UNCONFIGURED=1`. `X-Frame-Options` tightened
  `SAMEORIGIN` → `DENY` to match the CSP's `frame-ancestors 'none'`.

### Changed

- **Package-wide linting and audit gate.** ESLint now covers all
  `packages/*` sources via a root flat config (`no-console` enforced;
  `_`-prefixed unused values allowed). CI now runs package linting and
  `npm audit --audit-level=high`; three package lint findings were fixed
  (ai-sdk empty interface → type alias, `WorkbenchError` casts
  `Function` → `unknown`, and a dead runtime type import).
- **CI hardening against Playwright CDN wedges.** The `build & test` job now
  has a 20-minute job timeout; the Chromium install and smoke steps have
  step timeouts (10/8 min); Playwright browsers are cached keyed on the
  installed Playwright version, so warm runs skip the CDN download entirely.
  The root cause was Playwright < 1.60's yauzl extraction hang on Node 24.16+;
  `@playwright/test` is now bumped to `^1.60.0`.
- **License — proprietary.** The repository is now governed by a single
  proprietary license (see `LICENSE` and `PROJECT.md`). The previous
  dual-licensed (Apache 2.0 / PolyForm Noncommercial 1.0.0) posture has
  been retired. No packages were published to npm under the prior posture,
  so the change is forward-looking only. Outside contributions are no
  longer accepted; see `CONTRIBUTING.md`. Tag-driven release publishing
  (`.github/workflows/release.yml`) and DCO enforcement
  (`.github/workflows/dco.yml`) have been removed.
- **`apps/web/proxy.ts` → `apps/web/middleware.ts`.** Renamed to match
  Next.js's standard middleware filename convention.
- **`docs/HANDOFF.md` removed.** Superseded by `PROJECT.md` as the
  authoritative spec.

### Added

- **`PROJECT.md`** — authoritative source of truth for purpose, scope,
  non-goals, and the rules that automated reviewers enforce on every PR.
- **`@llm-workbench/mcp`** — transport-agnostic Model Context Protocol
  package that exposes the LLM Workbench runtime over MCP. Wire any
  `RunRepository` to `createWorkbenchMcpServer({ runRepository, listRunIds?, name?, version? })`
  to get a configured server with tools (`list_runs`, `get_run`,
  `verify_run_integrity`, `validate_run_bundle`) and `runs://{runId}`
  resources. `createWorkbenchMcpHttpHandler({ server })` returns a
  Web-standard `(req: Request) => Promise<Response>` adapter for Next.js
  Route Handlers, Hono, edge functions, etc.

### Changed (Unreleased, continued)

- **`apps/web` MCP route.** `apps/web/app/api/mcp/route.ts` now imports
  from `@llm-workbench/mcp`. Clerk auth happens at the route boundary
  (returns `401` when unauthenticated) and a tenant-scoped
  `RunRepository` adapter feeds the package server. The reference
  deployment continues to register `start_run` / `resolve_gate` /
  `write_artifact` / `export_bundle` on top of the package's read-only
  surface.

## 0.2.0

The first internal release containing the runtime, UI, AI SDK adapter,
and the `apps/web` reference deployment. The runtime adds
hierarchical tracing, agent-of-agents supervision, externalizable
artifact payloads, and a Vercel AI SDK v5 adapter; the UI gets a scoped
CSS rebuild with accessible reordering and a workflow graph; and a real
hosted reference deployment ships under `apps/web`.

### Added

- **`@llm-workbench/ai-sdk`** — new package wrapping Vercel AI SDK v5
  (`tracedGenerateText`, `tracedStreamText`, `tracedGenerateObject`,
  `tracedStreamObject`, `traceTools`, plus `costFromGatewayMetadata`)
  that automatically emits correlated `model_io` and `tool_call` trace
  events for every model call and tool invocation.
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
  `RunRepository` adapter, job-search workflow, and a saved-runs browser.
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

### Changed

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
