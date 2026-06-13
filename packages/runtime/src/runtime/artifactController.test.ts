import type { Operation } from "fast-json-patch";
import { describe, expect, it, vi } from "vitest";
import { WorkbenchError } from "../errors.js";
import { MemoryArtifactStore, type ArtifactStore } from "../persistence/artifactStore.js";
import type { TraceEvent } from "../protocol/trace.js";
import { TraceEventSchema } from "../protocol/trace.js";
import type { WorkflowSpec } from "../protocol/workflow.js";
import { WORKBENCH_PROTOCOL_VERSION } from "../protocol/version.js";
import { ArtifactController } from "./artifactController.js";
import { canStartStep } from "./readiness.js";
import { RunLifecycleController } from "./runLifecycleController.js";
import type { SessionContext } from "./sessionContext.js";
import { WorkbenchRuntime } from "./workbench.js";

const autoWorkflow = {
  id: "wf",
  version: 1,
  steps: [{ id: "a", gatePolicy: "AUTO" as const }],
  edges: [],
};

function expectWorkbenchError(
  fn: () => unknown,
  code: WorkbenchError["code"],
  messagePart?: string,
) {
  try {
    fn();
  } catch (error) {
    expect(WorkbenchError.is(error)).toBe(true);
    if (!WorkbenchError.is(error)) return;
    expect(error.code).toBe(code);
    if (messagePart) expect(error.message).toContain(messagePart);
    return;
  }
  throw new Error(`Expected WorkbenchError ${code}`);
}

async function expectWorkbenchErrorAsync(
  fn: () => Promise<unknown>,
  code: WorkbenchError["code"],
  messagePart?: string,
) {
  try {
    await fn();
  } catch (error) {
    expect(WorkbenchError.is(error)).toBe(true);
    if (!WorkbenchError.is(error)) return;
    expect(error.code).toBe(code);
    if (messagePart) expect(error.message).toContain(messagePart);
    return;
  }
  throw new Error(`Expected WorkbenchError ${code}`);
}

function eventsOfType<T extends TraceEvent["type"]>(
  events: TraceEvent[],
  type: T,
): Array<Extract<TraceEvent, { type: T }>> {
  return events.filter(
    (event): event is Extract<TraceEvent, { type: T }> => event.type === type,
  );
}

function makeHarness(
  options: {
    workflow?: WorkflowSpec;
    artifactStore?: ArtifactStore;
    artifactExternalizationThresholdBytes?: number;
  } = {},
) {
  const runtime = new WorkbenchRuntime();
  const { runId } = runtime.startRun({ workflow: options.workflow ?? autoWorkflow });
  const state = runtime.getState(runId);
  if (!state) throw new Error(`Missing state for run ${runId}`);

  let eventNumber = 0;
  const appendTrace = vi.fn((event: TraceEvent) => {
    const validated = TraceEventSchema.parse(event);
    state.revision += 1;
    state.trace.push(validated);
  });
  const ctx: SessionContext = {
    protocolVersion: WORKBENCH_PROTOCOL_VERSION,
    state,
    appendTrace,
    newEventId: () => `evt_${++eventNumber}`,
    nowIso: () => "2026-06-12T00:00:00.000Z",
    canStartStep: (stepId) =>
      canStartStep({
        spec: state.run.workflowSnapshot,
        stepId,
        stepStatus: state.stepStatus,
        gateState: state.gateState,
      }),
    artifactStore: options.artifactStore,
    artifactExternalizationThresholdBytes:
      options.artifactExternalizationThresholdBytes,
  };
  const lifecycle = new RunLifecycleController(ctx);

  return {
    state,
    appendTrace,
    artifacts: new ArtifactController(ctx, lifecycle),
  };
}

describe("ArtifactController", () => {
  it("writeArtifact stores versions and appends artifact_written events", () => {
    const { artifacts, state } = makeHarness();

    const first = artifacts.writeArtifact({
      artifactKey: "doc",
      typeId: "json",
      data: { count: 1 },
    });
    const second = artifacts.writeArtifact({
      artifactKey: "doc",
      typeId: "json",
      data: { count: 2 },
    });

    expect(first).toMatchObject({
      artifactKey: "doc",
      typeId: "json",
      version: 1,
      createdAt: "2026-06-12T00:00:00.000Z",
      data: { count: 1 },
    });
    expect(second).toMatchObject({
      artifactKey: "doc",
      typeId: "json",
      version: 2,
      data: { count: 2 },
    });
    expect(state.artifactsByKey.get("doc")).toBe(second);

    const written = eventsOfType(state.trace, "artifact_written");
    expect(written).toHaveLength(2);
    expect(written[0]).toMatchObject({
      id: "evt_1",
      runId: state.run.id,
      artifact: { artifactKey: "doc", typeId: "json", version: 1 },
    });
    expect(written[1]).toMatchObject({
      id: "evt_2",
      runId: state.run.id,
      artifact: { artifactKey: "doc", typeId: "json", version: 2 },
    });
  });

  it("writeArtifact rejects empty artifactKey and typeId", () => {
    const { artifacts, state } = makeHarness();

    expectWorkbenchError(
      () => artifacts.writeArtifact({ artifactKey: " ", typeId: "json", data: {} }),
      "INVALID_INPUT",
      "artifactKey",
    );
    expectWorkbenchError(
      () => artifacts.writeArtifact({ artifactKey: "doc", typeId: " ", data: {} }),
      "INVALID_INPUT",
      "typeId",
    );
    expect(state.artifactsByKey.size).toBe(0);
    expect(state.trace).toEqual([]);
  });

  it("writeArtifact returns the cached version for unchanged idempotency replay", () => {
    const { appendTrace, artifacts, state } = makeHarness();

    const first = artifacts.writeArtifact({
      artifactKey: "doc",
      typeId: "json",
      data: { count: 1 },
      idempotencyKey: "idem-1",
    });
    const replay = artifacts.writeArtifact({
      artifactKey: "doc",
      typeId: "json",
      data: { count: 999 },
      idempotencyKey: "idem-1",
    });

    expect(replay).toBe(first);
    expect(state.artifactsByKey.get("doc")).toBe(first);
    expect(state.artifactsByKey.get("doc")?.version).toBe(1);
    expect(eventsOfType(state.trace, "artifact_written")).toHaveLength(1);
    expect(appendTrace).toHaveBeenCalledTimes(1);
  });

  it("writeArtifact rejects stale and cross-artifact idempotency key reuse", () => {
    const stale = makeHarness();
    stale.artifacts.writeArtifact({
      artifactKey: "doc",
      typeId: "json",
      data: { count: 1 },
      idempotencyKey: "idem-1",
    });
    stale.artifacts.writeArtifact({
      artifactKey: "doc",
      typeId: "json",
      data: { count: 2 },
    });

    expectWorkbenchError(
      () =>
        stale.artifacts.writeArtifact({
          artifactKey: "doc",
          typeId: "json",
          data: { count: 3 },
          idempotencyKey: "idem-1",
        }),
      "IDEMPOTENCY_CONFLICT",
      "stale",
    );

    const crossArtifact = makeHarness();
    crossArtifact.artifacts.writeArtifact({
      artifactKey: "doc",
      typeId: "json",
      data: { count: 1 },
      idempotencyKey: "idem-1",
    });
    expectWorkbenchError(
      () =>
        crossArtifact.artifacts.writeArtifact({
          artifactKey: "other",
          typeId: "json",
          data: { count: 1 },
          idempotencyKey: "idem-1",
        }),
      "IDEMPOTENCY_CONFLICT",
      'artifact "doc"',
    );
  });

  it("writeArtifactAsync auto-routes large payloads externally and small payloads inline", async () => {
    const store = new MemoryArtifactStore();
    const { artifacts, state } = makeHarness({
      artifactStore: store,
      artifactExternalizationThresholdBytes: 24,
    });

    const external = await artifacts.writeArtifactAsync({
      artifactKey: "large",
      typeId: "doc",
      data: { text: "this payload is large enough for the test threshold" },
      routing: "auto",
    });
    const inline = await artifacts.writeArtifactAsync({
      artifactKey: "small",
      typeId: "doc",
      data: { ok: true },
      routing: "auto",
    });

    expect(external.pointer).toMatchObject({
      kind: "external",
      ref: expect.any(String),
      payloadHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(external.data).toBeUndefined();
    expect(inline.pointer).toMatchObject({
      kind: "inline",
      payloadHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(inline.data).toEqual({ ok: true });
    expect(state.artifactsByKey.get("large")).toBe(external);
    expect(state.artifactsByKey.get("small")).toBe(inline);
    expect(store.size()).toBe(1);
  });

  it('writeArtifactAsync rejects routing "external" without a store', async () => {
    const { artifacts, state } = makeHarness();

    await expectWorkbenchErrorAsync(
      () =>
        artifacts.writeArtifactAsync({
          artifactKey: "doc",
          typeId: "json",
          data: { count: 1 },
          routing: "external",
        }),
      "INVALID_INPUT",
      "artifactStore",
    );
    expect(state.artifactsByKey.size).toBe(0);
    expect(state.trace).toEqual([]);
  });

  it("materializeArtifact rejects unknown keys and returns inline data directly", async () => {
    const { artifacts } = makeHarness();
    const data = { count: 1 };

    await expectWorkbenchErrorAsync(
      () => artifacts.materializeArtifact("missing"),
      "UNKNOWN_ARTIFACT",
    );
    artifacts.writeArtifact({
      artifactKey: "doc",
      typeId: "json",
      data,
    });

    await expect(artifacts.materializeArtifact("doc")).resolves.toBe(data);
  });

  it("materializeArtifact rejects external artifacts when no store is configured", async () => {
    const { artifacts } = makeHarness();
    artifacts.writeArtifact({
      artifactKey: "external-doc",
      typeId: "json",
      data: null,
      pointer: {
        kind: "external",
        ref: "ref_1",
        payloadHash: "a".repeat(64),
        byteLength: 2,
      },
    });

    await expectWorkbenchErrorAsync(
      () => artifacts.materializeArtifact("external-doc"),
      "INVALID_STATE_TRANSITION",
      "no artifactStore",
    );
  });

  it("patchArtifact applies JSON Patch, versions the artifact, and rejects unknown keys", () => {
    const { artifacts, state } = makeHarness();
    const patch: Operation[] = [
      { op: "replace", path: "/count", value: 2 },
      { op: "add", path: "/tags/1", value: "b" },
    ];
    artifacts.writeArtifact({
      artifactKey: "doc",
      typeId: "json",
      data: { count: 1, tags: ["a"] },
    });

    const patched = artifacts.patchArtifact({ artifactKey: "doc", patch });

    expect(patched).toMatchObject({
      artifactKey: "doc",
      typeId: "json",
      version: 2,
      data: { count: 2, tags: ["a", "b"] },
    });
    expect(state.artifactsByKey.get("doc")).toBe(patched);
    expect(eventsOfType(state.trace, "artifact_patch")).toContainEqual(
      expect.objectContaining({
        id: "evt_2",
        artifactKey: "doc",
        fromVersion: 1,
        toVersion: 2,
        patch,
      }),
    );

    expectWorkbenchError(
      () => artifacts.patchArtifact({ artifactKey: "missing", patch }),
      "UNKNOWN_ARTIFACT",
    );
  });
});
