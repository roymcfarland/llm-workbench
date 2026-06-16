# `@llm-workbench/ai-sdk`

**MIT-licensed** — [Vercel AI SDK](https://sdk.vercel.ai) wrappers for [LLM Workbench](../../README.md). Call your model through these instead of the bare AI SDK functions, and each call automatically records a correlated `model_io` trace event (provider, model, token usage, duration) — plus `tool_call` events and AI-Gateway cost — into the active run.

```bash
npm install @llm-workbench/ai-sdk @llm-workbench/runtime ai
```

## API surface

| Export | Wraps (from `ai`) |
| --- | --- |
| `tracedGenerateText` / `tracedStreamText` | `generateText` / `streamText` |
| `tracedGenerateObject` / `tracedStreamObject` | `generateObject` / `streamObject` |
| `traceTools` | a tool set, so each invocation logs a `tool_call` event |
| `costFromGatewayMetadata` | derives cost from Vercel AI Gateway response metadata |

Each traced call takes a `WorkbenchTraceContext` (the session + step) alongside the standard AI SDK options. See the typed options (`TracedGenerateTextOptions`, etc.) and the reference wiring in [`apps/web`](../../apps/web).

## Docs

Overview and architecture: repository root [`README.md`](../../README.md).
