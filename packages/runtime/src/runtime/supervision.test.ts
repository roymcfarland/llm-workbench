import { describe, expect, it, vi } from "vitest";
import { WorkbenchRuntime } from "./workbench.js";
import { buildAgentChildStartInput, buildForkStartInput } from "../host/fork.js";
import { RunContextRefSchema, getParentRunIds } from "../protocol/run.js";

const baseWorkflow = {
  id: "wf",
  version: 1,
  steps: [{ id: "only", gatePolicy: "AUTO" as const }],
  edges: [],
};

describe("RunContextRef supervision schema", () => {
  it("accepts singular parentRunId", () => {
    const parsed = RunContextRefSchema.parse({ parentRunId: "run_a" });
    expect(getParentRunIds(parsed)).toEqual(["run_a"]);
  });

  it("accepts plural parentRunIds without singular", () => {
    const parsed = RunContextRefSchema.parse({ parentRunIds: ["run_a", "run_b"] });
    expect(getParentRunIds(parsed)).toEqual(["run_a", "run_b"]);
  });

  it("accepts both when parentRunIds[0] === parentRunId", () => {
    const parsed = RunContextRefSchema.parse({
      parentRunId: "run_a",
      parentRunIds: ["run_a", "run_b"],
    });
    expect(getParentRunIds(parsed)).toEqual(["run_a", "run_b"]);
  });

  it("rejects mismatch between singular and parentRunIds[0]", () => {
    const result = RunContextRefSchema.safeParse({
      parentRunId: "run_x",
      parentRunIds: ["run_a"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty context (neither singular nor plural)", () => {
    const result = RunContextRefSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty parentRunIds array", () => {
    const result = RunContextRefSchema.safeParse({ parentRunIds: [] });
    expect(result.success).toBe(false);
  });
});

describe("buildForkStartInput writes both singular and plural parent linkage", () => {
  it("writes parentRunId === parentRunIds[0]", () => {
    const rt = new WorkbenchRuntime();
    const { runId: parentId } = rt.startRun({ workflow: baseWorkflow });
    const parent = rt.getState(parentId)!;
    const childInput = buildForkStartInput(parent);
    expect(childInput.context?.parentRunId).toBe(parentId);
    expect(childInput.context?.parentRunIds).toEqual([parentId]);
  });
});

describe("buildAgentChildStartInput supports multiple parents", () => {
  it("preserves parent order and aliases parentRunId to first", () => {
    const rt = new WorkbenchRuntime();
    const { runId: a } = rt.startRun({ workflow: baseWorkflow });
    const { runId: b } = rt.startRun({ workflow: baseWorkflow });
    const child = buildAgentChildStartInput({
      parents: [rt.getState(a)!, rt.getState(b)!],
      workflow: baseWorkflow,
    });
    expect(child.context?.parentRunId).toBe(a);
    expect(child.context?.parentRunIds).toEqual([a, b]);
  });

  it("rejects empty parents", () => {
    expect(() =>
      buildAgentChildStartInput({ parents: [], workflow: baseWorkflow }),
    ).toThrow();
  });
});

describe("WorkbenchRuntime.runChildrenOf and cancelRunCascade", () => {
  it("finds children via singular parent linkage", () => {
    const rt = new WorkbenchRuntime();
    const { runId: parent } = rt.startRun({ workflow: baseWorkflow });
    const { runId: child } = rt.startRun(
      buildForkStartInput(rt.getState(parent)!),
    );
    expect(rt.runChildrenOf(parent)).toEqual([child]);
  });

  it("finds children via plural parentRunIds linkage", () => {
    const rt = new WorkbenchRuntime();
    const { runId: a } = rt.startRun({ workflow: baseWorkflow });
    const { runId: b } = rt.startRun({ workflow: baseWorkflow });
    const { runId: child } = rt.startRun(
      buildAgentChildStartInput({
        parents: [rt.getState(a)!, rt.getState(b)!],
        workflow: baseWorkflow,
      }),
    );
    expect(rt.runChildrenOf(a)).toContain(child);
    expect(rt.runChildrenOf(b)).toContain(child);
  });

  it("cascades cancellation to all descendants", () => {
    const rt = new WorkbenchRuntime();
    const { runId: root } = rt.startRun({ workflow: baseWorkflow });
    const { runId: childA } = rt.startRun(buildForkStartInput(rt.getState(root)!));
    const { runId: childB } = rt.startRun(buildForkStartInput(rt.getState(root)!));
    const { runId: grandchild } = rt.startRun(
      buildForkStartInput(rt.getState(childA)!),
    );

    const cancelled = rt.cancelRunCascade(root, { reason: "operator stop" });
    expect(cancelled.sort()).toEqual([root, childA, childB, grandchild].sort());
    for (const id of [root, childA, childB, grandchild]) {
      expect(rt.getState(id)?.run.status).toBe("cancelled");
    }
  });

  it("skips terminal runs and still cascades through them to their children", () => {
    const rt = new WorkbenchRuntime();
    const { runId: root } = rt.startRun({ workflow: baseWorkflow });
    const { runId: child } = rt.startRun(buildForkStartInput(rt.getState(root)!));
    rt.session(child).completeRun();
    const { runId: grandchild } = rt.startRun(buildForkStartInput(rt.getState(child)!));
    rt.cancelRunCascade(root);
    expect(rt.getState(root)?.run.status).toBe("cancelled");
    expect(rt.getState(child)?.run.status).toBe("completed");
    expect(rt.getState(grandchild)?.run.status).toBe("cancelled");
  });

  it("logs and skips runs that refuse cancellation while continuing the cascade", () => {
    const rt = new WorkbenchRuntime();
    const { runId: root } = rt.startRun({ workflow: baseWorkflow });
    const { runId: child } = rt.startRun(buildForkStartInput(rt.getState(root)!));
    const { runId: grandchild } = rt.startRun(buildForkStartInput(rt.getState(child)!));
    rt.session(child).beginStep("only");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const cancelled = rt.cancelRunCascade(root, { reason: "operator stop" });

      expect(errorSpy).toHaveBeenCalledWith(
        "[llm-workbench] cancelRunCascade: failed to cancel run",
        child,
        expect.anything(),
      );
      expect(cancelled).toContain(root);
      expect(cancelled).not.toContain(child);
      expect(cancelled).toContain(grandchild);
      expect(rt.getState(child)?.run.status).toBe("running");
      expect(rt.getState(grandchild)?.run.status).toBe("cancelled");
    } finally {
      errorSpy.mockRestore();
    }
  });
});
