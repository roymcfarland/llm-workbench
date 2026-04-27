import { describe, expect, it } from "vitest";
import {
  DEFAULT_ARTIFACT_EXTERNALIZATION_THRESHOLD_BYTES,
  MemoryArtifactStore,
  encodeArtifactPayloadBytes,
  sha256Hex,
} from "./artifactStore.js";
import { ArtifactPointerSchema, getArtifactPayloadHash } from "../protocol/artifacts.js";
import { WorkbenchRuntime } from "../runtime/workbench.js";

const baseWorkflow = {
  id: "wf",
  version: 1,
  steps: [{ id: "only", gatePolicy: "AUTO" as const }],
  edges: [],
};

describe("ArtifactPointer schema with payloadHash", () => {
  it("accepts pointers with payloadHash only", () => {
    const parsed = ArtifactPointerSchema.parse({
      kind: "inline",
      payloadHash: "a".repeat(64),
      byteLength: 12,
    });
    expect(getArtifactPayloadHash(parsed)).toBe("a".repeat(64));
  });

  it("accepts legacy sha256 alias", () => {
    const parsed = ArtifactPointerSchema.parse({
      kind: "inline",
      sha256: "b".repeat(64),
    });
    expect(getArtifactPayloadHash(parsed)).toBe("b".repeat(64));
  });

  it("rejects mismatched payloadHash and sha256", () => {
    const r = ArtifactPointerSchema.safeParse({
      kind: "inline",
      payloadHash: "a".repeat(64),
      sha256: "b".repeat(64),
    });
    expect(r.success).toBe(false);
  });

  it("rejects external pointer without ref", () => {
    const r = ArtifactPointerSchema.safeParse({ kind: "external", payloadHash: "c".repeat(64) });
    expect(r.success).toBe(false);
  });

  it("rejects malformed payloadHash", () => {
    const r = ArtifactPointerSchema.safeParse({ kind: "inline", payloadHash: "not-hex" });
    expect(r.success).toBe(false);
  });
});

describe("encodeArtifactPayloadBytes + sha256Hex", () => {
  it("produces stable canonical encoding regardless of key order", async () => {
    const a = encodeArtifactPayloadBytes({ b: 2, a: 1 });
    const b = encodeArtifactPayloadBytes({ a: 1, b: 2 });
    expect(new TextDecoder().decode(a)).toBe(new TextDecoder().decode(b));
    expect(await sha256Hex(a)).toBe(await sha256Hex(b));
  });

  it("rejects undefined values inside payload", () => {
    expect(() => encodeArtifactPayloadBytes({ a: undefined as unknown as number })).toThrow();
  });

  it("rejects cyclic payloads", () => {
    const cyc: Record<string, unknown> = { a: 1 };
    cyc.self = cyc;
    expect(() => encodeArtifactPayloadBytes(cyc)).toThrow();
  });
});

describe("MemoryArtifactStore round-trip", () => {
  it("stores and retrieves payload bytes verbatim", async () => {
    const store = new MemoryArtifactStore();
    const payload = encodeArtifactPayloadBytes({ hello: "world" });
    const payloadHash = await sha256Hex(payload);
    const put = await store.put({
      runId: "run_a",
      artifactKey: "k",
      version: 1,
      payload,
      payloadHash,
    });
    expect(put.payloadHash).toBe(payloadHash);
    const got = await store.get({ runId: "run_a", ref: put.ref });
    expect(got.payloadHash).toBe(payloadHash);
    expect(new TextDecoder().decode(got.payload)).toBe('{"hello":"world"}');
  });

  it("delete removes the blob", async () => {
    const store = new MemoryArtifactStore();
    const payload = encodeArtifactPayloadBytes({ x: 1 });
    const put = await store.put({
      runId: "r",
      artifactKey: "k",
      version: 1,
      payload,
      payloadHash: await sha256Hex(payload),
    });
    expect(store.size()).toBe(1);
    await store.delete({ runId: "r", ref: put.ref });
    expect(store.size()).toBe(0);
  });
});

describe("WorkbenchSession.writeArtifactAsync routing", () => {
  it("keeps small artifacts inline when under the threshold", async () => {
    const store = new MemoryArtifactStore();
    const rt = new WorkbenchRuntime({ artifactStore: store });
    const { runId } = rt.startRun({ workflow: baseWorkflow });
    const session = rt.session(runId);
    const art = await session.writeArtifactAsync({
      artifactKey: "small",
      typeId: "thing",
      data: { v: 1 },
    });
    expect(art.pointer?.kind).toBe("inline");
    expect(art.pointer?.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(art.pointer?.byteLength).toBeGreaterThan(0);
    expect(store.size()).toBe(0);
    expect(art.data).toEqual({ v: 1 });
  });

  it("externalizes artifacts >= threshold and strips data", async () => {
    const store = new MemoryArtifactStore();
    const rt = new WorkbenchRuntime({
      artifactStore: store,
      artifactExternalizationThresholdBytes: 32,
    });
    const { runId } = rt.startRun({ workflow: baseWorkflow });
    const session = rt.session(runId);
    const big = { text: "lorem ipsum dolor sit amet, consectetur adipiscing elit" };
    const art = await session.writeArtifactAsync({
      artifactKey: "big",
      typeId: "doc",
      data: big,
    });
    expect(art.pointer?.kind).toBe("external");
    expect(art.pointer?.ref).toBeDefined();
    expect(art.pointer?.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(art.data).toBeUndefined();
    expect(store.size()).toBe(1);
  });

  it("auto routing falls back to inline when no store is configured even above threshold", async () => {
    const rt = new WorkbenchRuntime({ artifactExternalizationThresholdBytes: 4 });
    const { runId } = rt.startRun({ workflow: baseWorkflow });
    const session = rt.session(runId);
    const art = await session.writeArtifactAsync({
      artifactKey: "big",
      typeId: "doc",
      data: { text: "still inline because no store wired" },
    });
    expect(art.pointer?.kind).toBe("inline");
    expect(art.data).toBeDefined();
  });

  it('routing: "external" without a store throws INVALID_INPUT', async () => {
    const rt = new WorkbenchRuntime();
    const { runId } = rt.startRun({ workflow: baseWorkflow });
    const session = rt.session(runId);
    await expect(
      session.writeArtifactAsync({
        artifactKey: "k",
        typeId: "t",
        data: { a: 1 },
        routing: "external",
      }),
    ).rejects.toThrow(/artifactStore/);
  });

  it("materializeArtifact returns inline payload directly", async () => {
    const rt = new WorkbenchRuntime();
    const { runId } = rt.startRun({ workflow: baseWorkflow });
    const session = rt.session(runId);
    await session.writeArtifactAsync({
      artifactKey: "k",
      typeId: "t",
      data: { hello: 1 },
    });
    expect(await session.materializeArtifact("k")).toEqual({ hello: 1 });
  });

  it("materializeArtifact fetches external payloads through the store and verifies hash", async () => {
    const store = new MemoryArtifactStore();
    const rt = new WorkbenchRuntime({
      artifactStore: store,
      artifactExternalizationThresholdBytes: 4,
    });
    const { runId } = rt.startRun({ workflow: baseWorkflow });
    const session = rt.session(runId);
    await session.writeArtifactAsync({
      artifactKey: "k",
      typeId: "t",
      data: { large: "this should be externalized because threshold is tiny" },
    });
    const back = await session.materializeArtifact("k");
    expect(back).toEqual({ large: "this should be externalized because threshold is tiny" });
  });
});

describe("DEFAULT_ARTIFACT_EXTERNALIZATION_THRESHOLD_BYTES", () => {
  it("matches the user-approved default of 256 KB", () => {
    expect(DEFAULT_ARTIFACT_EXTERNALIZATION_THRESHOLD_BYTES).toBe(256 * 1024);
  });
});
