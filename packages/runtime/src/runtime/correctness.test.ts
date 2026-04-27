import { describe, expect, it } from "vitest";
import { buildUserExportBundle } from "../export/userBundle.js";
import { SchemaRegistry } from "../schema/registry.js";
import { WorkbenchRuntime } from "./workbench.js";

const wf = {
  id: "wf",
  version: 1,
  steps: [{ id: "a", gatePolicy: "AUTO" as const }],
  edges: [],
};

describe("failStep failFast option", () => {
  it("by default leaves the run running so the host can recover", () => {
    const rt = new WorkbenchRuntime();
    const { runId } = rt.startRun({ workflow: wf });
    const s = rt.session(runId);
    s.beginStep("a");
    s.failStep("a", { message: "transient" });
    expect(rt.getState(runId)?.run.status).toBe("running");
    const fatal = rt.getState(runId)?.trace.find((e) => e.type === "error");
    expect(fatal && "fatal" in fatal && fatal.fatal).toBe(false);
  });

  it("failFast: true transitions the run to failed and emits a fatal error trace", () => {
    const rt = new WorkbenchRuntime();
    const { runId } = rt.startRun({ workflow: wf });
    const s = rt.session(runId);
    s.beginStep("a");
    s.failStep("a", { message: "boom", code: "FATAL" }, { failFast: true });
    expect(rt.getState(runId)?.run.status).toBe("failed");
    const fatal = rt.getState(runId)?.trace.find((e) => e.type === "error");
    expect(fatal && "fatal" in fatal && fatal.fatal).toBe(true);
  });
});

describe("buildUserExportBundle", () => {
  it("drops run.metadata by default and keeps it when keepMetadata: true", async () => {
    const rt = new WorkbenchRuntime();
    const { runId } = rt.startRun({
      workflow: wf,
      metadata: { secretFlag: true, internalNote: "do not expose" },
    });
    const s = rt.session(runId);
    s.beginStep("a");
    s.completeStep("a");
    s.completeRun();

    const reg = new SchemaRegistry();
    const full = await s.exportRunBundle();

    const redacted = buildUserExportBundle(full, reg);
    expect(redacted.run.metadata).toBeUndefined();

    const kept = buildUserExportBundle(full, reg, { keepMetadata: true });
    expect(kept.run.metadata).toEqual({ secretFlag: true, internalNote: "do not expose" });
  });
});
