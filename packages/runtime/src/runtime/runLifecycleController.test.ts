import { describe, expect, it, vi } from "vitest";
import { WorkbenchError } from "../errors.js";
import type { RunTerminalStatus } from "../protocol/run.js";
import type { TraceEvent } from "../protocol/trace.js";
import { TraceEventSchema } from "../protocol/trace.js";
import type { WorkflowSpec } from "../protocol/workflow.js";
import { WORKBENCH_PROTOCOL_VERSION } from "../protocol/version.js";
import { canStartStep } from "./readiness.js";
import { RunLifecycleController } from "./runLifecycleController.js";
import type { SessionContext } from "./sessionContext.js";
import { WorkbenchRuntime } from "./workbench.js";

const autoWorkflow = {
  id: "wf",
  version: 1,
  steps: [{ id: "a", gatePolicy: "AUTO" as const }],
  edges: [],
};

function expectWorkbenchError(
  fn: () => unknown,
  code: WorkbenchError["code"],
  messagePart?: string,
) {
  try {
    fn();
  } catch (error) {
    expect(WorkbenchError.is(error)).toBe(true);
    if (!WorkbenchError.is(error)) return;
    expect(error.code).toBe(code);
    if (messagePart) expect(error.message).toContain(messagePart);
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

  return {
    state,
    lifecycle: new RunLifecycleController(ctx),
  };
}

describe("RunLifecycleController", () => {
  it("assertRunActive rejects terminal statuses with the requested action in the message", () => {
    const statuses: RunTerminalStatus[] = ["completed", "failed", "cancelled"];

    for (const status of statuses) {
      const { lifecycle, state } = makeHarness();
      state.run.status = status;

      expectWorkbenchError(
        () => lifecycle.assertRunActive("write artifact"),
        "INVALID_STATE_TRANSITION",
        "write artifact",
      );
    }
  });

  it("completeRun rejects terminal transition while any step is still running", () => {
    const { lifecycle, state } = makeHarness();
    state.stepStatus.set("a", "running");

    expectWorkbenchError(
      () => lifecycle.completeRun(),
      "INVALID_STATE_TRANSITION",
      "running steps remain (a)",
    );
    expect(state.run.status).toBe("running");
    expect(state.trace).toEqual([]);
  });

  it("completeRun and cancelRun set terminal status, endedAt, and append run_status_changed", () => {
    const cases: Array<{
      action: (lifecycle: RunLifecycleController) => void;
      status: RunTerminalStatus;
      reason: string;
    }> = [
      {
        action: (lifecycle) => lifecycle.completeRun({ reason: "all done" }),
        status: "completed",
        reason: "all done",
      },
      {
        action: (lifecycle) => lifecycle.cancelRun({ reason: "operator stopped" }),
        status: "cancelled",
        reason: "operator stopped",
      },
    ];

    for (const { action, status, reason } of cases) {
      const { lifecycle, state } = makeHarness();
      action(lifecycle);

      expect(state.run.status).toBe(status);
      expect(state.run.endedAt).toBe("2026-06-12T00:00:00.000Z");
      expect(state.trace).toContainEqual({
        id: "evt_1",
        type: "run_status_changed",
        runId: state.run.id,
        ts: "2026-06-12T00:00:00.000Z",
        status,
        reason,
      });
    }
  });

  it("failRun marks the run failed and preserves the error in trace", () => {
    const { lifecycle, state } = makeHarness();

    lifecycle.failRun({ message: "model overloaded", code: "MODEL_BUSY" });

    expect(state.run.status).toBe("failed");
    expect(state.run.endedAt).toBe("2026-06-12T00:00:00.000Z");
    expect(state.trace).toContainEqual({
      id: "evt_1",
      type: "run_status_changed",
      runId: state.run.id,
      ts: "2026-06-12T00:00:00.000Z",
      status: "failed",
      reason: "model overloaded",
    });
    expect(state.trace).toContainEqual({
      id: "evt_2",
      type: "error",
      runId: state.run.id,
      ts: "2026-06-12T00:00:00.000Z",
      message: "model overloaded",
      code: "MODEL_BUSY",
      fatal: true,
    });
  });

  it('exportRunBundle rejects profile "user" without a registry', async () => {
    const { lifecycle } = makeHarness();

    await expect(lifecycle.exportRunBundle({ profile: "user" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("completeRun rejects a second terminal transition", () => {
    const { lifecycle, state } = makeHarness();
    lifecycle.completeRun();

    expectWorkbenchError(
      () => lifecycle.completeRun(),
      "INVALID_STATE_TRANSITION",
      "mark run as completed",
    );
    expect(state.run.status).toBe("completed");
    expect(state.trace.filter((event) => event.type === "run_status_changed")).toHaveLength(1);
  });
});
