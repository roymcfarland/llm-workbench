import { WorkbenchError, formatZodError } from "../errors.js";
import type { ArtifactVersion } from "../protocol/artifacts.js";
import { parseRunBundleJson, verifyRunBundleIntegrity } from "../protocol/bundle.js";
import type { RunBundle, RunContextRef } from "../protocol/run.js";
import { RunBundleSchema, getParentRunIds } from "../protocol/run.js";
import { parseWorkflowSpec } from "../protocol/workflow.js";
import { assertWorkflowStructuralInvariants } from "../protocol/workflowValidate.js";
import { ZodError } from "zod";
import { WORKBENCH_PROTOCOL_VERSION } from "../protocol/version.js";
import type { RuleSet } from "../protocol/rules.js";
import type { TraceEvent } from "../protocol/trace.js";
import { TraceEventSchema } from "../protocol/trace.js";
import { initialGateState } from "./gates.js";
import { runStoreStateFromBundle } from "./hydrate.js";
import { newId } from "./ids.js";
import { canStartStep } from "./readiness.js";
import { assertRunStoreStateStructuralInvariants, cloneRunStoreState } from "./state.js";
import type { Listener, RunStoreState, StartRunInput } from "./types.js";
import { WorkbenchSession } from "./session.js";
import {
  DEFAULT_ARTIFACT_EXTERNALIZATION_THRESHOLD_BYTES,
  type ArtifactStore,
} from "../persistence/artifactStore.js";

export type TraceListenerErrorContext = {
  runId: string;
  event: TraceEvent;
};

/** Called when a trace subscriber throws. Should not rethrow; errors from the hook are logged to `console.error`. */
export type TraceListenerErrorHandler = (error: unknown, ctx: TraceListenerErrorContext) => void;

export type WorkbenchRuntimeOptions = {
  onTraceListenerError?: TraceListenerErrorHandler;
  /**
   * Optional external byte store for large artifact payloads. When set,
   * `WorkbenchSession.writeArtifactAsync` will externalize payloads whose
   * encoded byte length is `>= artifactExternalizationThresholdBytes`.
   * When omitted, every payload stays inline regardless of size.
   */
  artifactStore?: ArtifactStore;
  /**
   * Threshold in bytes for externalizing artifact payloads via
   * `artifactStore`. Defaults to {@link DEFAULT_ARTIFACT_EXTERNALIZATION_THRESHOLD_BYTES}.
   * Has no effect unless `artifactStore` is also configured.
   */
  artifactExternalizationThresholdBytes?: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

export class WorkbenchRuntime {
  private runs = new Map<string, RunStoreState>();
  private listeners = new Map<string, Set<Listener>>();
  private onTraceListenerError?: TraceListenerErrorHandler;
  private artifactStore?: ArtifactStore;
  private artifactExternalizationThresholdBytes: number;

  constructor(options?: WorkbenchRuntimeOptions) {
    this.onTraceListenerError = options?.onTraceListenerError;
    this.artifactStore = options?.artifactStore;
    this.artifactExternalizationThresholdBytes =
      options?.artifactExternalizationThresholdBytes ??
      DEFAULT_ARTIFACT_EXTERNALIZATION_THRESHOLD_BYTES;
  }

  /**
   * Replace the global trace listener error handler (e.g. wire to Sentry after app bootstrap).
   * Pass `undefined` to fall back to the default `console.error` logging only.
   */
  setOnTraceListenerError(handler: TraceListenerErrorHandler | undefined): void {
    this.onTraceListenerError = handler;
  }

  subscribe(runId: string, listener: Listener): () => void {
    let set = this.listeners.get(runId);
    if (!set) {
      set = new Set();
      this.listeners.set(runId, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) this.listeners.delete(runId);
    };
  }

  private emit(runId: string, event: TraceEvent) {
    for (const l of this.listeners.get(runId) ?? []) {
      try {
        l(event);
      } catch (err) {
        if (this.onTraceListenerError) {
          try {
            this.onTraceListenerError(err, { runId, event });
          } catch (hookErr) {
            // eslint-disable-next-line no-console
            console.error("[llm-workbench] onTraceListenerError hook threw", hookErr);
          }
        } else {
          // eslint-disable-next-line no-console
          console.error("[llm-workbench] trace listener error", err);
        }
      }
    }
  }

  private appendTrace(state: RunStoreState, event: TraceEvent) {
    let validated: TraceEvent;
    try {
      validated = TraceEventSchema.parse(event);
    } catch (e) {
      if (e instanceof ZodError) {
        throw new WorkbenchError("INVALID_TRACE_EVENT", `Invalid trace event: ${formatZodError(e)}`, e);
      }
      throw e;
    }
    state.revision += 1;
    state.trace.push(validated);
    this.emit(state.run.id, validated);
  }

  startRun(input: StartRunInput): { runId: string } {
    const runId = newId("run");
    if (this.runs.has(runId)) {
      throw new WorkbenchError(
        "RUN_ID_COLLISION",
        `Generated runId ${runId} already exists in this runtime; refusing to overwrite.`,
      );
    }
    const startedAt = nowIso();
    let workflowSnapshot;
    try {
      workflowSnapshot = parseWorkflowSpec(input.workflow);
      assertWorkflowStructuralInvariants(workflowSnapshot);
    } catch (e) {
      if (WorkbenchError.is(e)) throw e;
      if (e instanceof ZodError) {
        throw new WorkbenchError("INVALID_WORKFLOW", `Invalid workflow: ${formatZodError(e)}`, e);
      }
      throw e;
    }

    const run = {
      id: runId,
      workflowId: workflowSnapshot.id,
      workflowVersion: workflowSnapshot.version,
      workflowSnapshot,
      startedAt,
      status: "running" as const,
      context: input.context,
      subject: input.subject,
      metadata: input.metadata,
      tags: input.tags,
    };

    const stepStatus = new Map<string, "pending" | "running" | "completed" | "failed">();
    const gateState = new Map<string, ReturnType<typeof initialGateState>>();
    for (const s of workflowSnapshot.steps) {
      stepStatus.set(s.id, "pending");
      gateState.set(s.id, initialGateState(s.gatePolicy));
    }

    const artifactsByKey = new Map<string, ArtifactVersion>();
    const ruleSetsById = new Map<string, RuleSet>();

    for (const rs of input.ruleSets ?? []) {
      ruleSetsById.set(rs.id, rs);
    }

    const state: RunStoreState = {
      revision: 0,
      run,
      trace: [],
      artifactsByKey,
      ruleSetsById,
      stepStatus,
      gateState,
      idempotency: new Map(),
    };

    for (const { artifact } of input.initialArtifacts ?? []) {
      const full: ArtifactVersion = {
        ...artifact,
        version: 1,
        createdAt: startedAt,
      };
      artifactsByKey.set(full.artifactKey, full);
      this.appendTrace(state, {
        id: newId("evt"),
        type: "artifact_written",
        runId,
        ts: startedAt,
        artifact: full,
      });
    }

    for (const rs of input.ruleSets ?? []) {
      this.appendTrace(state, {
        id: newId("evt"),
        type: "rule_changed",
        runId,
        ts: startedAt,
        ruleSetId: rs.id,
        snapshot: rs,
      });
    }

    this.runs.set(runId, state);
    return { runId };
  }

  getState(runId: string): RunStoreState | undefined {
    return this.runs.get(runId);
  }

  session(runId: string): WorkbenchSession {
    const state = this.runs.get(runId);
    if (!state) throw new WorkbenchError("UNKNOWN_RUN", `Unknown runId: ${runId}`);
    return new WorkbenchSession({
      protocolVersion: WORKBENCH_PROTOCOL_VERSION,
      state,
      appendTrace: (e) => this.appendTrace(state, e),
      newEventId: () => newId("evt"),
      nowIso,
      canStartStep: (stepId) =>
        canStartStep({
          spec: state.run.workflowSnapshot,
          stepId,
          stepStatus: state.stepStatus,
          gateState: state.gateState,
        }),
      artifactStore: this.artifactStore,
      artifactExternalizationThresholdBytes: this.artifactExternalizationThresholdBytes,
    });
  }

  importState(state: RunStoreState) {
    assertRunStoreStateStructuralInvariants(state);
    this.runs.set(state.run.id, cloneRunStoreState(state));
  }

  /** Returns true if the run was present and removed. */
  deleteRun(runId: string): boolean {
    const had = this.runs.delete(runId);
    this.listeners.delete(runId);
    return had;
  }

  /** Stable iterator over run ids currently held by this runtime. */
  listRuns(): string[] {
    return [...this.runs.keys()];
  }

  /**
   * Returns ids of runs in this runtime whose `RunContextRef` records the
   * given run as a parent (singular `parentRunId` or any entry in plural
   * `parentRunIds`). Useful for agent-of-agents cancellation, debugging
   * supervisor trees, and rendering child-of relationships in UIs.
   *
   * Iteration order is insertion order (the same order as
   * {@link listRuns}), making the result stable for a given runtime state.
   */
  runChildrenOf(parentRunId: string): string[] {
    const out: string[] = [];
    for (const [id, state] of this.runs) {
      if (id === parentRunId) continue;
      const ctx = state.run.context;
      if (!ctx) continue;
      const parents = getParentRunIds(ctx);
      if (parents.includes(parentRunId)) out.push(id);
    }
    return out;
  }

  /**
   * Cancel a run and, transitively, every descendant run held by this
   * runtime. Each cancellation goes through {@link WorkbenchSession.cancelRun}
   * so the standard `run_status_changed` trace event is emitted on every
   * run. Already-terminal runs (`completed`, `failed`, `cancelled`) are
   * skipped.
   *
   * Returns the ids that were actually transitioned to `cancelled`, in the
   * order they were processed (root first, then breadth-first descendants).
   */
  cancelRunCascade(rootRunId: string, opts?: { reason?: string }): string[] {
    const visited = new Set<string>();
    const cancelled: string[] = [];
    const queue: string[] = [rootRunId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const state = this.runs.get(id);
      if (!state) continue;
      if (state.run.status === "running") {
        try {
          this.session(id).cancelRun(opts);
          cancelled.push(id);
        } catch {
          // If a session refuses to cancel (e.g. a step is still running),
          // we propagate the cascade to the rest of the tree but skip this
          // node. The host can retry per-node cancellation if needed.
        }
      }
      for (const childId of this.runChildrenOf(id)) {
        if (!visited.has(childId)) queue.push(childId);
      }
    }
    return cancelled;
  }

  /**
   * Imports a `RunBundle` into this runtime (overwrites if `run.id` already exists).
   * When `engine` is missing, gate/step state is inferred from the trace (best-effort).
   */
  async importRunBundle(
    input: { json: string; verifyIntegrity?: boolean } | { bundle: RunBundle; verifyIntegrity?: boolean },
  ): Promise<{ runId: string }> {
    const verifyIntegrity = input.verifyIntegrity ?? true;
    const bundle =
      "json" in input
        ? parseRunBundleJson(input.json)
        : (() => {
            const r = RunBundleSchema.safeParse(input.bundle);
            if (!r.success) {
              throw new WorkbenchError("INVALID_RUN_BUNDLE", `Invalid run bundle: ${formatZodError(r.error)}`, r.error);
            }
            return r.data;
          })();
    if (verifyIntegrity) {
      if (!bundle.integrity?.sha256) {
        throw new WorkbenchError(
          "MISSING_INTEGRITY",
          "Run bundle has no integrity signature; pass verifyIntegrity:false only if you trust this source.",
        );
      }
      if (!(await verifyRunBundleIntegrity(bundle))) {
        throw new WorkbenchError("INTEGRITY_MISMATCH", "Run bundle integrity hash does not match contents");
      }
    }
    const state = runStoreStateFromBundle(bundle);
    this.importState(state);
    return { runId: state.run.id };
  }
}
