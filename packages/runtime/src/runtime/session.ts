import { applyPatch, type Operation } from "fast-json-patch";
import { WorkbenchError } from "../errors.js";
import type { ArtifactPointer, ArtifactVersion } from "../protocol/artifacts.js";
import { getArtifactPayloadHash } from "../protocol/artifacts.js";
import type { RuleSet } from "../protocol/rules.js";
import type { JsonPatchOp, ModelCost, ModelUsage, TraceEvent } from "../protocol/trace.js";
import type { RunBundle } from "../protocol/run.js";
import { RunBundleSchema } from "../protocol/run.js";
import { attachRunBundleIntegrity } from "../protocol/bundle.js";
import type { SchemaRegistry } from "../schema/registry.js";
import { buildUserExportBundle } from "../export/userBundle.js";
import { serializeEngineFromState } from "./hydrate.js";
import { cloneRunStoreState } from "./state.js";
import type { RunStoreState } from "./types.js";
import {
  encodeArtifactPayloadBytes,
  sha256Hex,
  type ArtifactStore,
} from "../persistence/artifactStore.js";

/**
 * Returned by {@link WorkbenchSession.beginSpan}. Call `end()` to emit the
 * matching `span_ended` event. Idempotent: calling `end()` more than once is
 * a no-op so adapters can safely close from both happy and error paths.
 */
export type SpanHandle = {
  readonly spanId: string;
  end(opts?: {
    status?: "ok" | "error";
    attributes?: Record<string, unknown>;
    error?: { message: string; code?: string };
  }): void;
};

export type ExportRunBundleOptions = {
  /** `full` includes engine snapshot for faithful rehydration. `user` redacts sensitive fields and strips payloads from trace. */
  profile?: "full" | "user";
  /** Required when `profile` is `"user"`. */
  registry?: SchemaRegistry;
  /** Overrides default engine inclusion (defaults: true for `full`, false for `user`). */
  includeEngine?: boolean;
};

type CanStart = ReturnType<
  typeof import("./readiness.js").canStartStep
>;

/** Terminal run states managed by `WorkbenchSession` lifecycle helpers. */
export type RunTerminalStatus = "completed" | "failed" | "cancelled";

export class WorkbenchSession {
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
  ) {}

  get runId() {
    return this.ctx.state.run.id;
  }

  snapshot(): RunStoreState {
    return cloneRunStoreState(this.ctx.state);
  }

  private assertRunActive(action: string): void {
    const status = this.ctx.state.run.status;
    if (status !== "running") {
      throw new WorkbenchError(
        "INVALID_STATE_TRANSITION",
        `Cannot ${action}: run ${this.runId} is ${status}`,
      );
    }
  }

  private transitionRun(
    status: RunTerminalStatus,
    input?: { reason?: string; error?: { message: string; code?: string } },
  ): void {
    this.assertRunActive(`mark run as ${status}`);
    const runningSteps = [...this.ctx.state.stepStatus.entries()]
      .filter(([, stepStatus]) => stepStatus === "running")
      .map(([stepId]) => stepId);
    if (runningSteps.length) {
      throw new WorkbenchError(
        "INVALID_STATE_TRANSITION",
        `Cannot mark run as ${status}: running steps remain (${runningSteps.join(", ")})`,
      );
    }

    const endedAt = this.ctx.nowIso();
    this.ctx.state.run = {
      ...this.ctx.state.run,
      status,
      endedAt,
    };
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "run_status_changed",
      runId: this.runId,
      ts: endedAt,
      status,
      reason: input?.reason ?? input?.error?.message,
    });
    if (input?.error) {
      this.ctx.appendTrace({
        id: this.ctx.newEventId(),
        type: "error",
        runId: this.runId,
        ts: endedAt,
        message: input.error.message,
        code: input.error.code,
        fatal: true,
      });
    }
  }

  /** Mark the run completed and stamp `run.endedAt`; rejects while any step is still running. */
  completeRun(input?: { reason?: string }): void {
    this.transitionRun("completed", input);
  }

  /** Mark the run failed, append a fatal error trace event, and stamp `run.endedAt`. */
  failRun(error: { message: string; code?: string }): void {
    this.transitionRun("failed", { error });
  }

  /** Mark the run cancelled and stamp `run.endedAt`; rejects while any step is still running. */
  cancelRun(input?: { reason?: string }): void {
    this.transitionRun("cancelled", input);
  }

  async exportRunBundle(opts?: ExportRunBundleOptions): Promise<RunBundle> {
    const s = this.ctx.state;
    const profile = opts?.profile ?? "full";
    const includeEngine = opts?.includeEngine ?? (profile === "full");

    const bundle: RunBundle = {
      protocolVersion: this.ctx.protocolVersion as RunBundle["protocolVersion"],
      run: s.run,
      trace: [...s.trace],
      artifacts: [...s.artifactsByKey.values()].sort((a, b) =>
        a.artifactKey.localeCompare(b.artifactKey),
      ),
      ruleSets: [...s.ruleSetsById.values()].sort((a, b) => a.id.localeCompare(b.id)),
      engine: includeEngine ? serializeEngineFromState(s) : undefined,
    };

    let next = bundle;
    if (profile === "user") {
      if (!opts?.registry) {
        throw new WorkbenchError("INVALID_INPUT", 'exportRunBundle({ profile: "user" }) requires `registry`');
      }
      next = buildUserExportBundle(RunBundleSchema.parse(bundle), opts.registry);
    }

    const validated = RunBundleSchema.parse(next);
    return attachRunBundleIntegrity(validated);
  }

  requestGate(input: { stepId: string; gate: "PAUSE_BEFORE" | "PAUSE_AFTER" | "CHECKPOINT"; reason?: string }) {
    this.assertRunActive("request gate");
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "human_gate_requested",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId: input.stepId,
      gate: input.gate,
      reason: input.reason,
    });
  }

  resolveGate(input: {
    stepId: string;
    gate: "PAUSE_BEFORE" | "PAUSE_AFTER" | "CHECKPOINT";
    decision: "approved" | "rejected" | "edited";
    note?: string;
  }) {
    this.assertRunActive("resolve gate");
    const gs = this.ctx.state.gateState.get(input.stepId);
    if (!gs) throw new WorkbenchError("UNKNOWN_STEP", `Unknown step: ${input.stepId}`);

    const approved = input.decision !== "rejected";
    if (input.gate === "PAUSE_BEFORE") gs.before = approved ? "approved" : "pending";
    if (input.gate === "PAUSE_AFTER") gs.after = approved ? "approved" : "pending";
    if (input.gate === "CHECKPOINT") {
      // Generic CHECKPOINT approval: allow host to use resolveCheckpoint for finer control
      if (approved) gs.before = "approved";
    }

    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "human_gate_resolved",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId: input.stepId,
      gate: input.gate,
      decision: input.decision,
      note: input.note,
    });
  }

  resolveCheckpoint(input: { stepId: string; checkpointId: string; decision: "approved" | "rejected" }) {
    this.assertRunActive("resolve checkpoint");
    const gs = this.ctx.state.gateState.get(input.stepId);
    if (!gs) throw new WorkbenchError("UNKNOWN_STEP", `Unknown step: ${input.stepId}`);
    gs.checkpoints[input.checkpointId] = input.decision === "rejected" ? "pending" : "approved";
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "human_gate_resolved",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId: input.stepId,
      gate: "CHECKPOINT",
      decision: input.decision === "rejected" ? "rejected" : "approved",
      note: input.checkpointId,
    });
  }

  assertCanStartStep(stepId: string) {
    const res = this.ctx.canStartStep(stepId);
    if (!res.ok) {
      throw new WorkbenchError(
        "INVALID_STATE_TRANSITION",
        `Cannot start step ${stepId}: ${JSON.stringify(res.reason)}`,
      );
    }
  }

  beginStep(stepId: string) {
    this.assertRunActive("begin step");
    const res = this.ctx.canStartStep(stepId);
    if (!res.ok) return res;

    this.ctx.state.stepStatus.set(stepId, "running");
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "step_started",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId,
    });
    return { ok: true as const };
  }

  completeStep(stepId: string) {
    this.assertRunActive("complete step");
    const spec = this.ctx.state.run.workflowSnapshot;
    const step = spec.steps.find((s) => s.id === stepId);
    if (!step) throw new WorkbenchError("UNKNOWN_STEP", `Unknown step: ${stepId}`);

    const st = this.ctx.state.stepStatus.get(stepId);
    if (st !== "running") {
      throw new WorkbenchError(
        "INVALID_STATE_TRANSITION",
        `Cannot complete step ${stepId}: expected status "running", got "${st ?? "missing"}"`,
      );
    }

    this.ctx.state.stepStatus.set(stepId, "completed");
    const gs = this.ctx.state.gateState.get(stepId);
    if (gs && (step.gatePolicy === "PAUSE_AFTER" || step.gatePolicy === "CHECKPOINT")) {
      gs.after = "pending";
      this.requestGate({ stepId, gate: "PAUSE_AFTER", reason: "Review outputs before downstream steps proceed" });
    }

    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "step_completed",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId,
      ok: true,
    });
  }

  /**
   * Mark a step as failed.
   *
   * By default this only fails the step — the run itself stays `running`,
   * which is the right behaviour when a step's failure is recoverable (the
   * host may retry, route to a fallback step, or wait for human review).
   *
   * Pass `{ failFast: true }` to also transition the run to `failed`. This is
   * the right default for hosts that don't model recovery and want a single
   * step error to terminate the run with a single trace event.
   */
  failStep(
    stepId: string,
    error: { message: string; code?: string },
    options?: { failFast?: boolean },
  ) {
    this.assertRunActive("fail step");
    const st = this.ctx.state.stepStatus.get(stepId);
    if (st === "completed" || st === "failed") {
      throw new WorkbenchError(
        "INVALID_STATE_TRANSITION",
        `Cannot fail step ${stepId}: terminal status "${st}"`,
      );
    }

    const failFast = options?.failFast ?? false;

    this.ctx.state.stepStatus.set(stepId, "failed");
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "step_completed",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId,
      ok: false,
      error: { message: error.message, code: error.code },
    });
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "error",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId,
      message: error.message,
      code: error.code,
      fatal: failFast,
    });
    if (failFast) {
      this.transitionRun("failed", { error });
    }
  }

  writeArtifact(input: {
    artifactKey: string;
    typeId: string;
    data: unknown;
    idempotencyKey?: string;
    pointer?: ArtifactVersion["pointer"];
  }): ArtifactVersion {
    this.assertRunActive("write artifact");
    if (!input.artifactKey.trim()) {
      throw new WorkbenchError("INVALID_INPUT", "artifactKey must be a non-empty string");
    }
    if (!input.typeId.trim()) {
      throw new WorkbenchError("INVALID_INPUT", "typeId must be a non-empty string");
    }

    if (input.idempotencyKey) {
      const prev = this.ctx.state.idempotency.get(input.idempotencyKey);
      if (prev) {
        if (prev.artifactKey !== input.artifactKey) {
          throw new WorkbenchError(
            "IDEMPOTENCY_CONFLICT",
            `Idempotency key "${input.idempotencyKey}" was already used for artifact "${prev.artifactKey}"`,
          );
        }
        const art = this.ctx.state.artifactsByKey.get(input.artifactKey);
        if (art && art.version === prev.version) return art;
        throw new WorkbenchError(
          "IDEMPOTENCY_CONFLICT",
          `Idempotency key "${input.idempotencyKey}" is stale (artifact "${input.artifactKey}" is now version ${art?.version ?? "missing"})`,
        );
      }
    }

    const prev = this.ctx.state.artifactsByKey.get(input.artifactKey);
    const version = (prev?.version ?? 0) + 1;
    const artifact: ArtifactVersion = {
      artifactKey: input.artifactKey,
      typeId: input.typeId,
      version,
      createdAt: this.ctx.nowIso(),
      data: input.data,
      pointer: input.pointer,
    };
    this.ctx.state.artifactsByKey.set(input.artifactKey, artifact);
    if (input.idempotencyKey) {
      this.ctx.state.idempotency.set(input.idempotencyKey, { artifactKey: input.artifactKey, version });
    }
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "artifact_written",
      runId: this.runId,
      ts: artifact.createdAt,
      artifact,
      idempotencyKey: input.idempotencyKey,
    });
    return artifact;
  }

  /**
   * Storage-aware artifact write. Hashes and measures the canonical-JSON
   * encoding of `data`, then routes the bytes based on the runtime's
   * configuration:
   *
   * - When the runtime has an {@link ArtifactStore} **and** the encoded
   *   payload is at least the configured externalization threshold, the
   *   bytes are uploaded to the store and the persisted `ArtifactVersion`
   *   carries `pointer.kind === "external"` with `payloadHash`,
   *   `byteLength`, and the store's opaque `ref`. `data` is stripped from
   *   the in-memory state (callers can re-fetch via
   *   {@link materializeArtifact}).
   * - Otherwise the artifact is written inline, identical to
   *   {@link writeArtifact}, with `payloadHash` and `byteLength` populated
   *   on the pointer so future readers can verify integrity without
   *   re-encoding.
   *
   * Same idempotency semantics as `writeArtifact`.
   */
  async writeArtifactAsync(input: {
    artifactKey: string;
    typeId: string;
    data: unknown;
    idempotencyKey?: string;
    contentType?: string;
    /**
     * Force a routing decision. `"auto"` (default) consults the threshold;
     * `"inline"` keeps the bytes in `data`; `"external"` always uploads
     * and requires `artifactStore` to be configured.
     */
    routing?: "auto" | "inline" | "external";
  }): Promise<ArtifactVersion> {
    this.assertRunActive("write artifact");
    if (!input.artifactKey.trim()) {
      throw new WorkbenchError("INVALID_INPUT", "artifactKey must be a non-empty string");
    }
    if (!input.typeId.trim()) {
      throw new WorkbenchError("INVALID_INPUT", "typeId must be a non-empty string");
    }

    if (input.idempotencyKey) {
      const prev = this.ctx.state.idempotency.get(input.idempotencyKey);
      if (prev) {
        if (prev.artifactKey !== input.artifactKey) {
          throw new WorkbenchError(
            "IDEMPOTENCY_CONFLICT",
            `Idempotency key "${input.idempotencyKey}" was already used for artifact "${prev.artifactKey}"`,
          );
        }
        const art = this.ctx.state.artifactsByKey.get(input.artifactKey);
        if (art && art.version === prev.version) return art;
        throw new WorkbenchError(
          "IDEMPOTENCY_CONFLICT",
          `Idempotency key "${input.idempotencyKey}" is stale (artifact "${input.artifactKey}" is now version ${art?.version ?? "missing"})`,
        );
      }
    }

    const payload = encodeArtifactPayloadBytes(input.data);
    const payloadHash = await sha256Hex(payload);
    const byteLength = payload.byteLength;
    const threshold = this.ctx.artifactExternalizationThresholdBytes ?? Infinity;
    const routing = input.routing ?? "auto";

    let pointer: ArtifactPointer;
    let storedData: unknown;
    if (
      routing === "external" ||
      (routing === "auto" && this.ctx.artifactStore && byteLength >= threshold)
    ) {
      if (!this.ctx.artifactStore) {
        throw new WorkbenchError(
          "INVALID_INPUT",
          'writeArtifactAsync({ routing: "external" }) requires an artifactStore on the runtime',
        );
      }
      const prevVersion = this.ctx.state.artifactsByKey.get(input.artifactKey)?.version ?? 0;
      const result = await this.ctx.artifactStore.put({
        runId: this.runId,
        artifactKey: input.artifactKey,
        version: prevVersion + 1,
        payload,
        payloadHash,
        contentType: input.contentType,
      });
      if (result.payloadHash !== payloadHash) {
        throw new WorkbenchError(
          "INTEGRITY_MISMATCH",
          `ArtifactStore.put returned mismatched payloadHash (expected ${payloadHash}, got ${result.payloadHash})`,
        );
      }
      pointer = {
        kind: "external",
        ref: result.ref,
        payloadHash,
        byteLength,
      };
      storedData = undefined;
    } else {
      pointer = { kind: "inline", payloadHash, byteLength };
      storedData = input.data;
    }

    const prev = this.ctx.state.artifactsByKey.get(input.artifactKey);
    const version = (prev?.version ?? 0) + 1;
    const artifact: ArtifactVersion = {
      artifactKey: input.artifactKey,
      typeId: input.typeId,
      version,
      createdAt: this.ctx.nowIso(),
      data: storedData,
      pointer,
    };
    this.ctx.state.artifactsByKey.set(input.artifactKey, artifact);
    if (input.idempotencyKey) {
      this.ctx.state.idempotency.set(input.idempotencyKey, { artifactKey: input.artifactKey, version });
    }
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "artifact_written",
      runId: this.runId,
      ts: artifact.createdAt,
      artifact,
      idempotencyKey: input.idempotencyKey,
    });
    return artifact;
  }

  /**
   * Resolve an artifact's payload regardless of whether it lives inline or
   * in the configured {@link ArtifactStore}. For inline artifacts this is
   * just `artifact.data`; for external pointers it fetches via the store
   * and verifies the returned `payloadHash` matches the pointer.
   *
   * Throws when the artifact is external but no `artifactStore` is
   * configured, when the store cannot find the ref, or when the returned
   * bytes hash to a different value than the pointer claims.
   */
  async materializeArtifact(artifactKey: string, opts?: { signal?: AbortSignal }): Promise<unknown> {
    const art = this.ctx.state.artifactsByKey.get(artifactKey);
    if (!art) throw new WorkbenchError("UNKNOWN_ARTIFACT", `Unknown artifactKey: ${artifactKey}`);
    if (!art.pointer || art.pointer.kind === "inline") return art.data;
    if (!this.ctx.artifactStore) {
      throw new WorkbenchError(
        "INVALID_STATE_TRANSITION",
        `Artifact "${artifactKey}" is external but no artifactStore is configured on this runtime`,
      );
    }
    if (!art.pointer.ref) {
      throw new WorkbenchError(
        "INVALID_RUN_STATE",
        `External artifact "${artifactKey}" has no pointer.ref`,
      );
    }
    const fetched = await this.ctx.artifactStore.get(
      { runId: this.runId, ref: art.pointer.ref },
      opts,
    );
    const expected = getArtifactPayloadHash(art.pointer);
    if (expected && fetched.payloadHash !== expected) {
      throw new WorkbenchError(
        "INTEGRITY_MISMATCH",
        `External artifact "${artifactKey}" payloadHash mismatch (expected ${expected}, got ${fetched.payloadHash})`,
      );
    }
    const text = new TextDecoder().decode(fetched.payload);
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new WorkbenchError(
        "INVALID_JSON",
        `External artifact "${artifactKey}" is not valid JSON`,
        e,
      );
    }
  }

  patchArtifact(input: { artifactKey: string; patch: Operation[]; idempotencyKey?: string }): ArtifactVersion {
    this.assertRunActive("patch artifact");
    if (!input.artifactKey.trim()) {
      throw new WorkbenchError("INVALID_INPUT", "artifactKey must be a non-empty string");
    }

    if (input.idempotencyKey) {
      const prevKey = this.ctx.state.idempotency.get(input.idempotencyKey);
      if (prevKey) {
        if (prevKey.artifactKey !== input.artifactKey) {
          throw new WorkbenchError(
            "IDEMPOTENCY_CONFLICT",
            `Idempotency key "${input.idempotencyKey}" was already used for artifact "${prevKey.artifactKey}"`,
          );
        }
        const art = this.ctx.state.artifactsByKey.get(input.artifactKey);
        if (art && art.version === prevKey.version) return art;
        throw new WorkbenchError(
          "IDEMPOTENCY_CONFLICT",
          `Idempotency key "${input.idempotencyKey}" is stale (artifact "${input.artifactKey}" is now version ${art?.version ?? "missing"})`,
        );
      }
    }

    const prev = this.ctx.state.artifactsByKey.get(input.artifactKey);
    if (!prev) throw new WorkbenchError("UNKNOWN_ARTIFACT", `Unknown artifactKey: ${input.artifactKey}`);
    const clone = structuredClone(prev.data ?? {});
    let nextData: unknown;
    try {
      nextData = applyPatch(clone, input.patch, true, false).newDocument;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new WorkbenchError("PATCH_FAILED", `JSON Patch failed for "${input.artifactKey}": ${msg}`, e);
    }
    const version = prev.version + 1;
    const artifact: ArtifactVersion = {
      artifactKey: input.artifactKey,
      typeId: prev.typeId,
      version,
      createdAt: this.ctx.nowIso(),
      data: nextData,
      pointer: prev.pointer,
    };
    this.ctx.state.artifactsByKey.set(input.artifactKey, artifact);
    if (input.idempotencyKey) {
      this.ctx.state.idempotency.set(input.idempotencyKey, { artifactKey: input.artifactKey, version });
    }
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "artifact_patch",
      runId: this.runId,
      ts: artifact.createdAt,
      artifactKey: input.artifactKey,
      fromVersion: prev.version,
      toVersion: version,
      patch: input.patch as unknown as JsonPatchOp[],
      idempotencyKey: input.idempotencyKey,
    });
    return artifact;
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
    /**
     * Defaults to `"summary"` which omits `payload` from the trace (encourages using `summary` instead).
     * Use `"full"` to persist payloads for engineering exports.
     */
    detail?: "full" | "summary";
  }) {
    this.assertRunActive("log model I/O");
    const detail = input.detail ?? "summary";
    const payload = detail === "full" ? input.payload : undefined;
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "model_io",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId: input.stepId,
      correlationId: input.correlationId,
      direction: input.direction,
      provider: input.provider,
      model: input.model,
      usage: input.usage,
      cost: input.cost,
      durationMs: input.durationMs,
      summary: input.summary,
      payload,
    });
  }

  /**
   * Open a hierarchical span. Returns a {@link SpanHandle} you must close with
   * `.end({status})`. Prefer {@link span} for structured-call ergonomics —
   * this lower-level form exists for adapters (e.g. AI SDK) that need to span
   * across an async boundary that doesn't fit a `try/finally`.
   */
  beginSpan(input: {
    name: string;
    parentSpanId?: string;
    kind?: "internal" | "client" | "server" | "producer" | "consumer";
    attributes?: Record<string, unknown>;
    stepId?: string;
    correlationId?: string;
  }): SpanHandle {
    this.assertRunActive("begin span");
    const spanId = `span_${(globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)}`;
    const startedAt = performance.now();
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "span_started",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId: input.stepId,
      correlationId: input.correlationId,
      spanId,
      parentSpanId: input.parentSpanId,
      name: input.name,
      kind: input.kind,
      attributes: input.attributes,
    });
    let ended = false;
    const handle: SpanHandle = {
      spanId,
      end: (opts) => {
        if (ended) return;
        ended = true;
        const durationMs = Math.max(0, performance.now() - startedAt);
        this.ctx.appendTrace({
          id: this.ctx.newEventId(),
          type: "span_ended",
          runId: this.runId,
          ts: this.ctx.nowIso(),
          stepId: input.stepId,
          correlationId: input.correlationId,
          spanId,
          status: opts?.status,
          durationMs,
          attributes: opts?.attributes,
          error: opts?.error,
        });
      },
    };
    return handle;
  }

  /**
   * Run `fn` inside a span. Auto-emits `span_started` before, `span_ended`
   * with `status: "ok"` on success, or `status: "error"` (and an `error.*`
   * payload) when `fn` rejects/throws. Always rethrows the original error
   * after the span is closed so the caller's control flow is unchanged.
   */
  async span<T>(
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
    const handle = this.beginSpan({ name, ...opts });
    try {
      const result = await fn(handle);
      handle.end({ status: "ok" });
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const code = e instanceof WorkbenchError ? e.code : undefined;
      handle.end({ status: "error", error: { message, code } });
      throw e;
    }
  }

  logToolCall(input: { stepId?: string; name: string; args?: unknown; result?: unknown; correlationId?: string }) {
    this.assertRunActive("log tool call");
    if (!input.name.trim()) {
      throw new WorkbenchError("INVALID_INPUT", "logToolCall requires a non-empty tool name");
    }
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "tool_call",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      stepId: input.stepId,
      correlationId: input.correlationId,
      name: input.name,
      args: input.args,
      result: input.result,
    });
  }

  replaceRuleSet(ruleSet: RuleSet) {
    this.assertRunActive("replace rule set");
    this.ctx.state.ruleSetsById.set(ruleSet.id, ruleSet);
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "rule_changed",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      ruleSetId: ruleSet.id,
      snapshot: ruleSet,
    });
  }

  reorderRules(input: { ruleSetId: string; orderedRuleIds: string[] }) {
    this.assertRunActive("reorder rules");
    const rs = this.ctx.state.ruleSetsById.get(input.ruleSetId);
    if (!rs) throw new WorkbenchError("UNKNOWN_RULESET", `Unknown ruleSet: ${input.ruleSetId}`);
    if (input.orderedRuleIds.length !== rs.rules.length) {
      throw new WorkbenchError(
        "INVALID_INPUT",
        `reorderRules expected ${rs.rules.length} rule ids, got ${input.orderedRuleIds.length}`,
      );
    }
    if (new Set(input.orderedRuleIds).size !== input.orderedRuleIds.length) {
      throw new WorkbenchError("INVALID_INPUT", "reorderRules rule ids must be unique");
    }
    const byId = new Map(rs.rules.map((r) => [r.id, r] as const));
    const nextRules = input.orderedRuleIds.map((id, idx) => {
      const r = byId.get(id);
      if (!r) throw new WorkbenchError("INVALID_INPUT", `Unknown rule id: ${id}`);
      return { ...r, priority: idx };
    });
    const next: RuleSet = { ...rs, rules: nextRules };
    this.replaceRuleSet(next);
  }

  annotate(input: { text: string; tags?: string[] }) {
    this.assertRunActive("annotate run");
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "annotation",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      text: input.text,
      tags: input.tags,
    });
  }

  forkNotice(parentRunId: string, forkedFromStepId?: string) {
    this.assertRunActive("record fork notice");
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "run_forked",
      runId: this.runId,
      ts: this.ctx.nowIso(),
      parentRunId,
      forkedFromStepId,
    });
  }
}
