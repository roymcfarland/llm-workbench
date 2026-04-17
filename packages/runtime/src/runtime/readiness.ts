import { WorkbenchError } from "../errors.js";
import type { WorkflowSpec } from "../protocol/workflow.js";
import { buildAdjacency } from "./graph.js";
import type { StepGateState } from "./gates.js";
import type { StepRuntimeStatus } from "./types.js";
import type { BlockReason } from "./types.js";

function stepById(spec: WorkflowSpec, stepId: string) {
  const s = spec.steps.find((x) => x.id === stepId);
  if (!s) throw new WorkbenchError("UNKNOWN_STEP", `Unknown workflow step id: ${stepId}`);
  return s;
}

export function canStartStep(input: {
  spec: WorkflowSpec;
  stepId: string;
  stepStatus: Map<string, StepRuntimeStatus>;
  gateState: Map<string, StepGateState>;
}): { ok: true } | { ok: false; reason: BlockReason } {
  const { spec, stepId, stepStatus, gateState } = input;
  const st = stepStatus.get(stepId) ?? "pending";
  if (st !== "pending") {
    return { ok: false, reason: { type: "not_pending", stepId, status: st } };
  }

  stepById(spec, stepId);
  const gs = gateState.get(stepId);
  if (!gs) return { ok: false, reason: { type: "gate", stepId, gate: "PAUSE_BEFORE" } };
  if (gs.before !== "approved") {
    return { ok: false, reason: { type: "gate", stepId, gate: "PAUSE_BEFORE" } };
  }

  const { predecessors } = buildAdjacency(spec);
  const preds = predecessors.get(stepId) ?? [];
  const waitingOn: string[] = [];
  for (const p of preds) {
    if (stepStatus.get(p) !== "completed") waitingOn.push(p);
  }
  if (waitingOn.length > 0) {
    return { ok: false, reason: { type: "predecessor", stepId, waitingOn } };
  }

  for (const p of preds) {
    const pGate = gateState.get(p);
    const pStep = stepById(spec, p);
    if (pStep.gatePolicy === "PAUSE_AFTER" || pStep.gatePolicy === "CHECKPOINT") {
      if (pGate && pGate.after !== "approved") {
        return { ok: false, reason: { type: "predecessor_after_gate", stepId, waitingOn: p } };
      }
    }
  }

  // Extra: if CHECKPOINT policy requires mid checkpoints, host should resolve via resolveCheckpoint
  // Readiness does not block on unknown checkpoint keys; host coordinates.

  return { ok: true };
}
