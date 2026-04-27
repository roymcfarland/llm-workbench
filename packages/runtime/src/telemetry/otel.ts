import type { TraceEvent } from "../protocol/trace.js";

/**
 * Minimal OTLP-shaped span record with OpenTelemetry GenAI semantic conventions
 * applied. We deliberately don't depend on `@opentelemetry/api` so this module
 * stays usable in any host (server, edge, browser) — emit these objects from
 * an exporter of your choice.
 *
 * Fields follow https://opentelemetry.io/docs/specs/semconv/gen-ai/ and the
 * OTLP/JSON `Span` shape (subset).
 */
export type OtelGenAiSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  /** ISO-8601 timestamp of span start. */
  startTimeIso: string;
  /** ISO-8601 timestamp of span end. May equal start if no `span_ended` was seen. */
  endTimeIso: string;
  /** Milliseconds. */
  durationMs?: number;
  status: "ok" | "error" | "unset";
  kind: "internal" | "client" | "server" | "producer" | "consumer";
  /** Flattened attributes including OTel GenAI semantic-conv keys. */
  attributes: Record<string, string | number | boolean>;
  events: Array<{
    name: string;
    timeIso: string;
    attributes?: Record<string, string | number | boolean>;
  }>;
};

const TRACE_ID_PREFIX = "lwb-";

function asAttrValue(v: unknown): string | number | boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return undefined;
  }
}

function flattenAttributes(input: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!input) return out;
  for (const [k, v] of Object.entries(input)) {
    const av = asAttrValue(v);
    if (av !== undefined) out[k] = av;
  }
  return out;
}

/**
 * Convert a run's trace events into an array of GenAI-flavored OTel spans.
 *
 * - `span_started` opens a span. `span_ended` closes it. Out-of-order or
 *   unmatched events are tolerated: an unmatched `span_started` becomes a
 *   span with `status: "unset"` and `endTimeIso` equal to the latest event
 *   timestamp seen in its scope.
 * - `model_io` events with `direction === "response"` produce a `gen_ai.*`
 *   child span anchored under the *current open span* (or under no parent if
 *   none is open). Usage and cost map to OTel GenAI semantic conventions.
 * - `tool_call` events become child spans with `gen_ai.tool.name`.
 * - All other events are recorded as **span events** on the closest open span,
 *   preserving order.
 */
export function traceEventsToOtelSpans(
  events: ReadonlyArray<TraceEvent>,
  options?: { traceId?: string; runId?: string },
): OtelGenAiSpan[] {
  const traceId = options?.traceId ?? `${TRACE_ID_PREFIX}${options?.runId ?? "run"}`;
  const open = new Map<string, OtelGenAiSpan>();
  const stack: string[] = [];
  const out: OtelGenAiSpan[] = [];
  let lastTs = "";

  const top = (): OtelGenAiSpan | undefined => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const id = stack[i];
      if (id !== undefined) {
        const s = open.get(id);
        if (s) return s;
      }
    }
    return undefined;
  };

  const recordEvent = (name: string, ts: string, attrs?: Record<string, unknown>) => {
    const parent = top();
    const ev = { name, timeIso: ts, attributes: flattenAttributes(attrs) };
    if (parent) parent.events.push(ev);
  };

  const finish = (id: string) => {
    const s = open.get(id);
    if (!s) return;
    out.push(s);
    open.delete(id);
    const idx = stack.lastIndexOf(id);
    if (idx >= 0) stack.splice(idx, 1);
  };

  for (const e of events) {
    lastTs = e.ts;
    switch (e.type) {
      case "span_started": {
        const span: OtelGenAiSpan = {
          traceId,
          spanId: e.spanId,
          parentSpanId: e.parentSpanId ?? top()?.spanId,
          name: e.name,
          startTimeIso: e.ts,
          endTimeIso: e.ts,
          status: "unset",
          kind: e.kind ?? "internal",
          attributes: flattenAttributes(e.attributes),
          events: [],
        };
        open.set(e.spanId, span);
        stack.push(e.spanId);
        break;
      }
      case "span_ended": {
        const s = open.get(e.spanId);
        if (s) {
          s.endTimeIso = e.ts;
          s.durationMs = e.durationMs;
          s.status = e.status ?? "ok";
          if (e.attributes) Object.assign(s.attributes, flattenAttributes(e.attributes));
          if (e.error) {
            s.attributes["exception.message"] = e.error.message;
            if (e.error.code) s.attributes["exception.code"] = e.error.code;
          }
          finish(e.spanId);
        }
        break;
      }
      case "model_io": {
        if (e.direction !== "response") {
          recordEvent("gen_ai.client.message", e.ts, {
            "gen_ai.message.direction": e.direction,
            "gen_ai.system": e.provider,
            "gen_ai.request.model": e.model,
          });
          break;
        }
        const child: OtelGenAiSpan = {
          traceId,
          spanId: `model-${e.id}`,
          parentSpanId: top()?.spanId,
          name: e.model ? `gen_ai.chat ${e.model}` : "gen_ai.chat",
          startTimeIso: e.ts,
          endTimeIso: e.ts,
          durationMs: e.durationMs,
          status: "ok",
          kind: "client",
          attributes: {
            ...(e.provider ? { "gen_ai.system": e.provider } : {}),
            ...(e.model ? { "gen_ai.response.model": e.model, "gen_ai.request.model": e.model } : {}),
            ...(e.usage?.inputTokens !== undefined
              ? { "gen_ai.usage.input_tokens": e.usage.inputTokens }
              : {}),
            ...(e.usage?.outputTokens !== undefined
              ? { "gen_ai.usage.output_tokens": e.usage.outputTokens }
              : {}),
            ...(e.usage?.totalTokens !== undefined
              ? { "gen_ai.usage.total_tokens": e.usage.totalTokens }
              : {}),
            ...(e.cost ? { "gen_ai.usage.cost.amount": e.cost.amount, "gen_ai.usage.cost.currency": e.cost.currency } : {}),
            ...(e.summary ? { "gen_ai.response.summary": e.summary } : {}),
          },
          events: [],
        };
        out.push(child);
        break;
      }
      case "tool_call": {
        const child: OtelGenAiSpan = {
          traceId,
          spanId: `tool-${e.id}`,
          parentSpanId: top()?.spanId,
          name: `gen_ai.tool ${e.name}`,
          startTimeIso: e.ts,
          endTimeIso: e.ts,
          status: "ok",
          kind: "client",
          attributes: {
            "gen_ai.tool.name": e.name,
          },
          events: [],
        };
        out.push(child);
        break;
      }
      case "step_started": {
        const id = `step-${e.stepId}`;
        const span: OtelGenAiSpan = {
          traceId,
          spanId: id,
          parentSpanId: top()?.spanId,
          name: `step ${e.stepId}`,
          startTimeIso: e.ts,
          endTimeIso: e.ts,
          status: "unset",
          kind: "internal",
          attributes: { "lwb.step.id": e.stepId },
          events: [],
        };
        open.set(id, span);
        stack.push(id);
        break;
      }
      case "step_completed": {
        const id = `step-${e.stepId}`;
        const s = open.get(id);
        if (s) {
          s.endTimeIso = e.ts;
          s.status = e.ok ? "ok" : "error";
          if (e.error) {
            s.attributes["exception.message"] = e.error.message;
            if (e.error.code) s.attributes["exception.code"] = e.error.code;
          }
          finish(id);
        }
        break;
      }
      case "error": {
        recordEvent("exception", e.ts, {
          "exception.message": e.message,
          "exception.code": e.code,
          "exception.fatal": e.fatal,
        });
        break;
      }
      default: {
        recordEvent(e.type, e.ts, e as unknown as Record<string, unknown>);
        break;
      }
    }
  }

  for (const id of [...open.keys()]) {
    const s = open.get(id);
    if (s) {
      s.endTimeIso = lastTs || s.startTimeIso;
      finish(id);
    }
  }

  return out;
}
