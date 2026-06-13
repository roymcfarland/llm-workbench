# Closeout: Runtime Controller Unit Tests, Part 2

This slice adds dedicated unit coverage for `ArtifactController`,
`RuleController`, and `TraceController`. It completes controller-decomposition
coverage for the six controllers with test-only changes and no production-code
edits.

## Test Inventory

New tests added: 22.

### artifactController.test.ts

- Checklist 1: `writeArtifact stores versions and appends artifact_written events`
- Checklist 2: `writeArtifact rejects empty artifactKey and typeId`
- Checklist 3: `writeArtifact returns the cached version for unchanged idempotency replay`
- Checklist 4: `writeArtifact rejects stale and cross-artifact idempotency key reuse`
- Checklist 5: `writeArtifactAsync auto-routes large payloads externally and small payloads inline`
- Checklist 6: `writeArtifactAsync rejects routing "external" without a store`
- Checklist 7: `materializeArtifact rejects unknown keys and returns inline data directly`
- Extra controller edge: `materializeArtifact rejects external artifacts when no store is configured`
- Checklist 8: `patchArtifact applies JSON Patch, versions the artifact, and rejects unknown keys`

### ruleController.test.ts

- Checklist 1: `replaceRuleSet stores and overwrites rule sets while appending rule_changed`
- Checklist 2: `reorderRules applies a valid permutation, renumbers priorities, and appends rule_changed`
- Checklist 3: `reorderRules rejects unknown rule sets and unknown rule ids`
- Checklist 4: `annotate appends annotation without mutating run state`
- Checklist 5: `forkNotice appends run_forked without mutating run state`

### traceController.test.ts

- Checklist 1: `logModelIO preserves full payloads, strips summary payloads, and mutates no state`
- Checklist 1: `logModelIO defaults to summary detail and strips payload without mutating state`
- Checklist 2: `beginSpan emits span_started and end appends span_ended only once`
- Checklist 3: `end records error status and payload on span_ended`
- Checklist 4: `span resolves the callback value and emits a single ok span`
- Checklist 4: `span records WorkbenchError details and rethrows the original error`
- Checklist 5: `logToolCall rejects empty names and appends valid tool_call events without state mutation`
- Checklist 6: `rejects TraceController writes once the run is terminal`

## Evidence

### Runtime suite

`npm test -w @llm-workbench/runtime`

Result: exit 0. Runtime test count is now 147 (125 baseline + 22 new).

```text
✓ src/runtime/artifactController.test.ts (9 tests) 18ms
✓ src/runtime/traceController.test.ts (8 tests) 14ms
✓ src/runtime/ruleController.test.ts (5 tests) 13ms

Test Files  19 passed (19)
     Tests  147 passed (147)
```

### Full CI

`npm run ci`

Result: exit 0. Workspace Vitest count is now 292:

```text
runtime: 147
adapters-react: 1
ai-sdk: 27
ui: 13
mcp: 14
scripts: 18
web: 72
total: 292
```

CI tail:

```text
✓ Compiled successfully in 9.1s
✓ Completed runAfterProductionCompile in 485ms
Finished TypeScript in 4.8s ...
✓ Generating static pages using 7 workers (51/51) in 891ms
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
