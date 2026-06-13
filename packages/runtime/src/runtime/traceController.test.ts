import { describe, expect, it, vi } from "vitest";
import { WorkbenchError } from "../errors.js";
import type { TraceEvent } from "../protocol/trace.js";
import { TraceEventSchema } from "../protocol/trace.js";
import type { WorkflowSpec } from "../protocol/workflow.js";
import { WORKBENCH_PROTOCOL_VERSION } from "../protocol/version.js";
import { canStartStep } from "./readiness.js";
import { RunLifecycleController } from "./runLifecycleController.js";
import type { SessionContext } from "./sessionContext.js";
import { TraceController } from "./traceController.js";
import type { RunStoreState } from "./types.js";
import { WorkbenchRuntime } from "./workbench.js";

const autoWorkflow = {
  id: "wf",
  version: 1,
  steps: [{ id: "a", gatePolicy: "AUTO" as const }],
  edges: [],
};

function expectWorkbenchError(fn: () => unknown, code: WorkbenchError["code"]) {
  try {
    fn();
  } catch (error) {
    expect(WorkbenchError.is(error)).toBe(true);
    if (!WorkbenchError.is(error)) return;
    expect(error.code).toBe(code);
    return;
  }
  throw new Error(`Expected WorkbenchError ${code}`);
}

function eventsOfType<T extends TraceEvent["type"]>(
  events: TraceEvent[],
  type: T,
): Array<Extract<TraceEvent, { type: T }>> {
  return events.filter(
    (event): event is Extract<TraceEvent, { type: T }> => event.type === type,
  );
}

function snapshotNonTraceState(state: RunStoreState) {
  return structuredClone({
    run: state.run,
    artifactsByKey: [...state.artifactsByKey.entries()],
    ruleSetsById: [...state.ruleSetsById.entries()],
    stepStatus: [...state.stepStatus.entries()],
    gateState: [...state.gateState.entries()],
    idempotency: [...state.idempotency.entries()],
  });
}

function makeHarness(workflow: WorkflowSpec = autoWorkflow) {
  const runtime = new WorkbenchRuntime();
  const { runId } = runtime.startRun({ workflow });
  const state = runtime.getState(runId);
  if (!state) throw new Error(`Missing state for run ${runId}`);

  let eventNumber = 0;
  const appendTrace = vi.fn((event: TraceEvent) => {
    const validated = TraceEventSchema.parse(event);
    state.revision += 1;
    state.trace.push(validated);
  });
  const ctx: SessionContext = {
    protocolVersion: WORKBENCH_PROTOCOL_VERSION,
    state,
    appendTrace,
    newEventId: () => `evt_${++eventNumber}`,
    nowIso: () => "2026-06-12T00:00:00.000Z",
    canStartStep: (stepId) =>
      canStartStep({
        spec: state.run.workflowSnapshot,
        stepId,
        stepStatus: state.stepStatus,
        gateState: state.gateState,
      }),
  };
  const lifecycle = new RunLifecycleController(ctx);

  return {
    state,
    trace: new TraceController(ctx, lifecycle),
  };
}

describe("TraceController", () => {
  it("logModelIO preserves full payloads, strips summary payloads, and mutates no state", () => {
    const { state, trace } = makeHarness();
    const before = snapshotNonTraceState(state);

    trace.logModelIO({
      direction: "request",
      provider: "openai",
      model: "gpt-5-mini",
      detail: "full",
      payload: { prompt: "hello" },
      usage: { inputTokens: 3 },
      cost: { amount: 0.001, currency: "USD" },
    });
    trace.logModelIO({
      direction: "response",
      summary: "completed",
      detail: "summary",
      payload: { completion: "redacted" },
    });

    expect(snapshotNonTraceState(state)).toEqual(before);
    const events = eventsOfType(state.trace, "model_io");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      id: "evt_1",
      direction: "request",
      provider: "openai",
      model: "gpt-5-mini",
      payload: { prompt: "hello" },
    });
    expect(events[1]).toMatchObject({
      id: "evt_2",
      direction: "response",
      summary: "completed",
    });
    expect(events[1]?.payload).toBeUndefined();
  });

  it("logModelIO defaults to summary detail and strips payload without mutating state", () => {
    const { state, trace } = makeHarness();
    const before = snapshotNonTraceState(state);

    trace.logModelIO({
      direction: "stream_chunk",
      summary: "chunk received",
      payload: { token: "hidden" },
    });

    expect(snapshotNonTraceState(state)).toEqual(before);
    const events = eventsOfType(state.trace, "model_io");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "evt_1",
      direction: "stream_chunk",
      summary: "chunk received",
    });
    expect(events[0]?.payload).toBeUndefined();
  });

  it("beginSpan emits span_started and end appends span_ended only once", () => {
    const { state, trace } = makeHarness();
    const before = snapshotNonTraceState(state);

    const handle = trace.beginSpan({ name: "work", attributes: { unit: "test" } });
    expect(eventsOfType(state.trace, "span_started")).toHaveLength(1);

    expect(() => {
      handle.end({ status: "ok" });
      handle.end({ status: "error", error: { message: "ignored" } });
    }).not.toThrow();

    expect(snapshotNonTraceState(state)).toEqual(before);
    const ended = eventsOfType(state.trace, "span_ended");
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({
      id: "evt_2",
      spanId: handle.spanId,
      status: "ok",
      durationMs: expect.any(Number),
    });
  });

  it("end records error status and payload on span_ended", () => {
    const { state, trace } = makeHarness();
    const before = snapshotNonTraceState(state);

    const handle = trace.beginSpan({ name: "tool.execute" });
    handle.end({ status: "error", error: { message: "tool failed", code: "TOOL_FAILED" } });

    expect(snapshotNonTraceState(state)).toEqual(before);
    expect(eventsOfType(state.trace, "span_ended")).toContainEqual(
      expect.objectContaining({
        spanId: handle.spanId,
        status: "error",
        error: { message: "tool failed", code: "TOOL_FAILED" },
      }),
    );
  });

  it("span resolves the callback value and emits a single ok span", async () => {
    const { state, trace } = makeHarness();
    const before = snapshotNonTraceState(state);

    const result = await trace.span("compute", () => 42);

    expect(result).toBe(42);
    expect(snapshotNonTraceState(state)).toEqual(before);
    expect(state.trace.map((event) => event.type)).toEqual(["span_started", "span_ended"]);
    const ended = eventsOfType(state.trace, "span_ended");
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({ status: "ok" });
  });

  it("span records WorkbenchError details and rethrows the original error", async () => {
    const { state, trace } = makeHarness();
    const before = snapshotNonTraceState(state);
    const original = new WorkbenchError("INVALID_INPUT", "bad input");

    await expect(
      trace.span("compute", () => {
        throw original;
      }),
    ).rejects.toBe(original);

    expect(snapshotNonTraceState(state)).toEqual(before);
    expect(state.trace.map((event) => event.type)).toEqual(["span_started", "span_ended"]);
    expect(eventsOfType(state.trace, "span_ended")).toContainEqual(
      expect.objectContaining({
        status: "error",
        error: { message: "bad input", code: "INVALID_INPUT" },
      }),
    );
  });

  it("logToolCall rejects empty names and appends valid tool_call events without state mutation", () => {
    const { state, trace } = makeHarness();

    expectWorkbenchError(
      () => trace.logToolCall({ name: "   ", args: { q: "search" } }),
      "INVALID_INPUT",
    );
    expect(state.trace).toEqual([]);

    const before = snapshotNonTraceState(state);
    trace.logToolCall({
      name: "search",
      args: { q: "controller coverage" },
      result: { count: 3 },
    });

    expect(snapshotNonTraceState(state)).toEqual(before);
    expect(eventsOfType(state.trace, "tool_call")).toContainEqual(
      expect.objectContaining({
        id: "evt_1",
        name: "search",
        args: { q: "controller coverage" },
        result: { count: 3 },
      }),
    );
  });

  it("rejects TraceController writes once the run is terminal", () => {
    const { state, trace } = makeHarness();
    state.run.status = "completed";

    expectWorkbenchError(
      () => trace.logModelIO({ direction: "request", summary: "too late" }),
      "INVALID_STATE_TRANSITION",
    );
    expect(state.trace).toEqual([]);
  });
});
