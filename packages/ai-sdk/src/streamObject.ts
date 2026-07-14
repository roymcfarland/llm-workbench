import { streamObject } from "ai";
import type { WorkbenchSession } from "@llm-workbench/runtime";
import {
  costFromGatewayMetadata,
  errorToTrace,
  newCorrelationId,
  resolveProviderModel,
  summarizePromptInput,
  usageFromAi,
} from "./internal.js";
import { persistArtifact } from "./generateText.js";
import type { WorkbenchTraceContext, WriteArtifactOptions } from "./types.js";

type StreamObjectFirstArg = Parameters<typeof streamObject>[0];
type StreamObjectResult = ReturnType<typeof streamObject>;

/**
 * Options for {@link tracedStreamObject}: every option supported by the AI SDK
 * `streamObject`, plus tracing/artifact hooks. Caller-supplied `onFinish` and
 * `onError` callbacks are still invoked.
 */
export type TracedStreamObjectOptions = StreamObjectFirstArg &
  WorkbenchTraceContext & {
    /**
     * Validate (when `registry` is set) and persist the final `object` as an
     * artifact via `session.writeArtifact` once the stream finishes.
     */
    writeArtifact?: WriteArtifactOptions<{ object: unknown; result: unknown }>;
  };

/**
 * Drop-in wrapper around AI SDK `streamObject` that emits LLM Workbench traces
 * for the request and the final response (with usage, cost, and `durationMs`),
 * plus an optional artifact write once the stream resolves.
 *
 * Returns the original `streamObject` result so callers iterate
 * `partialObjectStream`, await `object`/`usage`, etc., as if they had called
 * `streamObject` directly.
 *
 * @param session The active `WorkbenchSession` recording trace events.
 * @param opts AI SDK `streamObject` options plus optional tracing/artifact
 *   metadata.
 * @returns The original AI SDK `streamObject` result, unchanged — iterate
 *   `partialObjectStream` or await `object`/`usage` exactly as you would from
 *   a direct `streamObject` call.
 */
export function tracedStreamObject(
  session: WorkbenchSession,
  opts: TracedStreamObjectOptions,
): StreamObjectResult {
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

  const userOnFinish = (aiOpts as { onFinish?: (...args: unknown[]) => void })
    .onFinish;
  const userOnError = (aiOpts as { onError?: (...args: unknown[]) => void })
    .onError;

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
    session.logModelIO({
      stepId,
      correlationId,
      direction: "response",
      provider: resolved.provider,
      model: resolved.model,
      usage: usageFromAi(result.usage),
      cost: costFromGatewayMetadata(result.providerMetadata),
      durationMs,
      payload: detail === "full" ? result : undefined,
      detail,
    });
    if (writeArtifact) {
      try {
        persistArtifact(
          session,
          writeArtifact,
          { object: result.object, result },
          (r) => r.object,
        );
      } catch (err) {
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

  return streamObject({
    ...(aiOpts as StreamObjectFirstArg),
    onFinish,
    onError,
  } as StreamObjectFirstArg);
}
