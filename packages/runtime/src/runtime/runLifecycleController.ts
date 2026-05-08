import { WorkbenchError } from "../errors.js";
import { buildUserExportBundle } from "../export/userBundle.js";
import { attachRunBundleIntegrity } from "../protocol/bundle.js";
import type { RunBundle } from "../protocol/run.js";
import { RunBundleSchema } from "../protocol/run.js";
import { serializeEngineFromState } from "./hydrate.js";
import type { ExportRunBundleOptions, RunTerminalStatus } from "./session.js";
import type { SessionContext } from "./sessionContext.js";

export class RunLifecycleController {
  constructor(private readonly ctx: SessionContext) {}

  private get runId() {
    return this.ctx.state.run.id;
  }

  /**
   * Inter-controller contract: this method is intentionally `public` so sibling
   * controllers (`GateController`, `StepController`, `ArtifactController`,
   * `TraceController`, `RuleController`) can gate their writes on the run
   * being active. It is **not** part of the public `WorkbenchSession` surface
   * — external callers reach the run-active gate transparently through any
   * facade method (e.g., `requestGate`, `beginStep`, `writeArtifact`). Do not
   * call this method from outside `packages/runtime/src/runtime/`.
   *
   * @internal
   */
  assertRunActive(action: string): void {
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

  completeRun(input?: { reason?: string }): void {
    this.transitionRun("completed", input);
  }

  failRun(error: { message: string; code?: string }): void {
    this.transitionRun("failed", { error });
  }

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
      ruleSets: [...s.ruleSetsById.values()].sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
      engine: includeEngine ? serializeEngineFromState(s) : undefined,
    };

    let next = bundle;
    if (profile === "user") {
      if (!opts?.registry) {
        throw new WorkbenchError(
          "INVALID_INPUT",
          'exportRunBundle({ profile: "user" }) requires `registry`',
        );
      }
      next = buildUserExportBundle(RunBundleSchema.parse(bundle), opts.registry);
    }

    const validated = RunBundleSchema.parse(next);
    return attachRunBundleIntegrity(validated);
  }
}
