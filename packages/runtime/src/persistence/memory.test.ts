import { describe, expect, it } from "vitest";
import { MemoryRunRepository } from "./memory.js";
import { WorkbenchRuntime } from "../runtime/workbench.js";

describe("MemoryRunRepository", () => {
  it("roundtrips RunStoreState", async () => {
    const repo = new MemoryRunRepository();
    const rt = new WorkbenchRuntime();
    const wf = { id: "wf", version: 1, steps: [{ id: "a", gatePolicy: "AUTO" as const }], edges: [] };
    const { runId } = rt.startRun({ workflow: wf });
    rt.session(runId).annotate({ text: "x" });

    const state = rt.getState(runId)!;
    await repo.save(state);
    const loaded = await repo.load(runId);
    expect(loaded?.revision).toBe(state.revision);
    expect(loaded?.trace.length).toBe(state.trace.length);
  });
});
