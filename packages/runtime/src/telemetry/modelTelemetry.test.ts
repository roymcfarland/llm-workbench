import { describe, expect, it } from "vitest";
import { WorkbenchRuntime } from "../runtime/workbench.js";
import { ModelTelemetrySummarySchema, summarizeModelTelemetry } from "./modelTelemetry.js";

const workflow = {
  id: "wf",
  version: 1,
  steps: [
    { id: "parse", gatePolicy: "AUTO" as const },
    { id: "rank", gatePolicy: "AUTO" as const },
  ],
  edges: [{ id: "e1", from: "parse", to: "rank" }],
};

describe("summarizeModelTelemetry", () => {
  it("turns response trace events into a typed cost and usage ledger", () => {
    const rt = new WorkbenchRuntime();
    const { runId } = rt.startRun({
      workflow,
      subject: { userId: "user_1", tenantId: "team_1", planId: "pro" },
    });
    const session = rt.session(runId);

    session.logModelIO({
      stepId: "parse",
      direction: "request",
      provider: "openai",
      model: "gpt-example",
      usage: { inputTokens: 99, totalTokens: 99 },
      cost: { amount: 10, currency: "USD" },
    });
    session.logModelIO({
      stepId: "parse",
      direction: "response",
      provider: "openai",
      model: "gpt-example",
      usage: { inputTokens: 10, outputTokens: 4 },
      cost: { amount: 0.02, currency: "usd" },
      durationMs: 120,
      correlationId: "call_1",
    });
    session.logModelIO({
      stepId: "rank",
      direction: "response",
      provider: "anthropic",
      model: "claude-example",
      usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8, reasoningTokens: 2 },
      cost: { amount: 0.01, currency: "USD" },
      durationMs: 80,
    });

    const state = rt.getState(runId);
    expect(state).toBeTruthy();
    const summary = summarizeModelTelemetry(state!, { now: () => "2026-01-01T00:00:00.000Z" });

    expect(ModelTelemetrySummarySchema.safeParse(summary).success).toBe(true);
    expect(summary.runIds).toEqual([runId]);
    expect(summary.entries).toHaveLength(2);
    expect(summary.entries[0]).toMatchObject({
      stepId: "parse",
      provider: "openai",
      model: "gpt-example",
      cost: { amount: 0.02, currency: "USD" },
      subject: { userId: "user_1", tenantId: "team_1", planId: "pro" },
    });
    expect(summary.totals).toEqual({
      eventCount: 2,
      inputTokens: 15,
      outputTokens: 7,
      totalTokens: 22,
      cachedInputTokens: 0,
      reasoningTokens: 2,
      durationMs: 200,
      costByCurrency: { USD: 0.03 },
    });
    expect(summary.byProviderModel.map((bucket) => [bucket.key, bucket.totals.eventCount])).toEqual([
      ["provider:anthropic|model:claude-example", 1],
      ["provider:openai|model:gpt-example", 1],
    ]);
    expect(summary.byUser).toEqual([
      {
        key: "userId:user_1",
        label: "user_1",
        totals: summary.totals,
      },
    ]);
  });

  it("can include stream chunks when providers report usage there", () => {
    const rt = new WorkbenchRuntime();
    const { runId } = rt.startRun({ workflow });
    const session = rt.session(runId);
    session.logModelIO({
      direction: "stream_chunk",
      provider: "openai",
      model: "streaming-model",
      usage: { inputTokens: 3, outputTokens: 2 },
    });

    const state = rt.getState(runId);
    expect(summarizeModelTelemetry(state!).totals.eventCount).toBe(0);
    expect(summarizeModelTelemetry(state!, { directions: ["response", "stream_chunk"] }).totals).toMatchObject({
      eventCount: 1,
      totalTokens: 5,
    });
  });
});
