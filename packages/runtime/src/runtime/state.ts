import { WorkbenchError } from "../errors.js";
import type { TraceEvent } from "../protocol/trace.js";
import { assertWorkflowStructuralInvariants } from "../protocol/workflowValidate.js";
import type { RunStoreState } from "./types.js";

function cloneValue<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch (e) {
    throw new WorkbenchError(
      "INVALID_RUN_STATE",
      "Run state contains a value that cannot be cloned safely",
      e,
    );
  }
}

function traceStepId(event: TraceEvent): string | undefined {
  return "stepId" in event ? event.stepId : undefined;
}

export function cloneRunStoreState(state: RunStoreState): RunStoreState {
  return {
    ...state,
    run: cloneValue(state.run),
    trace: cloneValue(state.trace),
    artifactsByKey: new Map(
      [...state.artifactsByKey.entries()].map(([key, value]) => [key, cloneValue(value)]),
    ),
    ruleSetsById: new Map(
      [...state.ruleSetsById.entries()].map(([key, value]) => [key, cloneValue(value)]),
    ),
    stepStatus: new Map(state.stepStatus),
    gateState: new Map(
      [...state.gateState.entries()].map(([key, value]) => [key, cloneValue(value)]),
    ),
    idempotency: new Map(
      [...state.idempotency.entries()].map(([key, value]) => [key, cloneValue(value)]),
    ),
  };
}

export function assertRunStoreStateStructuralInvariants(state: RunStoreState): void {
  if (!state?.run?.id) {
    throw new WorkbenchError("INVALID_RUN_STATE", "Run state is missing run.id");
  }

  const workflow = state.run.workflowSnapshot;
  assertWorkflowStructuralInvariants(workflow);
  if (state.run.workflowId !== workflow.id) {
    throw new WorkbenchError(
      "INVALID_RUN_STATE",
      `Run workflowId "${state.run.workflowId}" does not match workflow snapshot id "${workflow.id}"`,
    );
  }
  if (state.run.workflowVersion !== workflow.version) {
    throw new WorkbenchError(
      "INVALID_RUN_STATE",
      `Run workflowVersion ${state.run.workflowVersion} does not match workflow snapshot version ${workflow.version}`,
    );
  }

  const stepIds = new Set(workflow.steps.map((s) => s.id));
  for (const step of workflow.steps) {
    if (!state.stepStatus.has(step.id)) {
      throw new WorkbenchError("INVALID_RUN_STATE", `Run state is missing status for step "${step.id}"`);
    }
    if (!state.gateState.has(step.id)) {
      throw new WorkbenchError("INVALID_RUN_STATE", `Run state is missing gate state for step "${step.id}"`);
    }
  }

  for (const stepId of state.stepStatus.keys()) {
    if (!stepIds.has(stepId)) {
      throw new WorkbenchError("INVALID_RUN_STATE", `Run state has status for unknown step "${stepId}"`);
    }
  }
  for (const stepId of state.gateState.keys()) {
    if (!stepIds.has(stepId)) {
      throw new WorkbenchError("INVALID_RUN_STATE", `Run state has gate state for unknown step "${stepId}"`);
    }
  }
  for (const event of state.trace) {
    if (event.runId !== state.run.id) {
      throw new WorkbenchError(
        "INVALID_RUN_STATE",
        `Trace event "${event.id}" belongs to run "${event.runId}", expected "${state.run.id}"`,
      );
    }
    const stepId = traceStepId(event);
    if (stepId && !stepIds.has(stepId)) {
      throw new WorkbenchError("INVALID_RUN_STATE", `Trace event "${event.id}" references unknown step "${stepId}"`);
    }
  }

  for (const [artifactKey, artifact] of state.artifactsByKey) {
    if (artifact.artifactKey !== artifactKey) {
      throw new WorkbenchError(
        "INVALID_RUN_STATE",
        `Artifact map key "${artifactKey}" does not match artifactKey "${artifact.artifactKey}"`,
      );
    }
  }
  for (const [ruleSetId, ruleSet] of state.ruleSetsById) {
    if (ruleSet.id !== ruleSetId) {
      throw new WorkbenchError(
        "INVALID_RUN_STATE",
        `RuleSet map key "${ruleSetId}" does not match ruleSet id "${ruleSet.id}"`,
      );
    }
  }
}
