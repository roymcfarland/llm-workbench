import { generateText } from "ai";
import { WorkbenchError, type WorkbenchSession } from "@llm-workbench/runtime";
import {
  costFromGatewayMetadata,
  errorToTrace,
  newCorrelationId,
  resolveProviderModel,
  summarizePromptInput,
  usageFromAi,
} from "./internal.js";
import type { WorkbenchTraceContext, WriteArtifactOptions } from "./types.js";

type GenerateTextFirstArg = Parameters<typeof generateText>[0];
type GenerateTextResult = Awaited<ReturnType<typeof generateText>>;

/**
 * Options for {@link tracedGenerateText}: every option supported by the
 * AI SDK `generateText`, plus tracing/artifact hooks.
 */
export type TracedGenerateTextOptions = GenerateTextFirstArg &
  WorkbenchTraceContext & {
    /**
     * Optionally validate (when `registry` is set) and persist the response
     * `text` as an artifact via `session.writeArtifact` once the call succeeds.
     */
    writeArtifact?: WriteArtifactOptions<GenerateTextResult>;
  };

/**
 * Drop-in wrapper around AI SDK `generateText` that emits LLM Workbench
 * trace events automatically:
 *
 * - `model_io` `direction: "request"` before the call (with prompt summary)
 * - `model_io` `direction: "response"` after the call (with usage, cost,
 *   provider/model, and `durationMs`)
 * - one `tool_call` per `result.toolCalls` (matched against `toolResults`)
 * - one `error` trace + rethrow if the underlying call rejects
 *
 * Request and response events share a generated `correlationId`. The original
 * AI SDK result is returned unchanged.
 *
 * @param session The active `WorkbenchSession` recording trace events.
 * @param opts AI SDK `generateText` options plus optional tracing/artifact
 *   metadata. `stepId`, `correlationId`, `detail`, and `writeArtifact` are
 *   stripped from the options forwarded to the AI SDK.
 */
export async function tracedGenerateText(
  session: WorkbenchSession,
  opts: TracedGenerateTextOptions,
): Promise<GenerateTextResult> {
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
  let result: GenerateTextResult;
  try {
    result = await generateText(aiOpts as GenerateTextFirstArg);
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
  const usage = usageFromAi((result as { usage?: unknown }).usage);
  const cost = costFromGatewayMetadata(
    (result as { providerMetadata?: unknown }).providerMetadata,
  );

  session.logModelIO({
    stepId,
    correlationId,
    direction: "response",
    provider: resolved.provider,
    model: resolved.model,
    usage,
    cost,
    durationMs,
    summary: summarizeResultText(result),
    payload: detail === "full" ? result : undefined,
    detail,
  });

  emitToolCallTraces(session, result, { stepId, correlationId });

  if (writeArtifact) {
    persistArtifact(session, writeArtifact, result, (r) =>
      typeof (r as { text?: unknown }).text === "string"
        ? (r as { text: string }).text
        : undefined,
    );
  }

  return result;
}

function summarizeResultText(result: GenerateTextResult): string | undefined {
  const text = (result as { text?: unknown }).text;
  if (typeof text === "string" && text.length > 0) {
    return text.length > 200 ? text.slice(0, 200) : text;
  }
  return undefined;
}

/**
 * Emit `tool_call` trace events for the toolCalls present in a `generateText`
 * (or step) result. Best-effort: we tolerate either AI SDK v5 (`input`/`output`)
 * or older (`args`/`result`) shapes.
 *
 * @internal
 */
export function emitToolCallTraces(
  session: WorkbenchSession,
  result: unknown,
  ctx: { stepId?: string; correlationId: string },
): void {
  if (!result || typeof result !== "object") return;
  const r = result as { toolCalls?: unknown; toolResults?: unknown };
  const toolCalls = Array.isArray(r.toolCalls) ? r.toolCalls : [];
  const toolResults = Array.isArray(r.toolResults) ? r.toolResults : [];
  for (const raw of toolCalls) {
    if (!raw || typeof raw !== "object") continue;
    const call = raw as {
      toolCallId?: unknown;
      toolName?: unknown;
      input?: unknown;
      args?: unknown;
    };
    const name = typeof call.toolName === "string" ? call.toolName : undefined;
    if (!name) continue;
    const matchingResult = toolResults.find((tr) => {
      if (!tr || typeof tr !== "object") return false;
      const t = tr as { toolCallId?: unknown };
      return t.toolCallId === call.toolCallId;
    }) as { output?: unknown; result?: unknown } | undefined;
    session.logToolCall({
      stepId: ctx.stepId,
      correlationId: ctx.correlationId,
      name,
      args: call.input ?? call.args,
      result: matchingResult?.output ?? matchingResult?.result,
    });
  }
}

/**
 * Validate (when a registry is provided) and write an artifact derived from a
 * generation result. Throws if validation fails so the caller can decide how
 * to handle invalid model output.
 *
 * @internal
 */
export function persistArtifact<TResult>(
  session: WorkbenchSession,
  options: WriteArtifactOptions<TResult>,
  result: TResult,
  defaultProjector: (r: TResult) => unknown,
): void {
  const data = options.toData ? options.toData(result) : defaultProjector(result);
  if (data === undefined) {
    throw new WorkbenchError(
      "INVALID_INPUT",
      "writeArtifact projector returned undefined; supply `toData` or ensure the result carries data",
    );
  }
  if (options.registry) {
    const validation = options.registry.validateArtifact(options.typeId, data);
    if (!validation.ok) {
      const messages = validation.errors
        .map((e) => e.message ?? "")
        .filter(Boolean)
        .join("; ");
      throw new WorkbenchError(
        "INVALID_INPUT",
        `Artifact "${options.artifactKey}" failed validation against typeId "${options.typeId}": ${messages || "unknown error"}`,
      );
    }
  }
  session.writeArtifact({
    artifactKey: options.artifactKey,
    typeId: options.typeId,
    data,
    idempotencyKey: options.idempotencyKey,
  });
}
