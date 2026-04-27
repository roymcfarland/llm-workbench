import { describe, expect, it } from "vitest";
import { WorkbenchError } from "../errors.js";
import { computeRunBundleIntegrity, parseRunBundleJson } from "./bundle.js";
import {
  listRunBundleMigrations,
  migrateRunBundle,
  registerRunBundleMigration,
} from "./migrate.js";
import { JsonPatchOpSchema, TraceEventSchema } from "./trace.js";
import { WORKBENCH_PROTOCOL_VERSION } from "./version.js";

describe("stableStringify (via computeRunBundleIntegrity)", () => {
  const baseRun = {
    protocolVersion: WORKBENCH_PROTOCOL_VERSION,
    run: {
      id: "r1",
      workflowId: "w",
      workflowVersion: 1,
      workflowSnapshot: {
        id: "w",
        version: 1,
        steps: [{ id: "a", gatePolicy: "AUTO" as const }],
        edges: [],
      },
      status: "running" as const,
      startedAt: "2024-01-01T00:00:00.000Z",
      tags: [],
    },
    trace: [],
    artifacts: [],
    ruleSets: [],
  };

  function intoIntegrityInput(bundle: typeof baseRun) {
    return {
      run: bundle.run,
      trace: bundle.trace,
      artifacts: bundle.artifacts,
      ruleSets: bundle.ruleSets,
    };
  }

  it("rejects undefined inside arrays so [undefined] != []", async () => {
    const bad = intoIntegrityInput({
      ...baseRun,
      trace: [undefined as never],
    });
    await expect(computeRunBundleIntegrity(bad as never)).rejects.toBeInstanceOf(
      WorkbenchError,
    );
  });

  it("treats {a:undefined} as semantically equal to {}", async () => {
    const a = await computeRunBundleIntegrity(intoIntegrityInput(baseRun));
    const withUndef = intoIntegrityInput({
      ...baseRun,
      run: { ...baseRun.run, endedAt: undefined as never },
    });
    const b = await computeRunBundleIntegrity(withUndef);
    expect(a).toBe(b);
  });

  it("is stable across key insertion order", async () => {
    const reordered = {
      ruleSets: baseRun.ruleSets,
      artifacts: baseRun.artifacts,
      trace: baseRun.trace,
      run: baseRun.run,
    };
    const a = await computeRunBundleIntegrity(intoIntegrityInput(baseRun));
    const b = await computeRunBundleIntegrity(reordered as never);
    expect(a).toBe(b);
  });
});

describe("JsonPatchOpSchema", () => {
  it("accepts each RFC 6902 op", () => {
    expect(() => JsonPatchOpSchema.parse({ op: "add", path: "/x", value: 1 })).not.toThrow();
    expect(() => JsonPatchOpSchema.parse({ op: "remove", path: "/x" })).not.toThrow();
    expect(() => JsonPatchOpSchema.parse({ op: "replace", path: "/x", value: 1 })).not.toThrow();
    expect(() => JsonPatchOpSchema.parse({ op: "move", path: "/x", from: "/y" })).not.toThrow();
    expect(() => JsonPatchOpSchema.parse({ op: "copy", path: "/x", from: "/y" })).not.toThrow();
    expect(() => JsonPatchOpSchema.parse({ op: "test", path: "/x", value: 1 })).not.toThrow();
  });

  it("rejects unknown op kinds", () => {
    expect(() => JsonPatchOpSchema.parse({ op: "ohai", path: "/x" })).toThrow();
  });

  it("rejects extra props (strict)", () => {
    expect(() =>
      JsonPatchOpSchema.parse({ op: "add", path: "/x", value: 1, extra: true }),
    ).toThrow();
  });

  it("rejects artifact_patch trace events with malformed ops", () => {
    expect(() =>
      TraceEventSchema.parse({
        id: "e1",
        type: "artifact_patch",
        runId: "r1",
        ts: "2024-01-01T00:00:00.000Z",
        artifactKey: "k",
        fromVersion: 1,
        toVersion: 2,
        patch: [{ op: "add" /* missing path */ }],
      }),
    ).toThrow();
  });
});

describe("registerRunBundleMigration", () => {
  it("rejects bundles with missing protocolVersion", () => {
    expect(() => migrateRunBundle({})).toThrow(WorkbenchError);
  });

  it("returns the bundle untouched at the current version after JSON parsing", () => {
    const bundle = {
      protocolVersion: WORKBENCH_PROTOCOL_VERSION,
      run: {
        id: "r",
        workflowId: "w",
        workflowVersion: 1,
        workflowSnapshot: {
          id: "w",
          version: 1,
          steps: [{ id: "a", gatePolicy: "AUTO" }],
          edges: [],
        },
        status: "running",
        startedAt: "2024-01-01T00:00:00.000Z",
        tags: [],
      },
      trace: [],
      artifacts: [],
      ruleSets: [],
    };
    const out = parseRunBundleJson(JSON.stringify(bundle));
    expect(out.protocolVersion).toBe(WORKBENCH_PROTOCOL_VERSION);
  });

  it("throws UNSUPPORTED_PROTOCOL_VERSION when no migration path exists", () => {
    const future = JSON.stringify({ protocolVersion: "999.0.0" });
    expect(() => parseRunBundleJson(future)).toThrow(WorkbenchError);
    try {
      parseRunBundleJson(future);
    } catch (e) {
      expect(WorkbenchError.is(e) && e.code).toBe("UNSUPPORTED_PROTOCOL_VERSION");
    }
  });

  it("registers and exposes migrations", () => {
    const before = listRunBundleMigrations().length;
    registerRunBundleMigration({
      from: "0.0.0-test",
      to: "0.0.1-test",
      migrate: (input) => ({ ...(input as object), protocolVersion: "0.0.1-test" }),
    });
    expect(listRunBundleMigrations().length).toBe(before + 1);
  });
});
