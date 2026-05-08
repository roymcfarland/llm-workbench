import { WorkbenchError } from "../errors.js";
import type { ModelCost, ModelUsage } from "../protocol/trace.js";
import type { RunLifecycleController } from "./runLifecycleController.js";
import type { SpanHandle } from "./session.js";
import type { SessionContext } from "./sessionContext.js";

export class TraceController {
  constructor(
    private readonly ctx: SessionContext,
    private readonly lifecycle: RunLifecycleController,
  ) {}

  private get runId() {
    return this.ctx.state.run.id;
  }

  logModelIO(input: {
    stepId?: string;
    direction: "request" | "response" | "stream_chunk";
    provider?: string;
    model?: string;
    usage?: ModelUsage;
    cost?: ModelCost;
    durationMs?: number;
    summary?: string;
    payload?: unknown;
    correlationId?: string;
    detail?: "full" | "summary";
  }) {
    this.lifecycle.assertRunActive("log model I/O");
    const detail = input.detail ?? "summary";
    const payload = detail === "full" ? input.payload : undefined;
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "model_io",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId: input.stepId,
      correlationId: input.correlationId,
      direction: input.direction,
      provider: input.provider,
      model: input.model,
      usage: input.usage,
      cost: input.cost,
      durationMs: input.durationMs,
      summary: input.summary,
      payload,
    });
  }

  beginSpan(input: {
    name: string;
    parentSpanId?: string;
    kind?: "internal" | "client" | "server" | "producer" | "consumer";
    attributes?: Record<string, unknown>;
    stepId?: string;
    correlationId?: string;
  }): SpanHandle {
    this.lifecycle.assertRunActive("begin span");
    const spanId = `span_${(globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)}`;
    const startedAt = performance.now();
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "span_started",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId: input.stepId,
      correlationId: input.correlationId,
      spanId,
      parentSpanId: input.parentSpanId,
      name: input.name,
      kind: input.kind,
      attributes: input.attributes,
    });
    let ended = false;
    const handle: SpanHandle = {
      spanId,
      end: (opts) => {
        if (ended) return;
        ended = true;
        const durationMs = Math.max(0, performance.now() - startedAt);
        this.ctx.appendTrace({
          id: this.ctx.newEventId(),
          type: "span_ended",
          runId: this.runId,
          ts: this.ctx.nowIso(),
          stepId: input.stepId,
          correlationId: input.correlationId,
          spanId,
          status: opts?.status,
          durationMs,
          attributes: opts?.attributes,
          error: opts?.error,
        });
      },
    };
    return handle;
  }

  async span<T>(
    name: string,
    fn: (handle: SpanHandle) => Promise<T> | T,
    opts?: {
      parentSpanId?: string;
      kind?: "internal" | "client" | "server" | "producer" | "consumer";
      attributes?: Record<string, unknown>;
      stepId?: string;
      correlationId?: string;
    },
  ): Promise<T> {
    const handle = this.beginSpan({ name, ...opts });
    try {
      const result = await fn(handle);
      handle.end({ status: "ok" });
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const code = e instanceof WorkbenchError ? e.code : undefined;
      handle.end({ status: "error", error: { message, code } });
      throw e;
    }
  }

  logToolCall(input: {
    stepId?: string;
    name: string;
    args?: unknown;
    result?: unknown;
    correlationId?: string;
  }) {
    this.lifecycle.assertRunActive("log tool call");
    if (!input.name.trim()) {
      throw new WorkbenchError("INVALID_INPUT", "logToolCall requires a non-empty tool name");
    }
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "tool_call",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId: input.stepId,
      correlationId: input.correlationId,
      name: input.name,
      args: input.args,
      result: input.result,
    });
  }
}
