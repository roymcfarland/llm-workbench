import type { WorkflowSpec } from "../protocol/workflow.js";

export type StepId = string;

export function buildAdjacency(spec: WorkflowSpec): {
  predecessors: Map<StepId, StepId[]>;
  successors: Map<StepId, StepId[]>;
} {
  const predecessors = new Map<StepId, StepId[]>();
  const successors = new Map<StepId, StepId[]>();
  for (const s of spec.steps) {
    predecessors.set(s.id, []);
    successors.set(s.id, []);
  }
  for (const e of spec.edges) {
    predecessors.get(e.to)?.push(e.from);
    successors.get(e.from)?.push(e.to);
  }
  return { predecessors, successors };
}

export function roots(spec: WorkflowSpec): StepId[] {
  const { predecessors } = buildAdjacency(spec);
  return spec.steps.map((s) => s.id).filter((id) => (predecessors.get(id) ?? []).length === 0);
}
