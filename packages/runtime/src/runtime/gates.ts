import type { StepGatePolicy } from "../protocol/workflow.js";

export type GateKind = "PAUSE_BEFORE" | "PAUSE_AFTER" | "CHECKPOINT";

export type GateSlot = "before" | "after" | "checkpoint";

export type GateStatus = "approved" | "pending";

export type StepGateState = {
  before: GateStatus;
  after: GateStatus;
  checkpoints: Record<string, GateStatus>;
};

export function initialGateState(policy: StepGatePolicy): StepGateState {
  if (policy === "AUTO") {
    return { before: "approved", after: "approved", checkpoints: {} };
  }
  if (policy === "PAUSE_BEFORE") {
    return { before: "pending", after: "approved", checkpoints: {} };
  }
  if (policy === "PAUSE_AFTER") {
    // `after` engages only once the step completes; start unblocked for upstream sequencing
    return { before: "approved", after: "approved", checkpoints: {} };
  }
  // CHECKPOINT: explicit approvals before start; `after` engages on completion (see session.completeStep)
  return { before: "pending", after: "approved", checkpoints: {} };
}

export function gateKindForPolicy(policy: StepGatePolicy, slot: GateSlot): GateKind | null {
  if (slot === "before") {
    if (policy === "PAUSE_BEFORE" || policy === "CHECKPOINT") return "PAUSE_BEFORE";
    return null;
  }
  if (slot === "after") {
    if (policy === "PAUSE_AFTER") return "PAUSE_AFTER";
    if (policy === "CHECKPOINT") return "PAUSE_AFTER"; // treat end-of-step as after gate for CHECKPOINT policy
    return null;
  }
  return "CHECKPOINT";
}
