import { applyPatch, type Operation } from "fast-json-patch";
import { WorkbenchError } from "../errors.js";
import type { ArtifactVersion } from "../protocol/artifacts.js";
import type { RuleSet } from "../protocol/rules.js";
import type { TraceEvent } from "../protocol/trace.js";
import type { RunBundle } from "../protocol/run.js";
import { RunBundleSchema } from "../protocol/run.js";
import { attachRunBundleIntegrity } from "../protocol/bundle.js";
import type { SchemaRegistry } from "../schema/registry.js";
import { buildUserExportBundle } from "../export/userBundle.js";
import { serializeEngineFromState } from "./hydrate.js";
import type { RunStoreState } from "./types.js";
import { newId } from "./ids.js";

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

export class WorkbenchSession {
  constructor(
    private readonly ctx: {
      protocolVersion: string;
      state: RunStoreState;
      appendTrace: (e: TraceEvent) => void;
      newEventId: () => string;
      nowIso: () => string;
      canStartStep: (stepId: string) => CanStart;
    },
  ) {}

  get runId() {
    return this.ctx.state.run.id;
  }

  snapshot(): RunStoreState {
    // shallow copy maps for safety
    const s = this.ctx.state;
    return {
      ...s,
      revision: s.revision,
      artifactsByKey: new Map(s.artifactsByKey),
      ruleSetsById: new Map(s.ruleSetsById),
      stepStatus: new Map(s.stepStatus),
      gateState: new Map(s.gateState),
      idempotency: new Map(s.idempotency),
      trace: [...s.trace],
    };
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

  failStep(stepId: string, error: { message: string; code?: string }) {
    const st = this.ctx.state.stepStatus.get(stepId);
    if (st === "completed" || st === "failed") {
      throw new WorkbenchError(
        "INVALID_STATE_TRANSITION",
        `Cannot fail step ${stepId}: terminal status "${st}"`,
      );
    }

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
      fatal: false,
    });
  }

  writeArtifact(input: {
    artifactKey: string;
    typeId: string;
    data: unknown;
    idempotencyKey?: string;
    pointer?: ArtifactVersion["pointer"];
  }): ArtifactVersion {
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

  patchArtifact(input: { artifactKey: string; patch: Operation[]; idempotencyKey?: string }): ArtifactVersion {
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
      patch: input.patch as unknown[],
      idempotencyKey: input.idempotencyKey,
    });
    return artifact;
  }

  logModelIO(input: {
    stepId?: string;
    direction: "request" | "response" | "stream_chunk";
    summary?: string;
    payload?: unknown;
    correlationId?: string;
    /**
     * Defaults to `"summary"` which omits `payload` from the trace (encourages using `summary` instead).
     * Use `"full"` to persist payloads for engineering exports.
     */
    detail?: "full" | "summary";
  }) {
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
      summary: input.summary,
      payload,
    });
  }

  logToolCall(input: { stepId?: string; name: string; args?: unknown; result?: unknown; correlationId?: string }) {
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
