import { z } from "zod";
import type { RunBundle, RunInstance, RunSubjectRef } from "../protocol/run.js";
import { RunSubjectRefSchema } from "../protocol/run.js";
import type { ModelCost, ModelUsage, TraceEvent } from "../protocol/trace.js";
import { ModelCostSchema, ModelUsageSchema } from "../protocol/trace.js";
import type { RunStoreState } from "../runtime/types.js";

export const ModelTelemetryDirectionSchema = z.enum(["request", "response", "stream_chunk"]);
export type ModelTelemetryDirection = z.infer<typeof ModelTelemetryDirectionSchema>;

export const ModelTelemetryTotalsSchema = z
  .object({
    eventCount: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    cachedInputTokens: z.number().int().nonnegative(),
    reasoningTokens: z.number().int().nonnegative(),
    durationMs: z.number().nonnegative(),
    costByCurrency: z.record(z.number().nonnegative()),
  })
  .strict();

export type ModelTelemetryTotals = z.infer<typeof ModelTelemetryTotalsSchema>;

export const ModelTelemetryEntrySchema = z
  .object({
    eventId: z.string().min(1),
    runId: z.string().min(1),
    ts: z.string().datetime({ offset: true }),
    stepId: z.string().min(1).optional(),
    correlationId: z.string().min(1).optional(),
    direction: ModelTelemetryDirectionSchema,
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    subject: RunSubjectRefSchema.optional(),
    usage: ModelUsageSchema.optional(),
    cost: ModelCostSchema.optional(),
    durationMs: z.number().nonnegative().optional(),
  })
  .strict();

export type ModelTelemetryEntry = z.infer<typeof ModelTelemetryEntrySchema>;

export const ModelTelemetryBucketSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    totals: ModelTelemetryTotalsSchema,
  })
  .strict();

export type ModelTelemetryBucket = z.infer<typeof ModelTelemetryBucketSchema>;

export const ModelTelemetrySummarySchema = z
  .object({
    generatedAt: z.string().datetime({ offset: true }),
    runIds: z.array(z.string().min(1)),
    totals: ModelTelemetryTotalsSchema,
    entries: z.array(ModelTelemetryEntrySchema),
    byProvider: z.array(ModelTelemetryBucketSchema),
    byModel: z.array(ModelTelemetryBucketSchema),
    byProviderModel: z.array(ModelTelemetryBucketSchema),
    byStep: z.array(ModelTelemetryBucketSchema),
    byUser: z.array(ModelTelemetryBucketSchema),
    byTenant: z.array(ModelTelemetryBucketSchema),
    byPlan: z.array(ModelTelemetryBucketSchema),
  })
  .strict();

export type ModelTelemetrySummary = z.infer<typeof ModelTelemetrySummarySchema>;

export type ModelTelemetrySource =
  | Pick<RunBundle, "run" | "trace">
  | Pick<RunStoreState, "run" | "trace">
  | { run: RunInstance; trace: TraceEvent[] };

export type ModelTelemetryOptions = {
  /**
   * Defaults to response events so request+response pairs do not double-count
   * token usage. Include `stream_chunk` when your provider reports final usage
   * on a terminal stream chunk.
   */
  directions?: readonly ModelTelemetryDirection[];
  /** Test hook for deterministic reports. */
  now?: () => string;
};

type ModelIoTraceEvent = Extract<TraceEvent, { type: "model_io" }>;

const DEFAULT_DIRECTIONS = ["response"] as const satisfies readonly ModelTelemetryDirection[];

function emptyTotals(): ModelTelemetryTotals {
  return {
    eventCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedInputTokens: 0,
    reasoningTokens: 0,
    durationMs: 0,
    costByCurrency: {},
  };
}

function addMetric(current: number, next: number | undefined): number {
  return current + (next ?? 0);
}

/**
 * Derive a single tokens count for a usage record without double-counting.
 *
 * Many providers report `totalTokens` as the canonical number AND emit
 * `inputTokens` + `outputTokens` whose sum equals it. We must not add both.
 * Some legacy / partial events report only one of the two halves; we still
 * want a sensible total then.
 */
function derivedTotalTokens(usage: ModelUsage): number {
  if (usage.totalTokens !== undefined) return usage.totalTokens;
  return (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
}

function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

function roundAmount(value: number): number {
  return Number(value.toFixed(12));
}

function addCost(costByCurrency: Record<string, number>, cost: ModelCost | undefined): void {
  if (!cost) return;
  const currency = normalizeCurrency(cost.currency);
  costByCurrency[currency] = roundAmount((costByCurrency[currency] ?? 0) + cost.amount);
}

function addEntry(totals: ModelTelemetryTotals, entry: ModelTelemetryEntry): void {
  totals.eventCount += 1;
  if (entry.usage) {
    totals.inputTokens = addMetric(totals.inputTokens, entry.usage.inputTokens);
    totals.outputTokens = addMetric(totals.outputTokens, entry.usage.outputTokens);
    totals.totalTokens += derivedTotalTokens(entry.usage);
    totals.cachedInputTokens = addMetric(totals.cachedInputTokens, entry.usage.cachedInputTokens);
    totals.reasoningTokens = addMetric(totals.reasoningTokens, entry.usage.reasoningTokens);
  }
  totals.durationMs = addMetric(totals.durationMs, entry.durationMs);
  addCost(totals.costByCurrency, entry.cost);
}

function isModelIo(event: TraceEvent): event is ModelIoTraceEvent {
  return event.type === "model_io";
}

function toEntry(run: RunInstance, event: ModelIoTraceEvent): ModelTelemetryEntry {
  const cost = event.cost
    ? {
        ...event.cost,
        currency: normalizeCurrency(event.cost.currency),
      }
    : undefined;

  return {
    eventId: event.id,
    runId: event.runId,
    ts: event.ts,
    stepId: event.stepId,
    correlationId: event.correlationId,
    direction: event.direction,
    provider: event.provider,
    model: event.model,
    subject: run.subject,
    usage: event.usage,
    cost,
    durationMs: event.durationMs,
  };
}

function isSourceArray(
  source: ModelTelemetrySource | readonly ModelTelemetrySource[],
): source is readonly ModelTelemetrySource[] {
  return Array.isArray(source);
}

function normalizeSources(
  source: ModelTelemetrySource | readonly ModelTelemetrySource[],
): readonly ModelTelemetrySource[] {
  if (isSourceArray(source)) return source;
  return [source];
}

function collectRunIds(sources: readonly ModelTelemetrySource[]): string[] {
  const seen = new Set<string>();
  const runIds: string[] = [];
  for (const source of sources) {
    if (seen.has(source.run.id)) continue;
    seen.add(source.run.id);
    runIds.push(source.run.id);
  }
  return runIds;
}

function bucketEntries(
  entries: readonly ModelTelemetryEntry[],
  keyFor: (entry: ModelTelemetryEntry) => string | undefined,
  labelFor: (entry: ModelTelemetryEntry) => string | undefined,
): ModelTelemetryBucket[] {
  const buckets = new Map<string, ModelTelemetryBucket>();
  for (const entry of entries) {
    const key = keyFor(entry);
    if (!key) continue;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, label: labelFor(entry) ?? key, totals: emptyTotals() };
      buckets.set(key, bucket);
    }
    addEntry(bucket.totals, entry);
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function subjectKey(subject: RunSubjectRef | undefined, field: keyof RunSubjectRef): string | undefined {
  const value = subject?.[field];
  return value ? `${field}:${value}` : undefined;
}

function subjectLabel(subject: RunSubjectRef | undefined, field: keyof RunSubjectRef): string | undefined {
  return subject?.[field];
}

export function summarizeModelTelemetry(
  source: ModelTelemetrySource | readonly ModelTelemetrySource[],
  options?: ModelTelemetryOptions,
): ModelTelemetrySummary {
  const sources = normalizeSources(source);
  const directions = new Set(options?.directions ?? DEFAULT_DIRECTIONS);
  const entries: ModelTelemetryEntry[] = [];

  for (const item of sources) {
    for (const event of item.trace) {
      if (!isModelIo(event) || !directions.has(event.direction)) continue;
      entries.push(toEntry(item.run, event));
    }
  }

  const totals = emptyTotals();
  for (const entry of entries) addEntry(totals, entry);

  return ModelTelemetrySummarySchema.parse({
    generatedAt: options?.now?.() ?? new Date().toISOString(),
    runIds: collectRunIds(sources),
    totals,
    entries,
    byProvider: bucketEntries(
      entries,
      (entry) => (entry.provider ? `provider:${entry.provider}` : undefined),
      (entry) => entry.provider,
    ),
    byModel: bucketEntries(
      entries,
      (entry) => (entry.model ? `model:${entry.model}` : undefined),
      (entry) => entry.model,
    ),
    byProviderModel: bucketEntries(
      entries,
      (entry) => {
        if (!entry.provider && !entry.model) return undefined;
        return `provider:${entry.provider ?? "unknown"}|model:${entry.model ?? "unknown"}`;
      },
      (entry) => `${entry.provider ?? "unknown"} / ${entry.model ?? "unknown"}`,
    ),
    byStep: bucketEntries(
      entries,
      (entry) => (entry.stepId ? `step:${entry.stepId}` : undefined),
      (entry) => entry.stepId,
    ),
    byUser: bucketEntries(
      entries,
      (entry) => subjectKey(entry.subject, "userId"),
      (entry) => subjectLabel(entry.subject, "userId"),
    ),
    byTenant: bucketEntries(
      entries,
      (entry) => subjectKey(entry.subject, "tenantId"),
      (entry) => subjectLabel(entry.subject, "tenantId"),
    ),
    byPlan: bucketEntries(
      entries,
      (entry) => subjectKey(entry.subject, "planId"),
      (entry) => subjectLabel(entry.subject, "planId"),
    ),
  });
}
