import { WorkbenchRuntime } from "@llm-workbench/runtime";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkflowGraph, layoutWorkflow } from "./WorkflowGraph.js";

// jsdom doesn't implement these layout APIs that React Flow probes on mount;
// stub minimal implementations so the component can render in tests.
function patchReactFlowJsdomGlobals() {
  if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverPolyfill {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: typeof ResizeObserverPolyfill }).ResizeObserver =
      ResizeObserverPolyfill;
  }
  if (!("DOMMatrixReadOnly" in globalThis)) {
    class DOMMatrixReadOnlyPolyfill {
      m22 = 1;
      constructor(_init?: unknown) {}
    }
    (globalThis as unknown as { DOMMatrixReadOnly: typeof DOMMatrixReadOnlyPolyfill }).DOMMatrixReadOnly =
      DOMMatrixReadOnlyPolyfill;
  }
  // React Flow measures elements via getBoundingClientRect; jsdom returns
  // zeros which is fine but we make sure offsetWidth/Height are non-zero so
  // it actually paints children.
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => 480,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: () => 800,
  });
}

patchReactFlowJsdomGlobals();

const workflow = {
  id: "wf-test",
  version: 1,
  title: "Test workflow",
  steps: [
    { id: "alpha", title: "Alpha", gatePolicy: "AUTO" as const, inputs: [], outputs: [] },
    { id: "beta", title: "Beta", gatePolicy: "AUTO" as const, inputs: [], outputs: [] },
    { id: "gamma", title: "Gamma", gatePolicy: "AUTO" as const, inputs: [], outputs: [] },
  ],
  edges: [
    { id: "e1", from: "alpha", to: "beta" },
    { id: "e2", from: "beta", to: "gamma" },
  ],
};

describe("layoutWorkflow", () => {
  it("produces a node per step with the expected status", () => {
    const statuses = new Map<string, "pending" | "running" | "completed" | "failed">([
      ["alpha", "completed"],
      ["beta", "running"],
      ["gamma", "pending"],
    ]);
    const { nodes, edges } = layoutWorkflow(workflow, statuses);
    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(2);
    expect(nodes.map((n) => n.id).sort()).toEqual(["alpha", "beta", "gamma"]);
    const beta = nodes.find((n) => n.id === "beta");
    expect(beta?.data.status).toBe("running");
    expect(beta?.data.label).toBe("Beta");
    // Edges flowing into/out of a running step should be animated.
    expect(edges.find((e) => e.id === "e1")?.animated).toBe(true);
  });

  it("falls back to pending when a step has no recorded status", () => {
    const { nodes } = layoutWorkflow(workflow, new Map());
    for (const node of nodes) {
      expect(node.data.status).toBe("pending");
    }
  });

  it("ignores edges referencing unknown steps", () => {
    const { edges } = layoutWorkflow(
      {
        ...workflow,
        edges: [
          ...workflow.edges,
          { id: "ghost", from: "alpha", to: "ghost-step" },
        ],
      },
      new Map(),
    );
    expect(edges.find((e) => e.id === "ghost")).toBeUndefined();
  });
});

describe("<WorkflowGraph />", () => {
  it("renders the empty state when no run is selected", () => {
    const rt = new WorkbenchRuntime();
    const { getByTestId } = render(<WorkflowGraph runtime={rt} runId={null} />);
    const root = getByTestId("workflow-graph-root");
    expect(root.textContent).toContain("No run selected");
  });

  it("renders a node per workflow step with the right status class", () => {
    const rt = new WorkbenchRuntime();
    const { runId } = rt.startRun({ workflow });
    const session = rt.session(runId);
    session.beginStep("alpha");
    session.completeStep("alpha");
    session.beginStep("beta");

    render(<WorkflowGraph runtime={rt} runId={runId} />);

    const nodes = screen.getAllByTestId("workflow-graph-node");
    expect(nodes).toHaveLength(3);

    const byId = new Map<string, HTMLElement>();
    for (const node of nodes) {
      const titleEl = node.querySelector(".lwb-workflow-graph__node-title");
      if (titleEl?.textContent) byId.set(titleEl.textContent, node);
    }

    expect(byId.get("Alpha")?.dataset.status).toBe("completed");
    expect(byId.get("Alpha")?.className).toContain("lwb-workflow-graph__node--completed");
    expect(byId.get("Beta")?.dataset.status).toBe("running");
    expect(byId.get("Beta")?.className).toContain("lwb-workflow-graph__node--running");
    expect(byId.get("Gamma")?.dataset.status).toBe("pending");
    expect(byId.get("Gamma")?.className).toContain("lwb-workflow-graph__node--pending");
  });
});
