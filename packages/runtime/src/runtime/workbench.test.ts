import { describe, expect, it } from "vitest";
import { attachRunBundleIntegrity, deserializeRunBundle, serializeRunBundle, verifyRunBundleIntegrity } from "../protocol/bundle.js";
import { SchemaRegistry } from "../schema/registry.js";
import { WorkbenchRuntime } from "./workbench.js";

describe("WorkbenchRuntime gates", () => {
  it("blocks PAUSE_BEFORE until resolved", () => {
    const rt = new WorkbenchRuntime();
    const wf = {
      id: "wf",
      version: 1,
      steps: [{ id: "a", gatePolicy: "PAUSE_BEFORE" as const }],
      edges: [],
    };
    const { runId } = rt.startRun({ workflow: wf });
    const s = rt.session(runId);
    expect(s.beginStep("a").ok).toBe(false);
    s.resolveGate({ stepId: "a", gate: "PAUSE_BEFORE", decision: "approved" });
    expect(s.beginStep("a").ok).toBe(true);
  });

  it("PAUSE_AFTER blocks downstream until resolved", () => {
    const rt = new WorkbenchRuntime();
    const wf = {
      id: "wf",
      version: 1,
      steps: [
        { id: "p", gatePolicy: "AUTO" as const },
        { id: "c", gatePolicy: "AUTO" as const },
      ],
      edges: [{ id: "e1", from: "p", to: "c" }],
    };
    const { runId } = rt.startRun({ workflow: wf });
    const s = rt.session(runId);

    expect(s.beginStep("p").ok).toBe(true);
    s.completeStep("p");
    // parent p has no PAUSE_AFTER, child should start
    expect(s.beginStep("c").ok).toBe(true);
  });

  it("PAUSE_AFTER on predecessor blocks child until approved", () => {
    const rt = new WorkbenchRuntime();
    const wf = {
      id: "wf",
      version: 1,
      steps: [
        { id: "p", gatePolicy: "PAUSE_AFTER" as const },
        { id: "c", gatePolicy: "AUTO" as const },
      ],
      edges: [{ id: "e1", from: "p", to: "c" }],
    };
    const { runId } = rt.startRun({ workflow: wf });
    const s = rt.session(runId);

    expect(s.beginStep("p").ok).toBe(true);
    s.completeStep("p");
    expect(s.beginStep("c").ok).toBe(false);
    s.resolveGate({ stepId: "p", gate: "PAUSE_AFTER", decision: "approved" });
    expect(s.beginStep("c").ok).toBe(true);
  });
});

describe("RunBundle integrity", () => {
  it("roundtrips stable serialization + integrity", async () => {
    const rt = new WorkbenchRuntime();
    const wf = {
      id: "wf",
      version: 1,
      steps: [{ id: "a", gatePolicy: "AUTO" as const }],
      edges: [],
    };
    const { runId } = rt.startRun({ workflow: wf });
    const s = rt.session(runId);
    s.annotate({ text: "x" });
    const bundle = await s.exportRunBundle();
    const json = serializeRunBundle(bundle);
    const back = deserializeRunBundle(json);
    expect(await verifyRunBundleIntegrity(back)).toBe(true);

    const broken = structuredClone(bundle);
    broken.run.tags = ["tampered"];
    expect(await verifyRunBundleIntegrity(broken)).toBe(false);

    const reSigned = await attachRunBundleIntegrity(broken);
    expect(await verifyRunBundleIntegrity(reSigned)).toBe(true);
  });
});

describe("WorkbenchRuntime import/export", () => {
  it("importRunBundle roundtrips a full export", async () => {
    const rt = new WorkbenchRuntime();
    const wf = {
      id: "wf",
      version: 1,
      steps: [{ id: "a", gatePolicy: "AUTO" as const }],
      edges: [],
    };
    const { runId } = rt.startRun({ workflow: wf });
    rt.session(runId).annotate({ text: "note" });
    const bundle = await rt.session(runId).exportRunBundle({ profile: "full" });
    const json = serializeRunBundle(bundle);

    const rt2 = new WorkbenchRuntime();
    const { runId: id2 } = await rt2.importRunBundle({ json });
    expect(id2).toBe(bundle.run.id);
    expect(rt2.getState(id2)?.trace.length).toBe(bundle.trace.length);
    expect(await verifyRunBundleIntegrity(bundle)).toBe(true);
  });

  it("user export strips sensitive trace payloads and redacts artifacts", async () => {
    const registry = new SchemaRegistry();
    registry.registerArtifactType({
      id: "t",
      exportRedactPaths: ["/x"],
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { x: { type: "string" } },
        required: ["x"],
      },
    });

    const rt = new WorkbenchRuntime();
    const wf = { id: "wf", version: 1, steps: [{ id: "a", gatePolicy: "AUTO" as const }], edges: [] };
    const { runId } = rt.startRun({
      workflow: wf,
      initialArtifacts: [{ artifact: { artifactKey: "doc", typeId: "t", data: { x: "secret" } } }],
    });
    const s = rt.session(runId);
    s.logModelIO({ direction: "request", summary: "s", payload: { z: 1 }, detail: "full" });
    s.logToolCall({ name: "tool", args: { a: 1 }, result: { b: 2 } });

    const user = await s.exportRunBundle({ profile: "user", registry, includeEngine: false });
    const lastIo = [...user.trace].reverse().find((e) => e.type === "model_io");
    expect(lastIo && "payload" in lastIo ? (lastIo as { payload?: unknown }).payload : undefined).toBeUndefined();

    const tool = user.trace.find((e) => e.type === "tool_call") as { args?: unknown; result?: unknown } | undefined;
    expect(tool?.args).toBeUndefined();
    expect(tool?.result).toBeUndefined();

    const art = user.artifacts.find((a) => a.artifactKey === "doc");
    expect(JSON.stringify(art?.data)).toContain("REDACTED");
  });
});

describe("model I/O telemetry", () => {
  it("stores structured subject and metadata on runs", () => {
    const rt = new WorkbenchRuntime();
    const wf = {
      id: "wf",
      version: 1,
      steps: [{ id: "a", gatePolicy: "AUTO" as const }],
      edges: [],
    };
    const { runId } = rt.startRun({
      workflow: wf,
      subject: { userId: "user_1", tenantId: "team_1", planId: "pro" },
      metadata: { environment: "test", seats: 3 },
    });

    expect(rt.getState(runId)?.run.subject).toEqual({ userId: "user_1", tenantId: "team_1", planId: "pro" });
    expect(rt.getState(runId)?.run.metadata).toEqual({ environment: "test", seats: 3 });
  });

  it("persists provider, model, usage, cost, and duration on model trace events", () => {
    const rt = new WorkbenchRuntime();
    const wf = {
      id: "wf",
      version: 1,
      steps: [{ id: "a", gatePolicy: "AUTO" as const }],
      edges: [],
    };
    const { runId } = rt.startRun({ workflow: wf });
    const s = rt.session(runId);

    s.logModelIO({
      direction: "response",
      provider: "openai",
      model: "gpt-example",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      cost: { amount: 0.001, currency: "USD" },
      durationMs: 125,
      summary: "ok",
    });

    const event = rt.getState(runId)?.trace.find((e) => e.type === "model_io");
    expect(event).toMatchObject({
      provider: "openai",
      model: "gpt-example",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      cost: { amount: 0.001, currency: "USD" },
      durationMs: 125,
    });
  });
});

describe("WorkbenchRuntime lifecycle", () => {
  const wf = { id: "wf", version: 1, steps: [{ id: "a", gatePolicy: "AUTO" as const }], edges: [] };

  it("listRuns reflects startRun and deleteRun", () => {
    const rt = new WorkbenchRuntime();
    const a = rt.startRun({ workflow: wf }).runId;
    const b = rt.startRun({ workflow: wf }).runId;
    expect(rt.listRuns().sort()).toEqual([a, b].sort());
    expect(rt.deleteRun(a)).toBe(true);
    expect(rt.deleteRun(a)).toBe(false);
    expect(rt.listRuns()).toEqual([b]);
  });

  it("session() throws UNKNOWN_RUN for missing runs", () => {
    const rt = new WorkbenchRuntime();
    expect(() => rt.session("nope")).toThrow(/Unknown runId/);
  });
});
