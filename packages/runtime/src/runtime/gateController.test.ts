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
import { WorkbenchRuntime } from "./workbench.js";

const gateWorkflow = {
  id: "wf",
  version: 1,
  steps: [{ id: "a", gatePolicy: "PAUSE_BEFORE" as const }],
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

function makeHarness(workflow: WorkflowSpec = gateWorkflow) {
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
    gates: new GateController(ctx, lifecycle),
  };
}

describe("GateController", () => {
  it("requestGate appends a human_gate_requested event for each gate kind without mutating gate state", () => {
    const cases: Array<{
      gate: "PAUSE_BEFORE" | "PAUSE_AFTER" | "CHECKPOINT";
      workflow: WorkflowSpec;
    }> = [
      {
        gate: "PAUSE_BEFORE",
        workflow: {
          id: "wf",
          version: 1,
          steps: [{ id: "a", gatePolicy: "PAUSE_BEFORE" }],
          edges: [],
        },
      },
      {
        gate: "PAUSE_AFTER",
        workflow: {
          id: "wf",
          version: 1,
          steps: [{ id: "a", gatePolicy: "PAUSE_AFTER" }],
          edges: [],
        },
      },
      {
        gate: "CHECKPOINT",
        workflow: {
          id: "wf",
          version: 1,
          steps: [{ id: "a", gatePolicy: "CHECKPOINT" }],
          edges: [],
        },
      },
    ];

    for (const { gate, workflow } of cases) {
      const { gates, state } = makeHarness(workflow);
      const before = structuredClone(state.gateState.get("a"));

      gates.requestGate({ stepId: "a", gate, reason: `${gate} requested` });

      expect(state.gateState.get("a")).toEqual(before);
      expect(state.trace).toContainEqual({
        id: "evt_1",
        type: "human_gate_requested",
        runId: state.run.id,
        ts: "2026-06-12T00:00:00.000Z",
        stepId: "a",
        gate,
        reason: `${gate} requested`,
      });
    }
  });

  it("initializes gate slots per policy at run start", () => {
    const { state } = makeHarness({
      id: "wf",
      version: 1,
      steps: [
        { id: "before", gatePolicy: "PAUSE_BEFORE" },
        { id: "checkpoint", gatePolicy: "CHECKPOINT" },
        { id: "after", gatePolicy: "PAUSE_AFTER" },
      ],
      edges: [],
    });

    expect(state.gateState.get("before")).toEqual({
      before: "pending",
      after: "approved",
      checkpoints: {},
    });
    expect(state.gateState.get("checkpoint")).toEqual({
      before: "pending",
      after: "approved",
      checkpoints: {},
    });
    expect(state.gateState.get("after")).toEqual({
      before: "approved",
      after: "approved",
      checkpoints: {},
    });
  });

  it("resolveGate records each decision, note, and before-slot transition", () => {
    const cases: Array<{
      decision: "approved" | "rejected" | "edited";
      expectedBefore: "approved" | "pending";
    }> = [
      { decision: "approved", expectedBefore: "approved" },
      { decision: "rejected", expectedBefore: "pending" },
      { decision: "edited", expectedBefore: "approved" },
    ];

    for (const { decision, expectedBefore } of cases) {
      const { gates, state } = makeHarness();

      gates.resolveGate({
        stepId: "a",
        gate: "PAUSE_BEFORE",
        decision,
        note: `${decision} note`,
      });

      expect(state.gateState.get("a")?.before).toBe(expectedBefore);
      expect(state.trace).toContainEqual({
        id: "evt_1",
        type: "human_gate_resolved",
        runId: state.run.id,
        ts: "2026-06-12T00:00:00.000Z",
        stepId: "a",
        gate: "PAUSE_BEFORE",
        decision,
        note: `${decision} note`,
      });
    }
  });

  it("resolveGate updates the after slot for PAUSE_AFTER gates", () => {
    const { gates, state } = makeHarness({
      id: "wf",
      version: 1,
      steps: [{ id: "a", gatePolicy: "PAUSE_AFTER" }],
      edges: [],
    });
    state.gateState.get("a")!.after = "pending";

    gates.resolveGate({
      stepId: "a",
      gate: "PAUSE_AFTER",
      decision: "approved",
      note: "looks good",
    });

    expect(state.gateState.get("a")?.after).toBe("approved");
    expect(state.trace).toContainEqual({
      id: "evt_1",
      type: "human_gate_resolved",
      runId: state.run.id,
      ts: "2026-06-12T00:00:00.000Z",
      stepId: "a",
      gate: "PAUSE_AFTER",
      decision: "approved",
      note: "looks good",
    });
  });

  it("resolveCheckpoint mutates only the targeted checkpoint slot", () => {
    const { gates, state } = makeHarness({
      id: "wf",
      version: 1,
      steps: [{ id: "a", gatePolicy: "CHECKPOINT" }],
      edges: [],
    });
    state.gateState.get("a")!.checkpoints = {
      draft: "pending",
      final: "pending",
    };

    gates.resolveCheckpoint({
      stepId: "a",
      checkpointId: "draft",
      decision: "approved",
    });

    expect(state.gateState.get("a")?.checkpoints).toEqual({
      draft: "approved",
      final: "pending",
    });
    expect(state.trace).toContainEqual({
      id: "evt_1",
      type: "human_gate_resolved",
      runId: state.run.id,
      ts: "2026-06-12T00:00:00.000Z",
      stepId: "a",
      gate: "CHECKPOINT",
      decision: "approved",
      note: "draft",
    });
  });

  it("resolveGate and resolveCheckpoint reject unknown step ids", () => {
    const { gates } = makeHarness();

    expectWorkbenchError(
      () =>
        gates.resolveGate({
          stepId: "missing",
          gate: "PAUSE_BEFORE",
          decision: "approved",
        }),
      "UNKNOWN_STEP",
    );
    expectWorkbenchError(
      () =>
        gates.resolveCheckpoint({
          stepId: "missing",
          checkpointId: "draft",
          decision: "approved",
        }),
      "UNKNOWN_STEP",
    );
  });

  it("rejects every gate operation once the run is no longer running", () => {
    const { gates, state } = makeHarness({
      id: "wf",
      version: 1,
      steps: [{ id: "a", gatePolicy: "CHECKPOINT" }],
      edges: [],
    });
    state.run.status = "completed";

    expectWorkbenchError(
      () => gates.requestGate({ stepId: "a", gate: "CHECKPOINT" }),
      "INVALID_STATE_TRANSITION",
    );
    expectWorkbenchError(
      () =>
        gates.resolveGate({
          stepId: "a",
          gate: "CHECKPOINT",
          decision: "approved",
        }),
      "INVALID_STATE_TRANSITION",
    );
    expectWorkbenchError(
      () =>
        gates.resolveCheckpoint({
          stepId: "a",
          checkpointId: "draft",
          decision: "approved",
        }),
      "INVALID_STATE_TRANSITION",
    );
  });
});
