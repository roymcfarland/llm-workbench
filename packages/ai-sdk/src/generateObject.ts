import { generateObject } from "ai";
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

type GenerateObjectFirstArg = Parameters<typeof generateObject>[0];
type GenerateObjectResult = Awaited<ReturnType<typeof generateObject>>;

/**
 * Options for {@link tracedGenerateObject}: every option supported by the
 * AI SDK `generateObject` (including `schema`, `mode`, etc.), plus tracing
 * and artifact hooks.
 */
export type TracedGenerateObjectOptions = GenerateObjectFirstArg &
  WorkbenchTraceContext & {
    /**
     * Validate (when `registry` is set) and persist `result.object` as an
     * artifact via `session.writeArtifact` once the call succeeds.
     */
    writeArtifact?: WriteArtifactOptions<GenerateObjectResult>;
  };

/**
 * Drop-in wrapper around AI SDK `generateObject` that emits LLM Workbench
 * `model_io` request/response trace events and optionally validates and
 * persists the structured `result.object` as a workbench artifact.
 *
 * @param session The active `WorkbenchSession` recording trace events.
 * @param opts AI SDK `generateObject` options plus optional tracing/artifact
 *   metadata.
 * @returns The original AI SDK `generateObject` result, unchanged.
 * @throws Rethrows any error from the underlying `generateObject` call, after
 *   recording it as an `error`-summary `model_io` response event.
 */
export async function tracedGenerateObject(
  session: WorkbenchSession,
  opts: TracedGenerateObjectOptions,
): Promise<GenerateObjectResult> {
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

  const startedAt = Date.now();
  let result: GenerateObjectResult;
  try {
    result = (await generateObject(
      aiOpts as GenerateObjectFirstArg,
    )) as GenerateObjectResult;
  } catch (err) {
    const durationMs = Date.now() - startedAt;
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
    throw err;
  }
  const durationMs = Date.now() - startedAt;
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
    usage: usageFromAi((result as { usage?: unknown }).usage),
    cost: costFromGatewayMetadata(
      (result as { providerMetadata?: unknown }).providerMetadata,
    ),
    durationMs,
    payload: detail === "full" ? result : undefined,
    detail,
  });

  if (writeArtifact) {
    persistArtifact(session, writeArtifact, result, (r) =>
      (r as { object?: unknown }).object,
    );
  }

  return result;
}
