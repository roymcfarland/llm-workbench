import type { SchemaRegistry, WorkbenchSession } from "@llm-workbench/runtime";

/**
 * Optional artifact-write hook applied after a successful generation.
 *
 * When provided, the wrapped `traced*` helpers will validate the model output
 * against the registry (if `registry` is passed) and persist it via
 * `session.writeArtifact` before returning the AI SDK result to the caller.
 */
export interface WriteArtifactOptions<TResult = unknown> {
  /** Stable artifact key, e.g. `"compiledProfile"`. */
  artifactKey: string;
  /** Registered artifact `typeId` used for schema validation. */
  typeId: string;
  /**
   * Schema registry used to validate `data` before writing. When omitted the
   * helper still calls `session.writeArtifact` but skips validation.
   */
  registry?: SchemaRegistry;
  /**
   * Project the AI SDK result into the artifact `data` payload. Defaults to:
   *   - `result.object` for `*Object` helpers
   *   - `result.text` for `*Text` helpers
   */
  toData?: (result: TResult) => unknown;
  /** Optional idempotency key forwarded to `session.writeArtifact`. */
  idempotencyKey?: string;
}

/**
 * Cross-cutting tracing context applied to every traced call.
 */
export interface WorkbenchTraceContext {
  /** Workflow step id to associate trace events with. */
  stepId?: string;
  /**
   * Explicit correlation id linking request/response/tool/stream_chunk events.
   * One is generated automatically when omitted.
   */
  correlationId?: string;
  /**
   * `"summary"` (default) writes the short prompt summary into traces and
   * omits raw payloads. `"full"` persists prompt/response payloads in traces
   * for engineering/replay exports.
   */
  detail?: "full" | "summary";
}

/**
 * Mapping from a known LLM Workbench session to a callable that can also
 * accept a tracing-augmented options object.
 *
 * @internal
 */
export type WorkbenchSessionLike = Pick<
  WorkbenchSession,
  "logModelIO" | "logToolCall" | "writeArtifact"
>;
