import { describe, expect, it, vi } from "vitest";
import { WorkbenchError } from "../errors.js";
import type { TraceEvent } from "../protocol/trace.js";
import { TraceEventSchema } from "../protocol/trace.js";
import type { WorkflowSpec } from "../protocol/workflow.js";
import { WORKBENCH_PROTOCOL_VERSION } from "../protocol/version.js";
import { GateController } from "./gateController.js";
import { canStartStep } from "./readiness.js";
import { RunLifecycleController } from "./runLifecycleController.js";
import type { SessionContext } from "./sessionContext.js";
import { StepController } from "./stepController.js";
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
  const gates = new GateController(ctx, lifecycle);

  return {
    state,
    steps: new StepController(ctx, lifecycle, gates),
  };
}

describe("StepController", () => {
  it("beginStep starts a ready AUTO step and appends step_started", () => {
    const { state, steps } = makeHarness();

    expect(steps.beginStep("a")).toEqual({ ok: true });

    expect(state.stepStatus.get("a")).toBe("running");
    expect(state.trace).toContainEqual({
      id: "evt_1",
      type: "step_started",
      runId: state.run.id,
      ts: "2026-06-12T00:00:00.000Z",
      stepId: "a",
    });
  });

  it("beginStep returns a BlockReason for an unresolved PAUSE_BEFORE gate without mutating status or trace", () => {
    const { state, steps } = makeHarness({
      id: "wf",
      version: 1,
      steps: [{ id: "a", gatePolicy: "PAUSE_BEFORE" }],
      edges: [],
    });

    expect(steps.beginStep("a")).toEqual({
      ok: false,
      reason: { type: "gate", stepId: "a", gate: "PAUSE_BEFORE" },
    });
    expect(state.stepStatus.get("a")).toBe("pending");
    expect(state.trace).toEqual([]);
  });

  it("assertCanStartStep rejects a non-pending step", () => {
    const { state, steps } = makeHarness();
    state.stepStatus.set("a", "running");

    expectWorkbenchError(
      () => steps.assertCanStartStep("a"),
      "INVALID_STATE_TRANSITION",
    );
  });

  it("completeStep rejects unknown and non-running steps with controller-specific codes", () => {
    const { steps } = makeHarness();

    expectWorkbenchError(() => steps.completeStep("missing"), "UNKNOWN_STEP");
    expectWorkbenchError(() => steps.completeStep("a"), "INVALID_STATE_TRANSITION");
  });

  it("completeStep on PAUSE_AFTER completes the step and requests the after gate", () => {
    const { state, steps } = makeHarness({
      id: "wf",
      version: 1,
      steps: [{ id: "a", gatePolicy: "PAUSE_AFTER" }],
      edges: [],
    });
    expect(steps.beginStep("a")).toEqual({ ok: true });

    steps.completeStep("a");

    expect(state.stepStatus.get("a")).toBe("completed");
    expect(state.gateState.get("a")?.after).toBe("pending");
    expect(state.trace).toContainEqual({
      id: "evt_2",
      type: "human_gate_requested",
      runId: state.run.id,
      ts: "2026-06-12T00:00:00.000Z",
      stepId: "a",
      gate: "PAUSE_AFTER",
      reason: "Review outputs before downstream steps proceed",
    });
    expect(state.trace).toContainEqual({
      id: "evt_3",
      type: "step_completed",
      runId: state.run.id,
      ts: "2026-06-12T00:00:00.000Z",
      stepId: "a",
      ok: true,
    });
  });

  it("failStep without failFast fails the step, leaves the run running, and appends a non-fatal error", () => {
    const { state, steps } = makeHarness();
    expect(steps.beginStep("a")).toEqual({ ok: true });

    steps.failStep("a", { message: "tool timeout", code: "TIMEOUT" });

    expect(state.stepStatus.get("a")).toBe("failed");
    expect(state.run.status).toBe("running");
    expect(state.trace).toContainEqual({
      id: "evt_3",
      type: "error",
      runId: state.run.id,
      ts: "2026-06-12T00:00:00.000Z",
      stepId: "a",
      message: "tool timeout",
      code: "TIMEOUT",
      fatal: false,
    });
  });

  it("failStep with failFast also transitions the run to failed", () => {
    const { state, steps } = makeHarness();
    expect(steps.beginStep("a")).toEqual({ ok: true });

    steps.failStep("a", { message: "fatal model error", code: "FATAL" }, { failFast: true });

    expect(state.stepStatus.get("a")).toBe("failed");
    expect(state.run.status).toBe("failed");
    expect(state.trace).toContainEqual({
      id: "evt_4",
      type: "run_status_changed",
      runId: state.run.id,
      ts: "2026-06-12T00:00:00.000Z",
      status: "failed",
      reason: "fatal model error",
    });
  });
});
