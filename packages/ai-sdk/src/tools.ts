import type { WorkbenchSession } from "@llm-workbench/runtime";
import { errorToTrace, newCorrelationId } from "./internal.js";

/**
 * Configuration for {@link traceTools}.
 */
export interface TraceToolsOptions {
  /** Workflow step id forwarded with every emitted `tool_call` trace. */
  stepId?: string;
  /**
   * Shared correlation id. When omitted, each tool execution gets its own
   * generated correlation id. Pass an existing id to link tool calls to a
   * surrounding `model_io` exchange.
   */
  correlationId?: string;
}

/**
 * Wrap an AI SDK tool map so that each tool's `execute` emits a `tool_call`
 * trace event on success and an additional `error` trace + rethrow on failure.
 *
 * Tools without an `execute` function are returned unchanged (the AI SDK uses
 * those for client-side tool calls). The wrapped map preserves every other
 * tool property — descriptions, schemas, etc. — so the AI SDK still receives
 * the original tool definition.
 *
 * @example
 * ```ts
 * const tools = traceTools(session, {
 *   getWeather: tool({
 *     description: "Look up weather",
 *     inputSchema: z.object({ city: z.string() }),
 *     execute: async ({ city }) => fetchWeather(city),
 *   }),
 * }, { stepId: "research" });
 *
 * await tracedGenerateText(session, { model, prompt, tools });
 * ```
 */
export function traceTools<TTools extends Record<string, unknown>>(
  session: WorkbenchSession,
  tools: TTools,
  options?: TraceToolsOptions,
): TTools {
  const out: Record<string, unknown> = {};
  for (const [name, raw] of Object.entries(tools)) {
    if (!raw || typeof raw !== "object") {
      out[name] = raw;
      continue;
    }
    const tool = raw as { execute?: unknown };
    if (typeof tool.execute !== "function") {
      out[name] = raw;
      continue;
    }
    const original = tool.execute as (
      input: unknown,
      ctx?: unknown,
    ) => unknown;
    const wrapped = async (input: unknown, ctx?: unknown) => {
      const correlationId = options?.correlationId ?? newCorrelationId();
      try {
        const result = await Promise.resolve(original(input, ctx));
        session.logToolCall({
          stepId: options?.stepId,
          correlationId,
          name,
          args: input,
          result,
        });
        return result;
      } catch (err) {
        const e = errorToTrace(err);
        session.logToolCall({
          stepId: options?.stepId,
          correlationId,
          name,
          args: input,
          result: { error: e.message, code: e.code },
        });
        throw err;
      }
    };
    out[name] = { ...(raw as Record<string, unknown>), execute: wrapped };
  }
  return out as TTools;
}
