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

  const inDegree = new Map<string, number>();
  const successors = new Map<string, string[]>();
  for (const id of stepIds) {
    inDegree.set(id, 0);
    successors.set(id, []);
  }
  for (const e of spec.edges) {
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    successors.get(e.from)?.push(e.to);
  }

  const ready = [...inDegree.entries()].filter(([, count]) => count === 0).map(([id]) => id);
  let visited = 0;
  for (let i = 0; i < ready.length; i += 1) {
    const id = ready[i]!;
    visited += 1;
    for (const next of successors.get(id) ?? []) {
      const count = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, count);
      if (count === 0) ready.push(next);
    }
  }

  if (visited !== stepIds.size) {
    const cyclic = [...inDegree.entries()]
      .filter(([, count]) => count > 0)
      .map(([id]) => id)
      .sort();
    throw new WorkbenchError("INVALID_WORKFLOW", `Workflow graph contains a cycle involving: ${cyclic.join(", ")}`);
  }
}
