import { z } from "zod";
import { ArtifactVersionSchema } from "./artifacts.js";
import { RuleSetSchema } from "./rules.js";

/**
 * Minimal RFC 6902 (JSON Patch) operation schema. We validate shape, not
 * pointer-target reachability — that is the runtime's job at apply time. The
 * Zod refinement guarantees the discriminator field set matches the spec so
 * imported bundles cannot smuggle unparseable patches into the trace.
 */
export const JsonPatchOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), path: z.string(), value: z.unknown() }).strict(),
  z.object({ op: z.literal("remove"), path: z.string() }).strict(),
  z.object({ op: z.literal("replace"), path: z.string(), value: z.unknown() }).strict(),
  z.object({ op: z.literal("move"), path: z.string(), from: z.string() }).strict(),
  z.object({ op: z.literal("copy"), path: z.string(), from: z.string() }).strict(),
  z.object({ op: z.literal("test"), path: z.string(), value: z.unknown() }).strict(),
]);

export type JsonPatchOp = z.infer<typeof JsonPatchOpSchema>;

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

/**
 * Per-call cost reported by an LLM gateway/provider.
 *
 * NOTE on precision: `amount` is a JavaScript `number`. This is fine for
 * surfacing per-call cost in UI, exporting as approximate totals, and for any
 * "is this run within budget?" check. **It is not suitable as a billing
 * ledger.** If you need cent-accurate billing, pull the cost from your
 * gateway's invoice / usage API server-side (or store amounts as integer
 * micro-cents) — do not roll up `model_io.cost.amount` from traces for
 * accounting purposes.
 *
 * Currency should normally be an ISO 4217 code; the schema only enforces
 * non-empty so that gateways with custom denominations (e.g. provider tokens)
 * can still surface cost.
 */
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
    patch: z.array(JsonPatchOpSchema),
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
    /**
     * The single parent run id this run forked from. Present for legacy
     * forks. When the child has multiple supervising parents, also set
     * `parentRunIds` and ensure `parentRunIds[0] === parentRunId`.
     */
    parentRunId: z.string().min(1),
    /**
     * Optional plural list of parent run ids for agent-of-agents /
     * multi-supervisor scenarios. When set, MUST be non-empty and
     * `parentRunIds[0]` MUST equal `parentRunId`.
     */
    parentRunIds: z.array(z.string().min(1)).min(1).optional(),
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
  /**
   * Hierarchical span — opens a unit of work that can contain other span and
   * non-span events. Modeled after OpenTelemetry GenAI semantic conventions.
   * Convert to/from OTel via {@link traceEventsToOtelSpans}.
   */
  BaseTrace.extend({
    type: z.literal("span_started"),
    spanId: z.string().min(1),
    parentSpanId: z.string().min(1).optional(),
    name: z.string().min(1),
    kind: z.enum(["internal", "client", "server", "producer", "consumer"]).optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
  }),
  BaseTrace.extend({
    type: z.literal("span_ended"),
    spanId: z.string().min(1),
    status: z.enum(["ok", "error"]).optional(),
    durationMs: z.number().nonnegative().optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
    error: z
      .object({ message: z.string(), code: z.string().optional() })
      .optional(),
  }),
]);

export type TraceEvent = z.infer<typeof TraceEventSchema>;

export function parseTraceEvent(input: unknown): TraceEvent {
  return TraceEventSchema.parse(input);
}
