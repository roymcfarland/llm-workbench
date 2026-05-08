import type { Operation } from "fast-json-patch";
import type { ArtifactVersion } from "../protocol/artifacts.js";
import type { RuleSet } from "../protocol/rules.js";
import type { RunBundle } from "../protocol/run.js";
import type { ModelCost, ModelUsage, TraceEvent } from "../protocol/trace.js";
import type { SchemaRegistry } from "../schema/registry.js";
import type { ArtifactStore } from "../persistence/artifactStore.js";
import { cloneRunStoreState } from "./state.js";
import type { RunStoreState } from "./types.js";
import { ArtifactController } from "./artifactController.js";
import { GateController } from "./gateController.js";
import { RunLifecycleController } from "./runLifecycleController.js";
import { RuleController } from "./ruleController.js";
import type { SessionContext } from "./sessionContext.js";
import { StepController } from "./stepController.js";
import { TraceController } from "./traceController.js";

export type SpanHandle = {
  readonly spanId: string;
  end(opts?: {
    status?: "ok" | "error";
    attributes?: Record<string, unknown>;
    error?: { message: string; code?: string };
  }): void;
};

export type ExportRunBundleOptions = {
  profile?: "full" | "user";
  registry?: SchemaRegistry;
  includeEngine?: boolean;
};

type CanStart = ReturnType<typeof import("./readiness.js").canStartStep>;

export type RunTerminalStatus = "completed" | "failed" | "cancelled";

export class WorkbenchSession {
  private readonly lifecycle: RunLifecycleController;
  private readonly gates: GateController;
  private readonly steps: StepController;
  private readonly artifacts: ArtifactController;
  private readonly trace: TraceController;
  private readonly rules: RuleController;

  constructor(
    private readonly ctx: {
      protocolVersion: string;
      state: RunStoreState;
      appendTrace: (e: TraceEvent) => void;
      newEventId: () => string;
      nowIso: () => string;
      canStartStep: (stepId: string) => CanStart;
      /** Optional external byte store for large artifact payloads. */
      artifactStore?: ArtifactStore;
      /** Threshold above which `writeArtifactAsync` externalizes payloads. */
      artifactExternalizationThresholdBytes?: number;
    },
  ) {
    const sessionContext: SessionContext = ctx;
    this.lifecycle = new RunLifecycleController(sessionContext);
    this.gates = new GateController(sessionContext, this.lifecycle);
    this.steps = new StepController(sessionContext, this.lifecycle, this.gates);
    this.artifacts = new ArtifactController(sessionContext, this.lifecycle);
    this.trace = new TraceController(sessionContext, this.lifecycle);
    this.rules = new RuleController(sessionContext, this.lifecycle);
  }

  get runId() {
    return this.ctx.state.run.id;
  }

  snapshot(): RunStoreState {
    return cloneRunStoreState(this.ctx.state);
  }

  completeRun(input?: { reason?: string }): void {
    this.lifecycle.completeRun(input);
  }

  failRun(error: { message: string; code?: string }): void {
    this.lifecycle.failRun(error);
  }

  cancelRun(input?: { reason?: string }): void {
    this.lifecycle.cancelRun(input);
  }

  exportRunBundle(opts?: ExportRunBundleOptions): Promise<RunBundle> {
    return this.lifecycle.exportRunBundle(opts);
  }

  requestGate(input: { stepId: string; gate: "PAUSE_BEFORE" | "PAUSE_AFTER" | "CHECKPOINT"; reason?: string }): void {
    this.gates.requestGate(input);
  }

  resolveGate(input: { stepId: string; gate: "PAUSE_BEFORE" | "PAUSE_AFTER" | "CHECKPOINT"; decision: "approved" | "rejected" | "edited"; note?: string }): void {
    this.gates.resolveGate(input);
  }

  resolveCheckpoint(input: { stepId: string; checkpointId: string; decision: "approved" | "rejected" }): void {
    this.gates.resolveCheckpoint(input);
  }

  assertCanStartStep(stepId: string): void {
    this.steps.assertCanStartStep(stepId);
  }

  beginStep(stepId: string): { ok: false; reason: import("./types.js").BlockReason } | { ok: true } {
    return this.steps.beginStep(stepId);
  }

  completeStep(stepId: string): void {
    this.steps.completeStep(stepId);
  }

  failStep(stepId: string, error: { message: string; code?: string }, options?: { failFast?: boolean }): void {
    this.steps.failStep(stepId, error, options);
  }

  writeArtifact(input: { artifactKey: string; typeId: string; data: unknown; idempotencyKey?: string; pointer?: ArtifactVersion["pointer"] }): ArtifactVersion {
    return this.artifacts.writeArtifact(input);
  }

  writeArtifactAsync(input: { artifactKey: string; typeId: string; data: unknown; idempotencyKey?: string; contentType?: string; routing?: "auto" | "inline" | "external" }): Promise<ArtifactVersion> {
    return this.artifacts.writeArtifactAsync(input);
  }

  materializeArtifact(artifactKey: string, opts?: { signal?: AbortSignal }): Promise<unknown> {
    return this.artifacts.materializeArtifact(artifactKey, opts);
  }

  patchArtifact(input: { artifactKey: string; patch: Operation[]; idempotencyKey?: string }): ArtifactVersion {
    return this.artifacts.patchArtifact(input);
  }

  logModelIO(input: {
    stepId?: string;
    direction: "request" | "response" | "stream_chunk";
    provider?: string;
    model?: string;
    usage?: ModelUsage;
    cost?: ModelCost;
    durationMs?: number;
    summary?: string;
    payload?: unknown;
    correlationId?: string;
    detail?: "full" | "summary";
  }): void {
    this.trace.logModelIO(input);
  }

  beginSpan(input: {
    name: string;
    parentSpanId?: string;
    kind?: "internal" | "client" | "server" | "producer" | "consumer";
    attributes?: Record<string, unknown>;
    stepId?: string;
    correlationId?: string;
  }): SpanHandle {
    return this.trace.beginSpan(input);
  }

  span<T>(
    name: string,
    fn: (handle: SpanHandle) => Promise<T> | T,
    opts?: {
      parentSpanId?: string;
      kind?: "internal" | "client" | "server" | "producer" | "consumer";
      attributes?: Record<string, unknown>;
      stepId?: string;
      correlationId?: string;
    },
  ): Promise<T> {
    return this.trace.span(name, fn, opts);
  }

  logToolCall(input: { stepId?: string; name: string; args?: unknown; result?: unknown; correlationId?: string }): void {
    this.trace.logToolCall(input);
  }

  replaceRuleSet(ruleSet: RuleSet): void {
    this.rules.replaceRuleSet(ruleSet);
  }

  reorderRules(input: { ruleSetId: string; orderedRuleIds: string[] }): void {
    this.rules.reorderRules(input);
  }

  annotate(input: { text: string; tags?: string[] }): void {
    this.rules.annotate(input);
  }

  forkNotice(parentRunId: string, forkedFromStepId?: string): void {
    this.rules.forkNotice(parentRunId, forkedFromStepId);
  }
}
