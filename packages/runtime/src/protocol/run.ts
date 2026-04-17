import { z } from "zod";
import { WorkflowSpecSchema } from "./workflow.js";
import { RuleSetSchema } from "./rules.js";
import { ArtifactVersionSchema } from "./artifacts.js";
import { TraceEventSchema } from "./trace.js";
import { RunBundleEngineSchema } from "./engine.js";
import { WORKBENCH_PROTOCOL_VERSION } from "./version.js";

export const RunContextRefSchema = z.object({
  parentRunId: z.string().min(1),
  forkedFromStepId: z.string().optional(),
  /** Pinned artifact versions treated as read-only context */
  pinnedArtifacts: z
    .array(
      z.object({
        artifactKey: z.string(),
        version: z.number().int().positive(),
      }),
    )
    .optional(),
});

export type RunContextRef = z.infer<typeof RunContextRefSchema>;

export const RunInstanceSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  workflowVersion: z.number().int().nonnegative(),
  /** Snapshot of workflow at run start */
  workflowSnapshot: WorkflowSpecSchema,
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["running", "completed", "failed", "cancelled"]),
  context: RunContextRefSchema.optional(),
  /** Tags for organizing learning iterations */
  tags: z.array(z.string()).optional(),
  annotations: z
    .array(
      z.object({
        at: z.string().datetime({ offset: true }),
        text: z.string(),
      }),
    )
    .optional(),
});

export type RunInstance = z.infer<typeof RunInstanceSchema>;

export const RunBundleSchema = z.object({
  protocolVersion: z.literal(WORKBENCH_PROTOCOL_VERSION),
  run: RunInstanceSchema,
  trace: z.array(TraceEventSchema),
  artifacts: z.array(ArtifactVersionSchema),
  ruleSets: z.array(RuleSetSchema),
  /** Optional engine snapshot for faithful rehydration (gates, step status, idempotency). */
  engine: RunBundleEngineSchema.optional(),
  /** Integrity: sha256 of canonical JSON of {run,trace,artifacts,ruleSets,engine?} without this field */
  integrity: z
    .object({
      sha256: z.string().min(1),
    })
    .optional(),
});

export type RunBundle = z.infer<typeof RunBundleSchema>;

export function parseRunBundle(input: unknown): RunBundle {
  return RunBundleSchema.parse(input);
}
