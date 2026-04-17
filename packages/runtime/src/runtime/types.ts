import type { ArtifactVersion } from "../protocol/artifacts.js";
import type { RunContextRef, RunInstance } from "../protocol/run.js";
import type { RuleSet } from "../protocol/rules.js";
import type { TraceEvent } from "../protocol/trace.js";
import type { WorkflowSpec } from "../protocol/workflow.js";
import type { StepGateState } from "./gates.js";

export type StepRuntimeStatus = "pending" | "running" | "completed" | "failed";

export type RunStoreState = {
  /** Monotonic counter bumped on every trace append (for external store subscriptions). */
  revision: number;
  run: RunInstance;
  trace: TraceEvent[];
  artifactsByKey: Map<string, ArtifactVersion>;
  ruleSetsById: Map<string, RuleSet>;
  stepStatus: Map<string, StepRuntimeStatus>;
  gateState: Map<string, StepGateState>;
  idempotency: Map<string, { artifactKey: string; version: number }>;
};

export type StartRunInput = {
  workflow: WorkflowSpec;
  /** Initial rule sets keyed by id */
  ruleSets?: RuleSet[];
  /** Initial artifacts (version 1) */
  initialArtifacts?: Array<{ artifact: Omit<ArtifactVersion, "version" | "createdAt"> }>;
  context?: RunContextRef;
  tags?: string[];
};

export type Listener = (event: TraceEvent) => void;

export type BlockReason =
  | { type: "gate"; stepId: string; gate: "PAUSE_BEFORE" | "PAUSE_AFTER" | "CHECKPOINT" }
  | { type: "predecessor"; stepId: string; waitingOn: string[] }
  | { type: "predecessor_after_gate"; stepId: string; waitingOn: string }
  | { type: "not_pending"; stepId: string; status: StepRuntimeStatus };
