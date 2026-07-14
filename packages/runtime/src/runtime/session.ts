import type { Operation } from "fast-json-patch";
import type { ArtifactVersion } from "../protocol/artifacts.js";
import type { RuleSet } from "../protocol/rules.js";
import type { RunBundle } from "../protocol/run.js";
import type { ModelCost, ModelUsage } from "../protocol/trace.js";
import type { SchemaRegistry } from "../schema/registry.js";
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

export type RunTerminalStatus = "completed" | "failed" | "cancelled";

export class WorkbenchSession {
  private readonly lifecycle: RunLifecycleController;
  private readonly gates: GateController;
  private readonly steps: StepController;
  private readonly artifacts: ArtifactController;
  private readonly trace: TraceController;
  private readonly rules: RuleController;

  /**
   * @internal Constructed only by `WorkbenchHost.session()`. The `SessionContext`
   * parameter type is internal to the runtime package and is not re-exported
   * from `packages/runtime/src/index.ts`; external callers must reach a
   * `WorkbenchSession` through `WorkbenchHost`, never via `new WorkbenchSession`.
   */
  constructor(private readonly ctx: SessionContext) {
    this.lifecycle = new RunLifecycleController(ctx);
    this.gates = new GateController(ctx, this.lifecycle);
    this.steps = new StepController(ctx, this.lifecycle, this.gates);
    this.artifacts = new ArtifactController(ctx, this.lifecycle);
    this.trace = new TraceController(ctx, this.lifecycle);
    this.rules = new RuleController(ctx, this.lifecycle);
  }

  /**
   * Identifies the run whose state this session manages.
   *
   * @returns The immutable run identifier from the current store state.
   */
  get runId() {
    return this.ctx.state.run.id;
  }

  /**
   * Returns an isolated copy of the complete mutable run store state.
   *
   * @returns A deep clone suitable for inspection without changing the session.
   */
  snapshot(): RunStoreState {
    return cloneRunStoreState(this.ctx.state);
  }

  /**
   * Marks an active run completed and records its terminal status in the trace.
   *
   * @param input - Optional completion details.
   * @param input.reason - Human-readable reason for completing the run.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active or still has running steps.
   */
  completeRun(input?: { reason?: string }): void {
    this.lifecycle.completeRun(input);
  }

  /**
   * Marks an active run failed and records both its terminal status and fatal error.
   *
   * @param error - Failure details to record.
   * @param error.message - Human-readable failure message.
   * @param error.code - Optional application-specific failure code.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active or still has running steps.
   */
  failRun(error: { message: string; code?: string }): void {
    this.lifecycle.failRun(error);
  }

  /**
   * Marks an active run cancelled and records its terminal status in the trace.
   *
   * @param input - Optional cancellation details.
   * @param input.reason - Human-readable reason for cancelling the run.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active or still has running steps.
   */
  cancelRun(input?: { reason?: string }): void {
    this.lifecycle.cancelRun(input);
  }

  /**
   * Builds a validated, integrity-protected export of the current run state.
   *
   * @param opts - Export configuration.
   * @param opts.profile - `full` retains all data; `user` produces a registry-filtered bundle.
   * @param opts.registry - Schema registry required when exporting the `user` profile.
   * @param opts.includeEngine - Whether to include serialized engine state; defaults to the selected profile's behavior.
   * @returns The validated run bundle with an integrity attachment.
   * @throws {WorkbenchError} `INVALID_INPUT` if a `user` export is requested without a registry.
   * @throws {WorkbenchError} `MISSING_WEBCRYPTO` if the runtime cannot generate the bundle integrity hash.
   */
  exportRunBundle(opts?: ExportRunBundleOptions): Promise<RunBundle> {
    return this.lifecycle.exportRunBundle(opts);
  }

  /**
   * Records a human-review gate request for a step without changing its gate state.
   *
   * @param input - Gate request details.
   * @param input.stepId - Identifier of the step awaiting review.
   * @param input.gate - Gate phase to request.
   * @param input.reason - Optional explanation shown to the reviewer.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active.
   */
  requestGate(input: { stepId: string; gate: "PAUSE_BEFORE" | "PAUSE_AFTER" | "CHECKPOINT"; reason?: string }): void {
    this.gates.requestGate(input);
  }

  /**
   * Records a reviewer decision and updates the matching pause or checkpoint gate state.
   *
   * @param input - Gate-resolution details.
   * @param input.stepId - Identifier of the step with the requested gate.
   * @param input.gate - Gate phase being resolved.
   * @param input.decision - Whether the reviewer approved, rejected, or edited the gate.
   * @param input.note - Optional reviewer note to attach to the trace event.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active.
   * @throws {WorkbenchError} `UNKNOWN_STEP` if the step has no gate state.
   */
  resolveGate(input: { stepId: string; gate: "PAUSE_BEFORE" | "PAUSE_AFTER" | "CHECKPOINT"; decision: "approved" | "rejected" | "edited"; note?: string }): void {
    this.gates.resolveGate(input);
  }

  /**
   * Records a checkpoint decision and updates that checkpoint's approval state for a step.
   *
   * @param input - Checkpoint-resolution details.
   * @param input.stepId - Identifier of the step containing the checkpoint.
   * @param input.checkpointId - Identifier of the checkpoint to resolve.
   * @param input.decision - Whether the checkpoint was approved or rejected.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active.
   * @throws {WorkbenchError} `UNKNOWN_STEP` if the step has no gate state.
   */
  resolveCheckpoint(input: { stepId: string; checkpointId: string; decision: "approved" | "rejected" }): void {
    this.gates.resolveCheckpoint(input);
  }

  /**
   * Verifies that workflow and gate state allow a step to start.
   *
   * @param stepId - Identifier of the step to validate.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if dependencies, gates, or step state block the start.
   */
  assertCanStartStep(stepId: string): void {
    this.steps.assertCanStartStep(stepId);
  }

  /**
   * Starts an eligible step and records a `step_started` trace event.
   *
   * @param stepId - Identifier of the step to start.
   * @returns A successful result after starting, or the blocking reason when the step cannot start yet.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active.
   */
  beginStep(stepId: string): { ok: false; reason: import("./types.js").BlockReason } | { ok: true } {
    return this.steps.beginStep(stepId);
  }

  /**
   * Marks a running step complete, optionally requests its post-step review gate, and records completion.
   *
   * @param stepId - Identifier of the running step to complete.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is inactive or the step is not running.
   * @throws {WorkbenchError} `UNKNOWN_STEP` if the workflow does not contain the step.
   */
  completeStep(stepId: string): void {
    this.steps.completeStep(stepId);
  }

  /**
   * Marks a step failed, records the error, and can fail the entire run immediately.
   *
   * @param stepId - Identifier of the step to fail.
   * @param error - Failure details to record.
   * @param error.message - Human-readable failure message.
   * @param error.code - Optional application-specific failure code.
   * @param options - Failure behavior.
   * @param options.failFast - Whether to transition the run to failed after recording the step failure.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is inactive, the step is terminal, or fail-fast leaves running steps.
   */
  failStep(stepId: string, error: { message: string; code?: string }, options?: { failFast?: boolean }): void {
    this.steps.failStep(stepId, error, options);
  }

  /**
   * Stores an inline artifact version and records an `artifact_written` trace event.
   *
   * @param input - Artifact contents and optional idempotency metadata.
   * @param input.artifactKey - Stable key identifying the artifact.
   * @param input.typeId - Application-defined type identifier for the artifact data.
   * @param input.data - Inline payload to store.
   * @param input.idempotencyKey - Optional key that makes a matching repeated write return the existing version.
   * @param input.pointer - Optional pointer metadata to associate with the artifact.
   * @returns The new artifact version, or the original version for a matching idempotent write.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active.
   * @throws {WorkbenchError} `INVALID_INPUT` if the artifact key or type identifier is empty.
   * @throws {WorkbenchError} `IDEMPOTENCY_CONFLICT` if the idempotency key belongs to another or stale artifact version.
   */
  writeArtifact(input: { artifactKey: string; typeId: string; data: unknown; idempotencyKey?: string; pointer?: ArtifactVersion["pointer"] }): ArtifactVersion {
    return this.artifacts.writeArtifact(input);
  }

  /**
   * Stores an artifact inline or externally, attaches payload metadata, and records an `artifact_written` event.
   *
   * @param input - Artifact contents, storage routing, and optional idempotency metadata.
   * @param input.artifactKey - Stable key identifying the artifact.
   * @param input.typeId - Application-defined type identifier for the artifact data.
   * @param input.data - Payload to encode and store.
   * @param input.idempotencyKey - Optional key that makes a matching repeated write return the existing version.
   * @param input.contentType - Optional media type supplied to an external artifact store.
   * @param input.routing - Selects automatic, inline, or external storage routing.
   * @returns The new artifact version, or the original version for a matching idempotent write.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active.
   * @throws {WorkbenchError} `INVALID_INPUT` if identifiers are empty, data cannot be encoded, or external routing has no configured artifact store.
   * @throws {WorkbenchError} `IDEMPOTENCY_CONFLICT` if the idempotency key belongs to another or stale artifact version.
   * @throws {WorkbenchError} `INTEGRITY_MISMATCH` if an external store reports a different payload hash.
   * @throws {WorkbenchError} `MISSING_WEBCRYPTO` if the runtime cannot hash the artifact payload.
   */
  writeArtifactAsync(input: { artifactKey: string; typeId: string; data: unknown; idempotencyKey?: string; contentType?: string; routing?: "auto" | "inline" | "external" }): Promise<ArtifactVersion> {
    return this.artifacts.writeArtifactAsync(input);
  }

  /**
   * Returns an artifact's inline payload or fetches, verifies, and parses its external payload.
   *
   * @param artifactKey - Key of the artifact to retrieve.
   * @param opts - Fetch options.
   * @param opts.signal - Abort signal passed to the external artifact store.
   * @returns The inline value or JSON value loaded from external storage.
   * @throws {WorkbenchError} `UNKNOWN_ARTIFACT` if the artifact key is absent.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if an external artifact has no configured store.
   * @throws {WorkbenchError} `INVALID_RUN_STATE` if an external artifact has no storage reference.
   * @throws {WorkbenchError} `INTEGRITY_MISMATCH` if fetched bytes do not match the stored payload hash.
   * @throws {WorkbenchError} `INVALID_JSON` if fetched external bytes cannot be parsed as JSON.
   */
  materializeArtifact(artifactKey: string, opts?: { signal?: AbortSignal }): Promise<unknown> {
    return this.artifacts.materializeArtifact(artifactKey, opts);
  }

  /**
   * Applies an RFC 6902 patch to an existing inline artifact and records an `artifact_patch` event.
   *
   * @param input - Patch request and optional idempotency metadata.
   * @param input.artifactKey - Key of the artifact to patch.
   * @param input.patch - JSON Patch operations to apply to the artifact data.
   * @param input.idempotencyKey - Optional key that makes a matching repeated patch return the existing version.
   * @returns The new artifact version, or the original version for a matching idempotent patch.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active.
   * @throws {WorkbenchError} `INVALID_INPUT` if the artifact key is empty.
   * @throws {WorkbenchError} `IDEMPOTENCY_CONFLICT` if the idempotency key belongs to another or stale artifact version.
   * @throws {WorkbenchError} `UNKNOWN_ARTIFACT` if the artifact key is absent.
   * @throws {WorkbenchError} `PATCH_FAILED` if a JSON Patch operation cannot be applied.
   */
  patchArtifact(input: { artifactKey: string; patch: Operation[]; idempotencyKey?: string }): ArtifactVersion {
    return this.artifacts.patchArtifact(input);
  }

  /**
   * Appends model request, response, or stream-chunk telemetry to the run trace.
   *
   * @param input - Model I/O telemetry.
   * @param input.stepId - Optional step associated with the model operation.
   * @param input.direction - Whether this records a request, response, or stream chunk.
   * @param input.provider - Optional model-provider identifier.
   * @param input.model - Optional model identifier.
   * @param input.usage - Optional token or usage measurements.
   * @param input.cost - Optional cost measurements.
   * @param input.durationMs - Optional elapsed operation time in milliseconds.
   * @param input.summary - Optional safe summary of the model I/O.
   * @param input.payload - Optional full request or response payload.
   * @param input.correlationId - Optional identifier linking related trace events.
   * @param input.detail - Retains the payload only when set to `full`; defaults to `summary`.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active.
   */
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

  /**
   * Starts a trace span and returns an idempotent handle that records its end.
   *
   * @param input - Span metadata.
   * @param input.name - Display name for the span.
   * @param input.parentSpanId - Optional parent span identifier for nesting.
   * @param input.kind - Optional OpenTelemetry-style span kind.
   * @param input.attributes - Optional attributes recorded with the span start.
   * @param input.stepId - Optional associated workflow step.
   * @param input.correlationId - Optional identifier linking related trace events.
   * @returns A handle whose `end` method appends one corresponding span-ended event.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active.
   */
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

  /**
   * Runs a function inside a trace span, automatically recording an ended span with success or error status.
   *
   * @param name - Display name for the span.
   * @param fn - Synchronous or asynchronous work that receives the span handle.
   * @param opts - Optional span metadata.
   * @param opts.parentSpanId - Optional parent span identifier for nesting.
   * @param opts.kind - Optional OpenTelemetry-style span kind.
   * @param opts.attributes - Optional attributes recorded with the span start.
   * @param opts.stepId - Optional associated workflow step.
   * @param opts.correlationId - Optional identifier linking related trace events.
   * @returns A promise for the callback's result.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active before the span begins.
   * @throws {Error} Re-throws any error raised by `fn` after recording it on the span.
   */
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

  /**
   * Appends a tool invocation, including optional arguments and result, to the run trace.
   *
   * @param input - Tool-call telemetry.
   * @param input.stepId - Optional step associated with the tool call.
   * @param input.name - Non-empty name of the invoked tool.
   * @param input.args - Optional arguments sent to the tool.
   * @param input.result - Optional result returned by the tool.
   * @param input.correlationId - Optional identifier linking related trace events.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active.
   * @throws {WorkbenchError} `INVALID_INPUT` if the tool name is empty.
   */
  logToolCall(input: { stepId?: string; name: string; args?: unknown; result?: unknown; correlationId?: string }): void {
    this.trace.logToolCall(input);
  }

  /**
   * Replaces a rule set and records its full replacement snapshot in the run trace.
   *
   * @param ruleSet - Complete rule set to store under its identifier.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active.
   */
  replaceRuleSet(ruleSet: RuleSet): void {
    this.rules.replaceRuleSet(ruleSet);
  }

  /**
   * Reprioritizes every rule in a rule set and records the resulting snapshot.
   *
   * @param input - Rule-order request.
   * @param input.ruleSetId - Identifier of the existing rule set.
   * @param input.orderedRuleIds - Every rule identifier in the desired priority order.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active.
   * @throws {WorkbenchError} `UNKNOWN_RULESET` if the rule set does not exist.
   * @throws {WorkbenchError} `INVALID_INPUT` if identifiers are duplicated, incomplete, or unknown to the rule set.
   */
  reorderRules(input: { ruleSetId: string; orderedRuleIds: string[] }): void {
    this.rules.reorderRules(input);
  }

  /**
   * Appends a free-form annotation and optional tags to the run trace.
   *
   * @param input - Annotation details.
   * @param input.text - Annotation text to record.
   * @param input.tags - Optional classification tags for the annotation.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active.
   */
  annotate(input: { text: string; tags?: string[] }): void {
    this.rules.annotate(input);
  }

  /**
   * Records that this run was forked from another run, optionally at a source step.
   *
   * @param parentRunId - Identifier of the source run.
   * @param forkedFromStepId - Optional source step at which the fork occurred.
   * @throws {WorkbenchError} `INVALID_STATE_TRANSITION` if the run is not active.
   */
  forkNotice(parentRunId: string, forkedFromStepId?: string): void {
    this.rules.forkNotice(parentRunId, forkedFromStepId);
  }
}
