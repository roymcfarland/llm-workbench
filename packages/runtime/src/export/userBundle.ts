import type { RunBundle } from "../protocol/run.js";
import { RunBundleSchema } from "../protocol/run.js";
import type { SchemaRegistry } from "../schema/registry.js";
import { redactJson } from "../schema/redact.js";
import type { TraceEvent } from "../protocol/trace.js";

function redactTraceEvent(registry: SchemaRegistry, e: TraceEvent): TraceEvent {
  if (e.type === "model_io") {
    return { ...e, payload: undefined };
  }
  if (e.type === "tool_call") {
    return { ...e, args: undefined, result: undefined };
  }
  if (e.type === "artifact_written") {
    const paths = registry.getExportRedactPaths(e.artifact.typeId);
    if (!paths.length || e.artifact.data === undefined) return e;
    return {
      ...e,
      artifact: {
        ...e.artifact,
        data: redactJson({ value: e.artifact.data, paths }),
      },
    };
  }
  return e;
}

/**
 * Produces a shareable bundle: strips engine/idempotency fidelity, removes sensitive payloads from trace,
 * applies per-artifact JSON Pointer redactions registered on `SchemaRegistry`,
 * and drops `run.metadata` by default (the host can opt in via `keepMetadata: true`).
 *
 * `run.metadata` is host-controlled JSON. It is not covered by Ajv schemas or
 * `exportRedactPaths`, so we err on the side of dropping it from user-facing
 * exports to avoid leaking debugging hints, internal ids, or feature flags.
 */
export function buildUserExportBundle(
  bundle: RunBundle,
  registry: SchemaRegistry,
  options?: { keepMetadata?: boolean },
): RunBundle {
  const artifacts = bundle.artifacts.map((a) => {
    const paths = registry.getExportRedactPaths(a.typeId);
    if (!paths.length || a.data === undefined) return a;
    return { ...a, data: redactJson({ value: a.data, paths }) };
  });

  const trace = bundle.trace.map((e) => redactTraceEvent(registry, e));

  const run = options?.keepMetadata
    ? bundle.run
    : (() => {
        const { metadata: _drop, ...rest } = bundle.run;
        return rest;
      })();

  const next: RunBundle = {
    protocolVersion: bundle.protocolVersion,
    run,
    trace,
    artifacts,
    ruleSets: bundle.ruleSets,
  };

  return RunBundleSchema.parse(next);
}
