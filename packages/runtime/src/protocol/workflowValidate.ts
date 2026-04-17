import { WorkbenchError } from "../errors.js";
import type { WorkflowSpec } from "./workflow.js";

/**
 * Validates graph invariants beyond JSON-schema shape (edge endpoints, duplicate ids).
 */
export function assertWorkflowStructuralInvariants(spec: WorkflowSpec): void {
  const stepIds = new Set<string>();
  for (const s of spec.steps) {
    if (stepIds.has(s.id)) {
      throw new WorkbenchError("INVALID_WORKFLOW", `Duplicate workflow step id: ${s.id}`);
    }
    stepIds.add(s.id);
  }

  const edgeIds = new Set<string>();
  for (const e of spec.edges) {
    if (!stepIds.has(e.from)) {
      throw new WorkbenchError(
        "INVALID_WORKFLOW",
        `Edge "${e.id}" references unknown "from" step: ${e.from}`,
      );
    }
    if (!stepIds.has(e.to)) {
      throw new WorkbenchError("INVALID_WORKFLOW", `Edge "${e.id}" references unknown "to" step: ${e.to}`);
    }
    if (e.from === e.to) {
      throw new WorkbenchError("INVALID_WORKFLOW", `Edge "${e.id}" cannot connect a step to itself (${e.from})`);
    }
    if (edgeIds.has(e.id)) {
      throw new WorkbenchError("INVALID_WORKFLOW", `Duplicate workflow edge id: ${e.id}`);
    }
    edgeIds.add(e.id);
  }
}
