# Changelog

All notable changes to LLM Workbench are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Four new blog posts.** Added `Anatomy of a run bundle`, `Why our demo runs
  the One Ring and a DeLorean`, `Hunting unsafe-eval`, and a `Shipping log`
  recap under `apps/web/content/blog`, dated across the prior cadence
  (2026-05-12 → 2026-06-13). Markdown-only; content is validated by the existing
  blog front-matter schema and index tests, and the recap links internally to
  `/blog/hunting-unsafe-eval`.
- **Mobile navigation and FAQ page.** Added a keyboard-accessible mobile
  hamburger menu that exposes Blog, Demo, Protocol, FAQ, and signed-in app
  links on phones, plus a `/faq` page with visible Q&A and FAQPage JSON-LD
  generated from one shared FAQ array.
- **Ajv precompiled validator machinery.** Added build-time standalone Ajv
  validator generation for runtime and landing-demo schemas, plus freshness
  tests and typed generated output for future client wiring. CSP and runtime
  client behavior are unchanged in this slice.
- **Landing hero drifting craft.** The hero background now occasionally launches
  a tiny, low-opacity sci-fi silhouette across the starfield as a separate
  pointer-ignored, reduced-motion-safe overlay behind the content.
- **Beloved-story public demo runs.** `/runs/demo` now rotates through five
  seeded agent traces — Fellowship Logistics Agent, Owl Post Admissions Agent,
  DeLorean Flight Computer, Ultimate Question Solver, and Golden Ticket
  Auditor — with `?s=<id>` pinning for shareable verification links. Scenario
  content and permissive artifact schemas live under `apps/web`; the runtime
  package and job-search reference workflow are unchanged.

### Fixed

- **Rate limiter recognizes Vercel's Upstash (`KV_*`) env names.** Vercel's
  "Upstash for Redis" Marketplace integration injects `KV_REST_API_URL` /
  `KV_REST_API_TOKEN`, not `UPSTASH_REDIS_REST_*`. The edge rate limiter now
  reads either scheme (native `UPSTASH_REDIS_REST_*` first, then the `KV_*`
  vars), so the limiter actually engages when Redis is provisioned through the
  integration instead of silently treating it as unconfigured.
- **Landing atmosphere no longer throws under `prefers-reduced-motion`.** `CosmosField`
  called `paintStatic()` from its initial `resize()` before that `const` arrow function was
  initialized (temporal dead zone), throwing a `ReferenceError` and leaving the
  reduced-motion fallback blank. The `ResizeObserver`/`resize()` setup now runs after the
  paint helpers are defined; behavior is otherwise unchanged.
- **Demo/run viewer no longer hangs on "Hydrating run…" when navigating between runs.**
  `RunDetailClient` is now keyed by `runId` at both call sites (`/runs/demo` and the
  authenticated `/runs/[runId]` viewer), so a client-side navigation to a new run
  remounts the component and re-hydrates cleanly instead of reusing stale state. Pinned
  by an e2e that navigates demo→demo via the header link.
- **Error-path hardening (runtime + MCP).** `cancelRunCascade` now logs
  nodes that refuse cancellation instead of silently skipping them;
  `materializeArtifact` JSON errors include the store ref and payload size;
  MCP `verify_run_integrity` / `validate_run_bundle` reject non-serializable
  bundles with a clean message and cap serialized input at 25 MiB.

### Security

- **Production CSP no longer needs `'unsafe-eval'`.** The run-detail client now
  registers demo and scenario schemas with build-time Ajv standalone validators
  and a coverage guard that fails loudly if any client schema is missing its
  precompiled validator. Production nonce CSP removes `'unsafe-eval'`,
  superseding the earlier Ajv eval hotfix; development and no-nonce response
  paths keep it for Turbopack HMR / legacy compatibility.
- **CI audit gate now reads clean via an allowlisted `audit-ci` gate.** Added the
  `audit-ci` dev dependency + `audit-ci.jsonc`, an `npm run audit:check` script, and
  replaced the prod-high `npm audit` CI step with `npm run audit:check`. The gate fails
  on ANY advisory of low severity or higher that is not explicitly allowlisted **by GHSA
  id**; the 10 current no-fix advisories are allowlisted with documented revisit triggers
  — `@ai-sdk/provider-utils` (1 low, GHSA-866g-f22w-33x8; needs ai@6), `dompurify`
  (8 moderate; Monaco vendors its own copy, needs monaco > 0.55.1), and `postcss`
  (1 moderate, GHSA-qx2v-qp2m-jg93; via Next.js). A new, non-allowlisted advisory at any
  severity now breaks CI. Note: bare `npm audit` still lists these 9 packages (npm has no
  native suppression) — only the project gate (`npm run audit:check`) reads clean. No
  runtime source changed.
- **Moderate advisory cleanup (uuid via Resend; dompurify investigated & deferred).**
  Bumping `resend` `^6.12.2`→`^6.12.4` removes the `svix`→`uuid@10.0.0` subtree
  entirely — Resend replaced Svix with `standardwebhooks` at 6.12.3+ — clearing the
  uuid buffer-bounds advisory (GHSA-w5hq-g745-h8pq). The eight moderate `dompurify`
  advisories were investigated and **deferred**: `monaco-editor@0.55.1` (the latest)
  vendors its own DOMPurify at `esm/vs/base/browser/dompurify/dompurify.js` and imports
  that, not the `dompurify` npm package — Monaco is the only package that declares
  `dompurify` and it never imports it, so the npm-level finding is a phantom. A
  `dompurify` override neither resolves (npm keeps `3.2.7` as `invalid … overridden`)
  nor would change the code Monaco ships, and `0.55.1` is the latest release, so the
  finding is tracked for a future Monaco bump rather than papered over. Dev-inclusive
  and production high audit gates stay at exit 0 (the esbuild 0.28.1 override is
  untouched); residual `npm audit` drops 12 → 9 (3 low `@ai-sdk`, 6 moderate including
  the deferred `dompurify` and `postcss` chains). No runtime source changed.
- **Esbuild advisory remediation.** A single root Vite child override forces
  esbuild to 0.28.1, clearing six high advisories
  (GHSA-gv7w-rqvm-qjhr, GHSA-g7r4-m6w7-qqqr): esbuild plus Vite, Vitest,
  vite-node, `@vitest/mocker`, and `@vitejs/plugin-react` entries flagged
  only transitively through esbuild. `job-search-demo` moves to Vite 8 and
  `@vitejs/plugin-react` 6 so its build supports the fixed esbuild path.
  Exposure is dev/build-only, production was already clean, and no runtime
  package majors were upgraded.
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

- **Landing one-import demo now matches the DeLorean theme.** The code-diff
  sample now uses the DeLorean flight computer, `computePower`, and `88 mph`
  power-planning copy, while the telemetry rain swaps the remaining
  job-search sample keys for `setCircuits`, `flightCard`, and `launch`.
- **Landing hero now previews a DeLorean time-jump trace.** The live workflow
  console and static fallback now show `setCircuits → power → launch` with the
  `claude-sonnet-4-5` power-planning event, and the Three.js wire rings are
  offset around the console so the hero subheading stays unobstructed.
- **Landing hero starfield no longer reacts to the cursor.** Removed the pointer-parallax
  camera follow (Three.js hero) and the mouse-attraction force (canvas fallback). Stars keep
  their ambient drift, nebula glow, sparkles, and ring rotation, but no longer move in response
  to pointer input.
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

### Added (Unreleased, continued)

- **Reviewer-facing docs.** Added example READMEs for `job-search-demo` and
  `run-repo-server`, plus a live-demo callout, reviewer start-here path, and
  builder/verifier process explainer in the root README.
- **Runtime controller unit coverage (part 2).** Added dedicated unit suites
  for `ArtifactController`, `RuleController`, and `TraceController`,
  completing controller-decomposition coverage with per-method mutation,
  error-code, idempotency, routing, and trace-event assertions.
- **Runtime controller unit coverage (part 1).** Added dedicated unit suites
  for `RunLifecycleController`, `GateController`, and `StepController`,
  pinning controller-local error codes, state mutations, and trace-event
  shapes so future decomposition refactors are safer.
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
