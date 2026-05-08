import { WorkbenchError } from "../errors.js";
import type { GateController } from "./gateController.js";
import type { RunLifecycleController } from "./runLifecycleController.js";
import type { SessionContext } from "./sessionContext.js";

export class StepController {
  constructor(
    private readonly ctx: SessionContext,
    private readonly lifecycle: RunLifecycleController,
    private readonly gates: GateController,
  ) {}

  private get runId() {
    return this.ctx.state.run.id;
  }

  assertCanStartStep(stepId: string) {
    const res = this.ctx.canStartStep(stepId);
    if (!res.ok) {
      throw new WorkbenchError(
        "INVALID_STATE_TRANSITION",
        `Cannot start step ${stepId}: ${JSON.stringify(res.reason)}`,
      );
    }
  }

  beginStep(stepId: string) {
    this.lifecycle.assertRunActive("begin step");
    const res = this.ctx.canStartStep(stepId);
    if (!res.ok) return res;

    this.ctx.state.stepStatus.set(stepId, "running");
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "step_started",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId,
    });
    return { ok: true as const };
  }

  completeStep(stepId: string) {
    this.lifecycle.assertRunActive("complete step");
    const spec = this.ctx.state.run.workflowSnapshot;
    const step = spec.steps.find((s) => s.id === stepId);
    if (!step) throw new WorkbenchError("UNKNOWN_STEP", `Unknown step: ${stepId}`);

    const st = this.ctx.state.stepStatus.get(stepId);
    if (st !== "running") {
      throw new WorkbenchError(
        "INVALID_STATE_TRANSITION",
        `Cannot complete step ${stepId}: expected status "running", got "${st ?? "missing"}"`,
      );
    }

    this.ctx.state.stepStatus.set(stepId, "completed");
    const gs = this.ctx.state.gateState.get(stepId);
    if (gs && (step.gatePolicy === "PAUSE_AFTER" || step.gatePolicy === "CHECKPOINT")) {
      gs.after = "pending";
      this.gates.requestGate({
        stepId,
        gate: "PAUSE_AFTER",
        reason: "Review outputs before downstream steps proceed",
      });
    }

    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "step_completed",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId,
      ok: true,
    });
  }

  failStep(
    stepId: string,
    error: { message: string; code?: string },
    options?: { failFast?: boolean },
  ) {
    this.lifecycle.assertRunActive("fail step");
    const st = this.ctx.state.stepStatus.get(stepId);
    if (st === "completed" || st === "failed") {
      throw new WorkbenchError(
        "INVALID_STATE_TRANSITION",
        `Cannot fail step ${stepId}: terminal status "${st}"`,
      );
    }

    const failFast = options?.failFast ?? false;

    this.ctx.state.stepStatus.set(stepId, "failed");
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "step_completed",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId,
      ok: false,
      error: { message: error.message, code: error.code },
    });
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "error",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId,
      message: error.message,
      code: error.code,
      fatal: failFast,
    });
    if (failFast) {
      this.lifecycle.failRun(error);
    }
  }
}
