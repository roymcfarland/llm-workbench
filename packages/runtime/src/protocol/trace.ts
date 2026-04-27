import { z } from "zod";
import { ArtifactVersionSchema } from "./artifacts.js";
import { RuleSetSchema } from "./rules.js";

const BaseTrace = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  ts: z.string().datetime({ offset: true }),
  stepId: z.string().optional(),
  correlationId: z.string().optional(),
});

export const ModelUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional(),
    cachedInputTokens: z.number().int().nonnegative().optional(),
    reasoningTokens: z.number().int().nonnegative().optional(),
  })
  .strict();

export type ModelUsage = z.infer<typeof ModelUsageSchema>;

export const ModelCostSchema = z
  .object({
    amount: z.number().nonnegative(),
    currency: z.string().min(1),
  })
  .strict();

export type ModelCost = z.infer<typeof ModelCostSchema>;

export const TraceEventSchema = z.discriminatedUnion("type", [
  BaseTrace.extend({
    type: z.literal("step_started"),
    stepId: z.string().min(1),
  }),
  BaseTrace.extend({
    type: z.literal("step_completed"),
    stepId: z.string().min(1),
    ok: z.boolean(),
    error: z
      .object({ message: z.string(), code: z.string().optional() })
      .optional(),
  }),
  BaseTrace.extend({
    type: z.literal("artifact_written"),
    artifact: ArtifactVersionSchema,
    idempotencyKey: z.string().optional(),
  }),
  BaseTrace.extend({
    type: z.literal("artifact_patch"),
    artifactKey: z.string().min(1),
    fromVersion: z.number().int().positive(),
    toVersion: z.number().int().positive(),
    patch: z.array(z.unknown()),
    idempotencyKey: z.string().optional(),
  }),
  BaseTrace.extend({
    type: z.literal("model_io"),
    direction: z.enum(["request", "response", "stream_chunk"]),
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    usage: ModelUsageSchema.optional(),
    cost: ModelCostSchema.optional(),
    durationMs: z.number().nonnegative().optional(),
    summary: z.string().optional(),
    /** Redacted or truncated payload */
    payload: z.unknown().optional(),
  }),
  BaseTrace.extend({
    type: z.literal("tool_call"),
    name: z.string(),
    args: z.unknown().optional(),
    result: z.unknown().optional(),
  }),
  BaseTrace.extend({
    type: z.literal("human_gate_requested"),
    stepId: z.string().min(1),
    gate: z.enum(["PAUSE_BEFORE", "PAUSE_AFTER", "CHECKPOINT"]),
    reason: z.string().optional(),
  }),
  BaseTrace.extend({
    type: z.literal("human_gate_resolved"),
    stepId: z.string().min(1),
    gate: z.enum(["PAUSE_BEFORE", "PAUSE_AFTER", "CHECKPOINT"]),
    decision: z.enum(["approved", "rejected", "edited"]),
    note: z.string().optional(),
  }),
  BaseTrace.extend({
    type: z.literal("rule_changed"),
    ruleSetId: z.string().min(1),
    snapshot: RuleSetSchema,
  }),
  BaseTrace.extend({
    type: z.literal("policy_changed"),
    stepId: z.string().min(1),
    policy: z.enum(["AUTO", "PAUSE_BEFORE", "PAUSE_AFTER", "CHECKPOINT"]),
  }),
  BaseTrace.extend({
    type: z.literal("error"),
    message: z.string(),
    code: z.string().optional(),
    fatal: z.boolean().optional(),
  }),
  BaseTrace.extend({
    type: z.literal("run_forked"),
    parentRunId: z.string().min(1),
    forkedFromStepId: z.string().optional(),
  }),
  BaseTrace.extend({
    type: z.literal("annotation"),
    text: z.string(),
    tags: z.array(z.string()).optional(),
  }),
  BaseTrace.extend({
    type: z.literal("run_status_changed"),
    status: z.enum(["running", "completed", "failed", "cancelled"]),
    reason: z.string().optional(),
  }),
]);

export type TraceEvent = z.infer<typeof TraceEventSchema>;

export function parseTraceEvent(input: unknown): TraceEvent {
  return TraceEventSchema.parse(input);
}
