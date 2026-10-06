# `@llm-workbench/runtime`

**MIT-licensed** — the headless, model-agnostic core of [LLM Workbench](../../README.md). Records workflow state, artifacts, rules, human-review gates, traces, and cost telemetry, and exports tamper-evident run bundles. No React or framework dependency — runs in the browser, Node, or edge-style runtimes.

```bash
npm install @llm-workbench/runtime
```

## API surface

| Export | Role |
| --- | --- |
| `WorkbenchRuntime` / `WorkbenchSession` | start runs; drive steps and gates; write & patch artifacts; log model I/O and tool calls |
| `SchemaRegistry` | register JSON Schemas and explicitly validate artifacts and rule payloads; bare `session.writeArtifact` does not validate against registered schemas |
| `validatedWriteArtifact` / `validatedReplaceRuleSet` | validate with a `SchemaRegistry` before writing an artifact or replacing a rule set through a session |
| `MemoryRunRepository`, IndexedDB, HTTP adapters | pluggable persistence behind one `RunRepository` interface |
| `parseRunBundleJson` / `verifyRunBundleIntegrity` | parse and verify canonical-JSON run bundles that carry a SHA-256 integrity hash (attached on export; migrating an older bundle does not re-attach it). The hash detects modification but does not prove who produced the bundle. |
| `summarizeModelTelemetry` | typed cost/usage ledger grouped by provider, model, step, user, tenant, plan |
| `WorkbenchError` | structured errors with stable `code`s across package boundaries |

## Quick start

A complete, runnable example lives in the repository root [`README.md`](../../README.md#60-second-integration). It imports the package and exercises gates, artifacts and model-I/O telemetry under plain Node. `npm run smoke:esm` additionally exports a run bundle with a SHA-256 integrity hash.

## Docs

- Overview, architecture, scope, and non-goals: repository root [`README.md`](../../README.md) and [`PROJECT.md`](../../PROJECT.md).
- Getting started: https://www.llmworkbench.io/docs/getting-started
- Architecture deep-dive: https://www.llmworkbench.io/docs/architecture
- Generated API reference: https://www.llmworkbench.io/docs/api
