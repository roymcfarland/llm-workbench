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
 * and applies per-artifact JSON Pointer redactions registered on `SchemaRegistry`.
 */
export function buildUserExportBundle(bundle: RunBundle, registry: SchemaRegistry): RunBundle {
  const artifacts = bundle.artifacts.map((a) => {
    const paths = registry.getExportRedactPaths(a.typeId);
    if (!paths.length || a.data === undefined) return a;
    return { ...a, data: redactJson({ value: a.data, paths }) };
  });

  const trace = bundle.trace.map((e) => redactTraceEvent(registry, e));

  const next: RunBundle = {
    protocolVersion: bundle.protocolVersion,
    run: bundle.run,
    trace,
    artifacts,
    ruleSets: bundle.ruleSets,
  };

  return RunBundleSchema.parse(next);
}
