import { streamText } from "ai";
import type { WorkbenchSession } from "@llm-workbench/runtime";
import {
  costFromGatewayMetadata,
  errorToTrace,
  newCorrelationId,
  resolveProviderModel,
  summarizePromptInput,
  usageFromAi,
} from "./internal.js";
import { emitToolCallTraces, persistArtifact } from "./generateText.js";
import type { WorkbenchTraceContext, WriteArtifactOptions } from "./types.js";

type StreamTextFirstArg = Parameters<typeof streamText>[0];
type StreamTextResult = ReturnType<typeof streamText>;

const STREAM_CHUNK_DEBOUNCE_MS = 250;
/** Cap on the size of buffered tail tokens that ride along with each
 *  `stream_chunk` trace event so we never balloon the trace payload. */
const STREAM_CHUNK_TAIL_LIMIT = 200;

/**
 * Options for {@link tracedStreamText}: every option supported by the AI SDK
 * `streamText`, plus tracing/artifact hooks. Caller-supplied `onChunk`,
 * `onFinish`, and `onError` callbacks are still invoked — we only compose
 * additional behaviour around them.
 */
export type TracedStreamTextOptions = StreamTextFirstArg &
  WorkbenchTraceContext & {
    /** Persist the final concatenated `text` as an artifact once the stream finishes. */
    writeArtifact?: WriteArtifactOptions<{ text: string; result: unknown }>;
  };

/**
 * Drop-in wrapper around AI SDK `streamText` that emits LLM Workbench traces
 * for the request, debounced `stream_chunk` events (at most one every ~250 ms),
 * the final response with usage/cost/duration, tool calls, and any error.
 *
 * Returns the original `streamText` result so callers iterate `textStream`,
 * `fullStream`, or read `usage` exactly as if they had called `streamText`
 * directly.
 *
 * @param session The active `WorkbenchSession` recording trace events.
 * @param opts AI SDK `streamText` options plus optional tracing/artifact
 *   metadata. `stepId`, `correlationId`, `detail`, and `writeArtifact` are
 *   stripped from the options forwarded to the AI SDK.
 */
export function tracedStreamText(
  session: WorkbenchSession,
  opts: TracedStreamTextOptions,
): StreamTextResult {
  const {
    stepId,
    correlationId: explicitCorrelationId,
    detail,
    writeArtifact,
    ...aiOpts
  } = opts;

  const correlationId = explicitCorrelationId ?? newCorrelationId();
  const summary = summarizePromptInput(aiOpts);
  const initial = resolveProviderModel((aiOpts as { model?: unknown }).model);
  const startedAt = Date.now();

  session.logModelIO({
    stepId,
    correlationId,
    direction: "request",
    provider: initial.provider,
    model: initial.model,
    summary,
    payload: detail === "full" ? aiOpts : undefined,
    detail,
  });

  const userOnChunk = (aiOpts as { onChunk?: (...args: unknown[]) => void })
    .onChunk;
  const userOnFinish = (aiOpts as { onFinish?: (...args: unknown[]) => void })
    .onFinish;
  const userOnError = (aiOpts as { onError?: (...args: unknown[]) => void })
    .onError;

  let lastEmit = 0;
  let tail = "";

  const onChunk = (event: unknown) => {
    if (event && typeof event === "object") {
      const chunk = (event as { chunk?: unknown }).chunk ?? event;
      if (chunk && typeof chunk === "object") {
        const c = chunk as { type?: unknown; text?: unknown; delta?: unknown };
        if (c.type === "text-delta") {
          const t =
            typeof c.text === "string"
              ? c.text
              : typeof c.delta === "string"
                ? c.delta
                : "";
          if (t) tail = clipTail(tail + t);
        }
      }
    }
    const now = Date.now();
    if (now - lastEmit >= STREAM_CHUNK_DEBOUNCE_MS) {
      lastEmit = now;
      session.logModelIO({
        stepId,
        correlationId,
        direction: "stream_chunk",
        provider: initial.provider,
        model: initial.model,
        durationMs: now - startedAt,
        summary: tail,
      });
    }
    userOnChunk?.(event as never);
  };

  const onFinish = (event: unknown) => {
    const durationMs = Date.now() - startedAt;
    const result =
      event && typeof event === "object"
        ? (event as Record<string, unknown>)
        : {};
    const resolved = resolveProviderModel(
      (aiOpts as { model?: unknown }).model,
      result,
    );
    const usage = usageFromAi(result.usage);
    const cost = costFromGatewayMetadata(result.providerMetadata);
    const text = typeof result.text === "string" ? (result.text as string) : "";
    session.logModelIO({
      stepId,
      correlationId,
      direction: "response",
      provider: resolved.provider,
      model: resolved.model,
      usage,
      cost,
      durationMs,
      summary: text ? clipTail(text) : tail,
      payload: detail === "full" ? result : undefined,
      detail,
    });
    emitToolCallTraces(session, result, { stepId, correlationId });
    if (writeArtifact) {
      try {
        persistArtifact(session, writeArtifact, { text, result }, (r) => r.text);
      } catch (err) {
        // Surface validation/write errors as trace events so streaming consumers
        // are never left wondering why an artifact silently disappeared.
        const e = errorToTrace(err);
        session.logModelIO({
          stepId,
          correlationId,
          direction: "stream_chunk",
          summary: `artifact_write_failed: ${e.message}`,
        });
      }
    }
    userOnFinish?.(event as never);
  };

  const onError = (event: unknown) => {
    const durationMs = Date.now() - startedAt;
    const err =
      event && typeof event === "object" && "error" in event
        ? (event as { error: unknown }).error
        : event;
    const e = errorToTrace(err);
    session.logModelIO({
      stepId,
      correlationId,
      direction: "response",
      provider: initial.provider,
      model: initial.model,
      durationMs,
      summary: `error: ${e.message}`,
    });
    userOnError?.(event as never);
  };

  return streamText({
    ...(aiOpts as StreamTextFirstArg),
    onChunk,
    onFinish,
    onError,
  } as StreamTextFirstArg);
}

function clipTail(s: string): string {
  if (s.length <= STREAM_CHUNK_TAIL_LIMIT) return s;
  return s.slice(s.length - STREAM_CHUNK_TAIL_LIMIT);
}
