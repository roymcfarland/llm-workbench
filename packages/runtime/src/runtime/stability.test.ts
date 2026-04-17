import type { Operation } from "fast-json-patch";
import { describe, expect, it, vi } from "vitest";
import { WorkbenchError } from "../errors.js";
import { parseRunBundleJson, serializeRunBundle } from "../protocol/bundle.js";
import { assertWorkflowStructuralInvariants } from "../protocol/workflowValidate.js";
import { HttpRunRepository } from "../persistence/http.js";
import { WorkbenchRuntime } from "./workbench.js";

describe("parseRunBundleJson", () => {
  it("throws WorkbenchError on invalid JSON", () => {
    expect(() => parseRunBundleJson("{")).toThrow(WorkbenchError);
    try {
      parseRunBundleJson("{");
    } catch (e) {
      expect(WorkbenchError.is(e) && e.code).toBe("INVALID_JSON");
    }
  });
});

describe("WorkbenchRuntime.startRun", () => {
  it("wraps Zod workflow validation as WorkbenchError", () => {
    const rt = new WorkbenchRuntime();
    expect(() =>
      rt.startRun({
        workflow: { id: "w", version: 1, steps: [], edges: [] } as never,
      }),
    ).toThrow(WorkbenchError);
    try {
      rt.startRun({ workflow: { id: "w", version: 1, steps: [], edges: [] } as never });
    } catch (e) {
      expect(WorkbenchError.is(e) && e.code).toBe("INVALID_WORKFLOW");
    }
  });
});

describe("assertWorkflowStructuralInvariants", () => {
  it("rejects duplicate step ids", () => {
    expect(() =>
      assertWorkflowStructuralInvariants({
        id: "w",
        version: 1,
        steps: [
          { id: "a", gatePolicy: "AUTO" },
          { id: "a", gatePolicy: "AUTO" },
        ],
        edges: [],
      }),
    ).toThrow(WorkbenchError);
  });

  it("rejects edges to unknown steps", () => {
    expect(() =>
      assertWorkflowStructuralInvariants({
        id: "w",
        version: 1,
        steps: [{ id: "a", gatePolicy: "AUTO" }],
        edges: [{ id: "e1", from: "a", to: "missing" }],
      }),
    ).toThrow(WorkbenchError);
  });

  it("rejects self-loop edges", () => {
    expect(() =>
      assertWorkflowStructuralInvariants({
        id: "w",
        version: 1,
        steps: [{ id: "a", gatePolicy: "AUTO" }],
        edges: [{ id: "e1", from: "a", to: "a" }],
      }),
    ).toThrow(WorkbenchError);
  });
});

describe("WorkbenchRuntime.importRunBundle", () => {
  it("throws MISSING_INTEGRITY when verifyIntegrity is true and bundle lacks a signature", async () => {
    const rt = new WorkbenchRuntime();
    const wf = { id: "wf", version: 1, steps: [{ id: "a", gatePolicy: "AUTO" as const }], edges: [] };
    const { runId } = rt.startRun({ workflow: wf });
    const bundle = await rt.session(runId).exportRunBundle({ profile: "full" });
    const unsigned = structuredClone(bundle);
    delete (unsigned as { integrity?: unknown }).integrity;
    const json = JSON.stringify(unsigned);
    await expect(rt.importRunBundle({ json })).rejects.toMatchObject({ code: "MISSING_INTEGRITY" });
  });

  it("throws INTEGRITY_MISMATCH when hash does not match", async () => {
    const rt = new WorkbenchRuntime();
    const wf = { id: "wf", version: 1, steps: [{ id: "a", gatePolicy: "AUTO" as const }], edges: [] };
    const { runId } = rt.startRun({ workflow: wf });
    const bundle = await rt.session(runId).exportRunBundle({ profile: "full" });
    const tampered = structuredClone(bundle);
    tampered.run.tags = ["x"];
    const json = serializeRunBundle(tampered);
    await expect(rt.importRunBundle({ json })).rejects.toMatchObject({ code: "INTEGRITY_MISMATCH" });
  });

  it("allows unsigned bundles when verifyIntegrity is false", async () => {
    const rt = new WorkbenchRuntime();
    const wf = { id: "wf", version: 1, steps: [{ id: "a", gatePolicy: "AUTO" as const }], edges: [] };
    const { runId } = rt.startRun({ workflow: wf });
    const bundle = await rt.session(runId).exportRunBundle({ profile: "full" });
    const unsigned = structuredClone(bundle);
    delete (unsigned as { integrity?: unknown }).integrity;
    const json = JSON.stringify(unsigned);
    const rt2 = new WorkbenchRuntime();
    const { runId: id2 } = await rt2.importRunBundle({ json, verifyIntegrity: false });
    expect(id2).toBe(bundle.run.id);
  });
});

describe("WorkbenchSession invariants", () => {
  it("completeStep requires running", async () => {
    const rt = new WorkbenchRuntime();
    const wf = { id: "wf", version: 1, steps: [{ id: "a", gatePolicy: "AUTO" as const }], edges: [] };
    const { runId } = rt.startRun({ workflow: wf });
    const s = rt.session(runId);
    await expect(async () => s.completeStep("a")).rejects.toMatchObject({ code: "INVALID_STATE_TRANSITION" });
  });

  it("detects idempotency key reuse across artifacts", () => {
    const rt = new WorkbenchRuntime();
    const wf = { id: "wf", version: 1, steps: [{ id: "a", gatePolicy: "AUTO" as const }], edges: [] };
    const { runId } = rt.startRun({ workflow: wf });
    const s = rt.session(runId);
    s.writeArtifact({ artifactKey: "x", typeId: "t", data: { v: 1 }, idempotencyKey: "k1" });
    expect(() => s.writeArtifact({ artifactKey: "y", typeId: "t", data: { v: 2 }, idempotencyKey: "k1" })).toThrow(
      WorkbenchError,
    );
  });

  it("rejects invalid JSON Patch", () => {
    const rt = new WorkbenchRuntime();
    const wf = { id: "wf", version: 1, steps: [{ id: "a", gatePolicy: "AUTO" as const }], edges: [] };
    const { runId } = rt.startRun({
      workflow: wf,
      initialArtifacts: [{ artifact: { artifactKey: "doc", typeId: "t", data: { n: 1 } } }],
    });
    const s = rt.session(runId);
    const patch: Operation[] = [{ op: "test", path: "/n", value: 99 }];
    expect(() => s.patchArtifact({ artifactKey: "doc", patch })).toThrow(WorkbenchError);
  });

  it("reorderRules rejects wrong count or duplicates", () => {
    const rt = new WorkbenchRuntime();
    const rs = {
      id: "rs",
      ruleSchemaId: "demoJobRule",
      rules: [{ id: "a", priority: 0, enabled: true, payload: { kind: "keyword" as const, value: "x" } }],
    };
    const wf = { id: "wf", version: 1, steps: [{ id: "s", gatePolicy: "AUTO" as const }], edges: [] };
    const { runId } = rt.startRun({ workflow: wf, ruleSets: [rs] });
    const s = rt.session(runId);
    expect(() => s.reorderRules({ ruleSetId: "rs", orderedRuleIds: [] })).toThrow(WorkbenchError);
    expect(() => s.reorderRules({ ruleSetId: "rs", orderedRuleIds: ["a", "a"] })).toThrow(WorkbenchError);
  });
});

describe("trace subscribers", () => {
  const wf = { id: "wf", version: 1, steps: [{ id: "a", gatePolicy: "AUTO" as const }], edges: [] };

  it("invokes onTraceListenerError and still runs other listeners", () => {
    const onErr = vi.fn();
    const rt = new WorkbenchRuntime({ onTraceListenerError: onErr });
    const { runId } = rt.startRun({ workflow: wf });
    let ok = 0;
    rt.subscribe(runId, () => {
      throw new Error("listener boom");
    });
    rt.subscribe(runId, () => {
      ok += 1;
    });
    rt.session(runId).annotate({ text: "x" });
    expect(ok).toBe(1);
    expect(onErr).toHaveBeenCalledTimes(1);
    const [err, ctx] = onErr.mock.calls[0]!;
    expect(err).toBeInstanceOf(Error);
    expect(ctx.runId).toBe(runId);
    expect(ctx.event.type).toBe("annotation");
  });

  it("falls back to console.error when no hook is set", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rt = new WorkbenchRuntime();
    const { runId } = rt.startRun({ workflow: wf });
    rt.subscribe(runId, () => {
      throw new Error("listener boom");
    });
    rt.session(runId).annotate({ text: "x" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("isolates hook failures from other listeners", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rt = new WorkbenchRuntime({
      onTraceListenerError: () => {
        throw new Error("hook boom");
      },
    });
    const { runId } = rt.startRun({ workflow: wf });
    let ok = 0;
    rt.subscribe(runId, () => {
      throw new Error("listener boom");
    });
    rt.subscribe(runId, () => {
      ok += 1;
    });
    rt.session(runId).annotate({ text: "x" });
    expect(ok).toBe(1);
    expect(spy).toHaveBeenCalledWith("[llm-workbench] onTraceListenerError hook threw", expect.any(Error));
    spy.mockRestore();
  });

  it("setOnTraceListenerError replaces the handler", () => {
    const first = vi.fn();
    const second = vi.fn();
    const rt = new WorkbenchRuntime({ onTraceListenerError: first });
    const { runId } = rt.startRun({ workflow: wf });
    rt.subscribe(runId, () => {
      throw new Error("x");
    });
    rt.session(runId).annotate({ text: "a" });
    expect(first).toHaveBeenCalledTimes(1);

    rt.setOnTraceListenerError(second);
    rt.session(runId).annotate({ text: "b" });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("HttpRunRepository", () => {
  it("surfaces HTTP failures with body snippet", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("nope", { status: 500, headers: { "content-type": "text/plain" } });
    const repo = new HttpRunRepository({ baseUrl: "http://example.test", fetchImpl });
    await expect(
      repo.save({
        revision: 0,
        run: {
          id: "r1",
          workflowId: "w",
          workflowVersion: 1,
          workflowSnapshot: { id: "w", version: 1, steps: [{ id: "a", gatePolicy: "AUTO" }], edges: [] },
          startedAt: new Date().toISOString(),
          status: "running",
        },
        trace: [],
        artifactsByKey: new Map(),
        ruleSetsById: new Map(),
        stepStatus: new Map([["a", "pending"]]),
        gateState: new Map(),
        idempotency: new Map(),
      }),
    ).rejects.toMatchObject({ code: "HTTP_ERROR" });
  });

  it("throws on invalid JSON for load", async () => {
    const fetchImpl: typeof fetch = async () => new Response("not-json", { status: 200 });
    const repo = new HttpRunRepository({ baseUrl: "http://example.test", fetchImpl });
    await expect(repo.load("x")).rejects.toMatchObject({ code: "HTTP_INVALID_JSON" });
  });
});
