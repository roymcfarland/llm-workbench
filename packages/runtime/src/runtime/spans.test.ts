import { describe, expect, it } from "vitest";
import { traceEventsToOtelSpans } from "../telemetry/otel.js";
import { WorkbenchRuntime } from "./workbench.js";

const wf = {
  id: "wf",
  version: 1,
  steps: [{ id: "a", gatePolicy: "AUTO" as const }],
  edges: [],
};

describe("WorkbenchSession spans", () => {
  it("emits matched span_started/span_ended with status: ok and a duration", async () => {
    const rt = new WorkbenchRuntime();
    const { runId } = rt.startRun({ workflow: wf });
    const s = rt.session(runId);

    const result = await s.span("ai.generateText", async () => {
      return 42;
    });
    expect(result).toBe(42);

    const events = rt.getState(runId)?.trace ?? [];
    const started = events.find((e) => e.type === "span_started");
    const ended = events.find((e) => e.type === "span_ended");
    expect(started && started.type === "span_started" && started.name).toBe("ai.generateText");
    expect(ended && ended.type === "span_ended" && ended.status).toBe("ok");
    if (ended && ended.type === "span_ended") {
      expect(typeof ended.durationMs).toBe("number");
      expect(ended.spanId).toBe(started && started.type === "span_started" ? started.spanId : "");
    }
  });

  it("captures errors and rethrows", async () => {
    const rt = new WorkbenchRuntime();
    const { runId } = rt.startRun({ workflow: wf });
    const s = rt.session(runId);

    await expect(
      s.span("flaky", async () => {
        throw new Error("nope");
      }),
    ).rejects.toThrow("nope");

    const events = rt.getState(runId)?.trace ?? [];
    const ended = events.find((e) => e.type === "span_ended");
    expect(ended && ended.type === "span_ended" && ended.status).toBe("error");
    if (ended && ended.type === "span_ended") {
      expect(ended.error?.message).toBe("nope");
    }
  });

  it("supports nesting via parentSpanId", async () => {
    const rt = new WorkbenchRuntime();
    const { runId } = rt.startRun({ workflow: wf });
    const s = rt.session(runId);

    await s.span("outer", async (outer) => {
      await s.span("inner", async () => {}, { parentSpanId: outer.spanId });
    });

    const events = rt.getState(runId)?.trace ?? [];
    const starts = events.filter((e) => e.type === "span_started");
    expect(starts).toHaveLength(2);
    const [outer, inner] = starts;
    if (outer && outer.type === "span_started" && inner && inner.type === "span_started") {
      expect(inner.parentSpanId).toBe(outer.spanId);
    } else {
      throw new Error("expected two span_started events");
    }
  });
});

describe("traceEventsToOtelSpans", () => {
  it("maps step + span + model_io events to GenAI-flavored OTel spans", async () => {
    const rt = new WorkbenchRuntime();
    const { runId } = rt.startRun({ workflow: wf });
    const s = rt.session(runId);
    s.beginStep("a");
    await s.span("ai.generateText", async () => {
      s.logModelIO({
        direction: "response",
        provider: "anthropic",
        model: "claude-haiku-4-5",
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        cost: { amount: 0.003, currency: "USD" },
        durationMs: 220,
        summary: "ok",
      });
    });
    s.completeStep("a");

    const events = rt.getState(runId)?.trace ?? [];
    const otel = traceEventsToOtelSpans(events, { runId });

    const stepSpan = otel.find((sp) => sp.name === "step a");
    expect(stepSpan?.status).toBe("ok");
    expect(stepSpan?.attributes["lwb.step.id"]).toBe("a");

    const aiSpan = otel.find((sp) => sp.name === "ai.generateText");
    expect(aiSpan?.parentSpanId).toBe(stepSpan?.spanId);

    const modelSpan = otel.find((sp) => sp.name.startsWith("gen_ai.chat"));
    expect(modelSpan?.attributes["gen_ai.system"]).toBe("anthropic");
    expect(modelSpan?.attributes["gen_ai.request.model"]).toBe("claude-haiku-4-5");
    expect(modelSpan?.attributes["gen_ai.usage.total_tokens"]).toBe(150);
    expect(modelSpan?.attributes["gen_ai.usage.cost.amount"]).toBe(0.003);
    expect(modelSpan?.parentSpanId).toBe(aiSpan?.spanId);
  });
});
