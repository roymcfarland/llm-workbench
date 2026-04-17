import { z } from "zod";

export const StepGatePolicySchema = z.enum([
  "AUTO",
  "PAUSE_BEFORE",
  "PAUSE_AFTER",
  "CHECKPOINT",
]);

export type StepGatePolicy = z.infer<typeof StepGatePolicySchema>;

export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
});

export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

export const WorkflowStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  gatePolicy: StepGatePolicySchema.default("AUTO"),
  /** Artifact keys this step reads (informational for UI / host hints) */
  inputs: z.array(z.string()).default([]),
  /** Artifact keys this step is expected to write */
  outputs: z.array(z.string()).default([]),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const WorkflowSpecSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().nonnegative(),
  title: z.string().optional(),
  steps: z.array(WorkflowStepSchema).min(1),
  edges: z.array(WorkflowEdgeSchema).default([]),
});

export type WorkflowSpec = z.infer<typeof WorkflowSpecSchema>;

export function parseWorkflowSpec(input: unknown): WorkflowSpec {
  return WorkflowSpecSchema.parse(input);
}
