import { WorkbenchError } from "../errors.js";
import type { RunLifecycleController } from "./runLifecycleController.js";
import type { SessionContext } from "./sessionContext.js";

export class GateController {
  constructor(
    private readonly ctx: SessionContext,
    private readonly lifecycle: RunLifecycleController,
  ) {}

  private get runId() {
    return this.ctx.state.run.id;
  }

  requestGate(input: {
    stepId: string;
    gate: "PAUSE_BEFORE" | "PAUSE_AFTER" | "CHECKPOINT";
    reason?: string;
  }) {
    this.lifecycle.assertRunActive("request gate");
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "human_gate_requested",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId: input.stepId,
      gate: input.gate,
      reason: input.reason,
    });
  }

  resolveGate(input: {
    stepId: string;
    gate: "PAUSE_BEFORE" | "PAUSE_AFTER" | "CHECKPOINT";
    decision: "approved" | "rejected" | "edited";
    note?: string;
  }) {
    this.lifecycle.assertRunActive("resolve gate");
    const gs = this.ctx.state.gateState.get(input.stepId);
    if (!gs) throw new WorkbenchError("UNKNOWN_STEP", `Unknown step: ${input.stepId}`);

    const approved = input.decision !== "rejected";
    if (input.gate === "PAUSE_BEFORE") gs.before = approved ? "approved" : "pending";
    if (input.gate === "PAUSE_AFTER") gs.after = approved ? "approved" : "pending";
    if (input.gate === "CHECKPOINT") {
      // Generic CHECKPOINT approval: allow host to use resolveCheckpoint for finer control
      if (approved) gs.before = "approved";
    }

    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "human_gate_resolved",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId: input.stepId,
      gate: input.gate,
      decision: input.decision,
      note: input.note,
    });
  }

  resolveCheckpoint(input: {
    stepId: string;
    checkpointId: string;
    decision: "approved" | "rejected";
  }) {
    this.lifecycle.assertRunActive("resolve checkpoint");
    const gs = this.ctx.state.gateState.get(input.stepId);
    if (!gs) throw new WorkbenchError("UNKNOWN_STEP", `Unknown step: ${input.stepId}`);
    gs.checkpoints[input.checkpointId] =
      input.decision === "rejected" ? "pending" : "approved";
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "human_gate_resolved",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId: input.stepId,
      gate: "CHECKPOINT",
      decision: input.decision === "rejected" ? "rejected" : "approved",
      note: input.checkpointId,
    });
  }
}
