# `@llm-workbench/ai-sdk`

**MIT-licensed** — [Vercel AI SDK](https://sdk.vercel.ai) wrappers supporting AI SDK v5 and v7 for [LLM Workbench](../../README.md). Call your model through these instead of the bare AI SDK functions, and each call automatically records a correlated `model_io` trace event (provider, model, token usage, duration) — plus `tool_call` events and AI-Gateway cost — into the active run.

```bash
npm install @llm-workbench/ai-sdk @llm-workbench/runtime ai zod
```

## API surface

| Export | Wraps (from `ai`) |
| --- | --- |
| `tracedGenerateText` / `tracedStreamText` | `generateText` / `streamText` |
| `tracedGenerateObject` / `tracedStreamObject` | `generateObject` / `streamObject` |
| `traceTools` | a tool set, so each invocation logs a `tool_call` event |
| `costFromGatewayMetadata` | derives cost from Vercel AI Gateway response metadata |

Each `traced*` call takes a `WorkbenchSession` first, then an options object: for example, `tracedGenerateText(session, opts)`. The options combine the corresponding AI SDK options with `WorkbenchTraceContext` (`stepId?`, `correlationId?`, `detail?`) and an optional `writeArtifact` hook. See the typed options (`TracedGenerateTextOptions`, etc.) and the reference wiring in [`apps/web`](../../apps/web).

Supported peers are `ai: ^5.0.0 || ^7.0.0` and `zod: ^3.23.8 || ^4.0.0`.

## Docs

- Overview and architecture: repository root [`README.md`](../../README.md).
- Getting started: https://www.llmworkbench.io/docs/getting-started
- Architecture deep-dive: https://www.llmworkbench.io/docs/architecture
- Generated API reference: https://www.llmworkbench.io/docs/api
