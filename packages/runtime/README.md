# `@llm-workbench/runtime`

**MIT-licensed** — the headless, model-agnostic core of [LLM Workbench](../../README.md). Records workflow state, artifacts, rules, human-review gates, traces, and cost telemetry, and exports tamper-evident run bundles. No React or framework dependency — runs in the browser, Node, or edge-style runtimes.

```bash
npm install @llm-workbench/runtime
```

## API surface

| Export | Role |
| --- | --- |
| `WorkbenchRuntime` / `WorkbenchSession` | start runs; drive steps and gates; write & patch artifacts; log model I/O and tool calls |
| `SchemaRegistry` | register JSON Schemas and Ajv-validate artifacts before they become run state |
| `MemoryRunRepository`, IndexedDB, HTTP adapters | pluggable persistence behind one `RunRepository` interface |
| `parseRunBundleJson` / `verifyRunBundleIntegrity` | import/verify SHA-256-signed, canonical-JSON run bundles |
| `summarizeModelTelemetry` | typed cost/usage ledger grouped by provider, model, step, user, tenant, plan |
| `WorkbenchError` | structured errors with stable `code`s across package boundaries |

## Quick start

A complete, runnable example lives in the repository root [`README.md`](../../README.md#60-second-integration). It imports the package and exercises gates, artifacts, model-I/O telemetry, and a signed bundle export under plain Node.

## Docs

Overview, architecture, scope, and non-goals: repository root [`README.md`](../../README.md) and [`PROJECT.md`](../../PROJECT.md).
