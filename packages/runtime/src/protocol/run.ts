import { z } from "zod";
import { WorkflowSpecSchema } from "./workflow.js";
import { RuleSetSchema } from "./rules.js";
import { ArtifactVersionSchema } from "./artifacts.js";
import { TraceEventSchema } from "./trace.js";
import { RunBundleEngineSchema } from "./engine.js";
import { WORKBENCH_PROTOCOL_VERSION } from "./version.js";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

/**
 * Parent linkage for a run that is descended from one or more other runs.
 *
 * - **Single parent (fork):** set `parentRunId` (legacy, still supported and
 *   still written by `buildForkStartInput`).
 * - **Multi-parent (agent-of-agents / supervision):** set `parentRunIds` to a
 *   non-empty array. When both are set, `parentRunIds[0]` MUST equal
 *   `parentRunId`. New code should prefer `parentRunIds`; reading code should
 *   prefer the helper {@link getParentRunIds}.
 *
 * Adding `parentRunIds` as plural is the schema's escape hatch for
 * supervisor → child / coordinator → workers patterns where a child may have
 * multiple supervising parents (e.g. a research agent invoked by both a
 * planner run and a tool-call run that share state). The single
 * `parentRunId` form remains the canonical shape for explicit human forks.
 */
export const RunContextRefSchema = z
  .object({
    /**
     * @deprecated Prefer `parentRunIds`. Kept for back-compat and for the
     *   common "fork from a single parent" case. When `parentRunIds` is set,
     *   this MUST equal `parentRunIds[0]`.
     */
    parentRunId: z.string().min(1).optional(),
    parentRunIds: z.array(z.string().min(1)).min(1).optional(),
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
  })
  .superRefine((ctx, issue) => {
    const hasSingular = typeof ctx.parentRunId === "string";
    const hasPlural = Array.isArray(ctx.parentRunIds) && ctx.parentRunIds.length > 0;
    if (!hasSingular && !hasPlural) {
      issue.addIssue({
        code: z.ZodIssueCode.custom,
        message: "RunContextRef requires parentRunId or non-empty parentRunIds",
        path: ["parentRunId"],
      });
      return;
    }
    if (hasSingular && hasPlural && ctx.parentRunIds![0] !== ctx.parentRunId) {
      issue.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "RunContextRef.parentRunIds[0] must equal parentRunId when both are set",
        path: ["parentRunIds", 0],
      });
    }
  });

export type RunContextRef = z.infer<typeof RunContextRefSchema>;

/**
 * Normalize {@link RunContextRef} parent linkage into an ordered array of
 * parent run ids. Always returns at least one entry for any value that has
 * passed schema validation.
 */
export function getParentRunIds(ctx: RunContextRef): string[] {
  if (ctx.parentRunIds && ctx.parentRunIds.length > 0) return [...ctx.parentRunIds];
  if (ctx.parentRunId) return [ctx.parentRunId];
  return [];
}

export const RunSubjectRefSchema = z
  .object({
    userId: z.string().min(1).optional(),
    tenantId: z.string().min(1).optional(),
    accountId: z.string().min(1).optional(),
    planId: z.string().min(1).optional(),
  })
  .strict();

export type RunSubjectRef = z.infer<typeof RunSubjectRefSchema>;

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
  /** Host-provided subject/account attribution for telemetry, quotas, and billing. */
  subject: RunSubjectRefSchema.optional(),
  /** JSON-only host metadata kept with the run snapshot. Avoid secrets. */
  metadata: z.record(z.string(), JsonValueSchema).optional(),
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
