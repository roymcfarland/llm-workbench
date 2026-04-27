import { WorkbenchError } from "../errors.js";
import type { RunBundle } from "./run.js";
import type { TraceEvent } from "./trace.js";
import { assertWorkflowStructuralInvariants } from "./workflowValidate.js";

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes].sort();
}

function assertNoDuplicates(values: string[], label: string): void {
  const dupes = duplicateValues(values);
  if (dupes.length) {
    throw new WorkbenchError("INVALID_RUN_BUNDLE", `Duplicate ${label}: ${dupes.join(", ")}`);
  }
}

function eventStepId(event: TraceEvent): string | undefined {
  return "stepId" in event ? event.stepId : undefined;
}

/**
 * Validates bundle invariants that JSON schema alone cannot express.
 *
 * This protects import paths from accepting bundles that would hydrate into
 * impossible runtime state, for example cyclic workflows, trace events from a
 * different run, or engine snapshots keyed by unknown workflow steps.
 */
export function assertRunBundleStructuralInvariants(bundle: RunBundle): void {
  const workflow = bundle.run.workflowSnapshot;
  assertWorkflowStructuralInvariants(workflow);

  if (bundle.run.workflowId !== workflow.id) {
    throw new WorkbenchError(
      "INVALID_RUN_BUNDLE",
      `Run workflowId "${bundle.run.workflowId}" does not match workflow snapshot id "${workflow.id}"`,
    );
  }
  if (bundle.run.workflowVersion !== workflow.version) {
    throw new WorkbenchError(
      "INVALID_RUN_BUNDLE",
      `Run workflowVersion ${bundle.run.workflowVersion} does not match workflow snapshot version ${workflow.version}`,
    );
  }

  const stepIds = new Set(workflow.steps.map((s) => s.id));
  for (const event of bundle.trace) {
    if (event.runId !== bundle.run.id) {
      throw new WorkbenchError(
        "INVALID_RUN_BUNDLE",
        `Trace event "${event.id}" belongs to run "${event.runId}", expected "${bundle.run.id}"`,
      );
    }
    const stepId = eventStepId(event);
    if (stepId && !stepIds.has(stepId)) {
      throw new WorkbenchError(
        "INVALID_RUN_BUNDLE",
        `Trace event "${event.id}" references unknown workflow step "${stepId}"`,
      );
    }
  }

  assertNoDuplicates(bundle.ruleSets.map((rs) => rs.id), "ruleSet ids");
  for (const rs of bundle.ruleSets) {
    assertNoDuplicates(rs.rules.map((r) => r.id), `rule ids in ruleSet "${rs.id}"`);
  }

  const artifactVersions = new Set<string>();
  for (const artifact of bundle.artifacts) {
    const key = `${artifact.artifactKey}@${artifact.version}`;
    if (artifactVersions.has(key)) {
      throw new WorkbenchError("INVALID_RUN_BUNDLE", `Duplicate artifact version: ${key}`);
    }
    artifactVersions.add(key);
  }

  if (!bundle.engine) return;

  assertNoDuplicates(bundle.engine.stepStatus.map(([stepId]) => stepId), "engine stepStatus keys");
  assertNoDuplicates(bundle.engine.gateState.map(([stepId]) => stepId), "engine gateState keys");
  for (const [stepId] of bundle.engine.stepStatus) {
    if (!stepIds.has(stepId)) {
      throw new WorkbenchError("INVALID_RUN_BUNDLE", `Engine stepStatus references unknown step "${stepId}"`);
    }
  }
  for (const [stepId] of bundle.engine.gateState) {
    if (!stepIds.has(stepId)) {
      throw new WorkbenchError("INVALID_RUN_BUNDLE", `Engine gateState references unknown step "${stepId}"`);
    }
  }
}
