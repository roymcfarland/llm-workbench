import { WorkbenchRuntime } from "@llm-workbench/runtime";
import { render, screen, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWorkbenchRunRevision } from "./useWorkbenchRunRevision.js";

function Probe(props: { runtime: WorkbenchRuntime; runId: string }) {
  const rev = useWorkbenchRunRevision(props.runtime, props.runId);
  return <div data-testid="rev">{rev}</div>;
}

describe("useWorkbenchRunRevision", () => {
  it("re-renders when trace events append", async () => {
    const rt = new WorkbenchRuntime();
    const wf = {
      id: "wf",
      version: 1,
      steps: [{ id: "a", gatePolicy: "AUTO" as const }],
      edges: [],
    };
    const { runId } = rt.startRun({ workflow: wf });
    render(<Probe runtime={rt} runId={runId} />);
    const before = Number(screen.getByTestId("rev").textContent);

    await act(async () => {
      rt.session(runId).annotate({ text: "hello" });
    });
    const after = Number(screen.getByTestId("rev").textContent);
    expect(after).toBeGreaterThan(before);
  });
});
