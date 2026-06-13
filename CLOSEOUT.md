# Closeout: Runtime Controller Unit Tests, Part 1

This slice adds dedicated unit coverage for `RunLifecycleController`,
`GateController`, and `StepController`. The suites pin controller-local error
codes, state transitions, and trace-event shapes without changing production
runtime code.

## Mid-build Stop and Spec Amendment

During the build, the original GateController checklist item 1 asserted that
`requestGate` sets the targeted gate slot to `pending`. The builder hard-stopped
instead of writing that test because the current code does not do this. Advisor
review confirmed the code is correct by design: `requestGate` is a trace-only
announcer for `human_gate_requested`, while gate-slot mutations are owned by
`initialGateState()` at run start (`gates.ts:15-28`) and by `completeStep` for
after-gate engagement (`stepController.ts:58-65`). The checklist was amended to
pin item 1a, the announcer non-mutation contract using a `structuredClone`
before/after assertion, and item 1b, initial slot state per policy. Those
amended expectations are implemented in `gateController.test.ts`, with no
production-code changes.

## Test Inventory

New tests added: 20.

### runLifecycleController.test.ts

- `assertRunActive rejects terminal statuses with the requested action in the message`
- `completeRun rejects terminal transition while any step is still running`
- `completeRun and cancelRun set terminal status, endedAt, and append run_status_changed`
- `failRun marks the run failed and preserves the error in trace`
- `exportRunBundle rejects profile "user" without a registry`
- `completeRun rejects a second terminal transition`

### gateController.test.ts

- `requestGate appends a human_gate_requested event for each gate kind without mutating gate state`
- `initializes gate slots per policy at run start`
- `resolveGate records each decision, note, and before-slot transition`
- `resolveGate updates the after slot for PAUSE_AFTER gates`
- `resolveCheckpoint mutates only the targeted checkpoint slot`
- `resolveGate and resolveCheckpoint reject unknown step ids`
- `rejects every gate operation once the run is no longer running`

### stepController.test.ts

- `beginStep starts a ready AUTO step and appends step_started`
- `beginStep returns a BlockReason for an unresolved PAUSE_BEFORE gate without mutating status or trace`
- `assertCanStartStep rejects a non-pending step`
- `completeStep rejects unknown and non-running steps with controller-specific codes`
- `completeStep on PAUSE_AFTER completes the step and requests the after gate`
- `failStep without failFast fails the step, leaves the run running, and appends a non-fatal error`
- `failStep with failFast also transitions the run to failed`

## Evidence

### Runtime suite

`npm test -w @llm-workbench/runtime`

Result: exit 0. Runtime test count is now 125 (105 baseline + 20 new).

```text
✓ src/runtime/gateController.test.ts (7 tests) 15ms
✓ src/runtime/stepController.test.ts (7 tests) 17ms
✓ src/runtime/runLifecycleController.test.ts (6 tests) 79ms

Test Files  16 passed (16)
     Tests  125 passed (125)
```

### Full CI

`npm run ci`

Result: exit 0. Workspace Vitest count is now 270:

```text
runtime: 125
adapters-react: 1
ai-sdk: 27
ui: 13
mcp: 14
scripts: 18
web: 72
total: 270
```

CI tail:

```text
✓ Compiled successfully in 10.5s
✓ Completed runAfterProductionCompile in 629ms
Finished TypeScript in 5.1s ...
✓ Generating static pages using 7 workers (51/51) in 943ms
Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /.well-known/mcp.json
├ ƒ /.well-known/security.txt
├ ƒ /agents.md
├ ƒ /api/health
├ ƒ /api/llm
├ ƒ /api/mcp
├ ƒ /api/openapi.json
├ ƒ /api/runs
├ ƒ /api/runs/[runId]
├ ƒ /blog
├ ƒ /blog/[slug]
├ ● /blog/[slug]/opengraph-image/[__metadata_id__]
├ ● /blog/[slug]/twitter-image/[__metadata_id__]
├ ○ /blog/opengraph-image
├ ƒ /blog/tags/[tag]
├ ● /blog/tags/[tag]/opengraph-image/[__metadata_id__]
├ ● /blog/tags/[tag]/twitter-image/[__metadata_id__]
├ ○ /blog/twitter-image
├ ƒ /docs/protocol
├ ƒ /feed.xml
├ ƒ /humans.txt
├ ƒ /llms-full.txt
├ ƒ /llms.txt
├ ○ /opengraph-image
├ ƒ /playground
├ ƒ /robots.txt
├ ƒ /runs
├ ƒ /runs/[runId]
├ ƒ /runs/demo
├ ƒ /sign-in/[[...sign-in]]
├ ƒ /sign-up/[[...sign-up]]
├ ƒ /sitemap.xml
└ ○ /twitter-image

ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand
```
