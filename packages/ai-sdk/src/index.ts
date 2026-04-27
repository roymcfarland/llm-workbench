/**
 * `@llm-workbench/ai-sdk` — Vercel AI SDK v5 adapters that emit LLM Workbench
 * trace events automatically.
 *
 * Each `traced*` helper is a drop-in replacement for the corresponding AI SDK
 * function (`generateText`, `streamText`, `generateObject`, `streamObject`)
 * and produces correlation-linked `model_io` request/response/stream_chunk
 * events plus `tool_call` events on the supplied `WorkbenchSession`. The AI
 * SDK return value is passed through unchanged.
 *
 * The runtime keeps no compile-time dependency on `ai`; this package depends
 * on `ai` and `zod` as peer dependencies so apps own which AI SDK version
 * they ship.
 *
 * @packageDocumentation
 */
export { tracedGenerateText, type TracedGenerateTextOptions } from "./generateText.js";
export { tracedStreamText, type TracedStreamTextOptions } from "./streamText.js";
export {
  tracedGenerateObject,
  type TracedGenerateObjectOptions,
} from "./generateObject.js";
export {
  tracedStreamObject,
  type TracedStreamObjectOptions,
} from "./streamObject.js";
export { traceTools, type TraceToolsOptions } from "./tools.js";
export { costFromGatewayMetadata } from "./internal.js";
export type { WorkbenchTraceContext, WriteArtifactOptions } from "./types.js";
