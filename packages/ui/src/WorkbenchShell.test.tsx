import {
  SchemaRegistry,
  serializeRunBundle,
  type RunRepository,
  WorkbenchRuntime,
} from "@llm-workbench/runtime";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkbenchShell } from "./WorkbenchShell.js";

const NativeURL = URL;
const createObjectURL = vi.fn(() => "blob:mock");
const revokeObjectURL = vi.fn();

function createRegistry() {
  const registry = new SchemaRegistry();
  registry.registerArtifactType({
    id: "note",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  });
  registry.registerRulePayloadSchema({
    id: "testRule",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { type: "string" },
        value: { type: "string" },
      },
      required: ["kind", "value"],
    },
  });
  return registry;
}

function createHarness(seedData = true) {
  const registry = createRegistry();
  const runtime = new WorkbenchRuntime();
  const { runId } = runtime.startRun({
    workflow: {
      id: "wf",
      version: 1,
      title: "Test workflow",
      steps: [{ id: "a", gatePolicy: "AUTO" }],
      edges: [],
    },
    ...(seedData
      ? {
          initialArtifacts: [
            {
              artifact: {
                artifactKey: "note1",
                typeId: "note",
                data: { text: "hi" },
              },
            },
          ],
          ruleSets: [
            {
              id: "default",
              ruleSchemaId: "testRule",
              rules: [
                {
                  id: "r1",
                  priority: 0,
                  enabled: true,
                  label: "Rule one",
                  payload: { kind: "keyword", value: "alpha" },
                },
              ],
            },
          ],
        }
      : {}),
  });
  return { registry, runtime, runId, session: runtime.session(runId) };
}

function renderHarness(
  options: {
    seedData?: boolean;
    repo?: RunRepository;
    ruleSetId?: string;
    onActiveRunChange?: (runId: string) => void;
  } = {},
) {
  const { seedData = true, ...props } = options;
  const harness = createHarness(seedData);
  const view = render(
    <WorkbenchShell
      runtime={harness.runtime}
      runId={harness.runId}
      registry={harness.registry}
      {...props}
    />,
  );
  return { ...harness, ...view };
}

function selectArtifact() {
  fireEvent.change(screen.getByLabelText("Select artifact to edit"), {
    target: { value: "note1" },
  });
}

function getArtifactEditor() {
  return screen.getByLabelText("Artifact JSON") as HTMLTextAreaElement;
}

function getRuleInputs(dialog: HTMLElement) {
  const [label, payload] = within(dialog).getAllByRole("textbox");
  if (!label || !payload) throw new Error("Expected rule label and payload inputs");
  return {
    label: label as HTMLInputElement,
    payload: payload as HTMLTextAreaElement,
  };
}

function openAddRuleModal() {
  fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
  return screen.getByRole("dialog", { name: "Edit rule" });
}

function getFileInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Expected run bundle file input");
  return input;
}

function createRepository(): RunRepository {
  return {
    save: vi.fn<RunRepository["save"]>().mockResolvedValue(undefined),
    load: vi.fn<RunRepository["load"]>().mockResolvedValue(null),
    list: vi.fn<RunRepository["list"]>().mockResolvedValue([]),
    delete: vi.fn<RunRepository["delete"]>().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  class URLWithObjectUrls extends NativeURL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  }
  vi.stubGlobal("URL", URLWithObjectUrls);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("WorkbenchShell rendering and artifact editing", () => {
  it("renders only the empty state when no run is active", () => {
    render(
      <WorkbenchShell
        runtime={new WorkbenchRuntime()}
        runId=""
        registry={createRegistry()}
      />,
    );

    expect(screen.getByText("No active run.")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("renders the seeded artifact, rule, and non-zero trace event count", () => {
    const harness = createHarness();
    harness.session.beginStep("a");
    render(
      <WorkbenchShell
        runtime={harness.runtime}
        runId={harness.runId}
        registry={harness.registry}
      />,
    );

    const artifactSelect = screen.getByLabelText("Select artifact to edit");
    const traceLength = harness.runtime.getState(harness.runId)?.trace.length ?? 0;
    expect(within(artifactSelect).getByRole("option", { name: "note1" })).toBeTruthy();
    expect(screen.getByLabelText("Rule Rule one").getAttribute("data-rule-id")).toBe("r1");
    expect(traceLength).toBeGreaterThan(0);
    expect(screen.getByText(`${traceLength} event${traceLength === 1 ? "" : "s"}`)).toBeTruthy();
  });

  it("writes a schema-valid artifact into runtime state", async () => {
    const { container, runtime, runId } = renderHarness();
    selectArtifact();

    await waitFor(() => expect(getArtifactEditor().value).toContain('"text": "hi"'));
    fireEvent.change(getArtifactEditor(), {
      target: { value: JSON.stringify({ text: "updated" }) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Write artifact" }));

    expect(runtime.getState(runId)?.artifactsByKey.get("note1")?.data).toEqual({
      text: "updated",
    });
    expect(container.querySelector(".lwb-error")).toBeNull();
  });

  it("rejects malformed artifact JSON", () => {
    renderHarness();
    selectArtifact();
    fireEvent.change(getArtifactEditor(), { target: { value: "{" } });
    fireEvent.click(screen.getByRole("button", { name: "Write artifact" }));

    expect(screen.getByText("Artifact JSON is invalid.")).toBeTruthy();
  });

  it("shows schema validation errors for an invalid artifact", () => {
    const { container } = renderHarness();
    selectArtifact();
    fireEvent.change(getArtifactEditor(), {
      target: { value: JSON.stringify({ unexpected: true }) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Write artifact" }));

    const error = container.querySelector(".lwb-error");
    expect(error?.textContent?.trim()).toBeTruthy();
  });

  it("disables artifact writes until an artifact is selected", () => {
    renderHarness();

    expect((screen.getByRole("button", { name: "Write artifact" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe("WorkbenchShell rule management", () => {
  it("toggles a rule and updates its rendered state", () => {
    const { runtime, runId } = renderHarness();

    fireEvent.click(screen.getByTitle("Disable rule"));

    expect(runtime.getState(runId)?.ruleSetsById.get("default")?.rules[0]?.enabled).toBe(false);
    const toggle = screen.getByTitle("Enable rule");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("deletes a rule from the runtime and the rule list", () => {
    const { runtime, runId } = renderHarness();

    fireEvent.click(screen.getByLabelText("Delete rule Rule one"));

    expect(runtime.getState(runId)?.ruleSetsById.get("default")?.rules).toEqual([]);
    expect(screen.queryByLabelText("Rule Rule one")).toBeNull();
  });

  it("adds a schema-valid rule", async () => {
    const { runtime, runId } = renderHarness();
    const dialog = openAddRuleModal();
    const inputs = getRuleInputs(dialog);
    await waitFor(() => expect(inputs.payload.value).toContain('"kind": "keyword"'));

    fireEvent.change(inputs.label, { target: { value: "Rule two" } });
    fireEvent.change(inputs.payload, {
      target: { value: JSON.stringify({ kind: "keyword", value: "beta" }) },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save rule" }));

    expect(screen.queryByRole("dialog", { name: "Edit rule" })).toBeNull();
    expect(screen.getByLabelText("Rule Rule two")).toBeTruthy();
    expect(runtime.getState(runId)?.ruleSetsById.get("default")?.rules).toHaveLength(2);
  });

  it("keeps the modal open for malformed rule payload JSON", () => {
    renderHarness();
    const dialog = openAddRuleModal();
    fireEvent.change(getRuleInputs(dialog).payload, { target: { value: "{" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save rule" }));

    expect(within(dialog).getByText("Rule payload JSON is invalid.")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Edit rule" })).toBeTruthy();
  });

  it("keeps the modal open for a schema-invalid rule payload", () => {
    const { container } = renderHarness();
    const dialog = openAddRuleModal();
    fireEvent.change(getRuleInputs(dialog).payload, {
      target: { value: JSON.stringify({ kind: "keyword" }) },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save rule" }));

    expect(screen.getByRole("dialog", { name: "Edit rule" })).toBeTruthy();
    expect(container.querySelector(".lwb-modal .lwb-error")?.textContent?.trim()).toBeTruthy();
  });

  it("edits an existing rule with its current values pre-filled", async () => {
    const { runtime, runId } = renderHarness();
    fireEvent.click(screen.getByLabelText("Edit rule Rule one"));
    const dialog = screen.getByRole("dialog", { name: "Edit rule" });
    const inputs = getRuleInputs(dialog);

    await waitFor(() => expect(inputs.label.value).toBe("Rule one"));
    expect(JSON.parse(inputs.payload.value)).toEqual({ kind: "keyword", value: "alpha" });
    fireEvent.change(inputs.label, { target: { value: "Renamed rule" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save rule" }));

    expect(screen.getByLabelText("Rule Renamed rule")).toBeTruthy();
    expect(runtime.getState(runId)?.ruleSetsById.get("default")?.rules[0]?.label).toBe(
      "Renamed rule",
    );
  });

  it("cancels rule creation without changing runtime state", () => {
    const { runtime, runId } = renderHarness();
    const dialog = openAddRuleModal();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog", { name: "Edit rule" })).toBeNull();
    expect(runtime.getState(runId)?.ruleSetsById.get("default")?.rules).toHaveLength(1);
  });

  it("disables rule creation when the requested rule set is missing", () => {
    renderHarness({ ruleSetId: "missing" });

    expect(screen.getByText("No rule set loaded for id `missing`.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Add rule" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe("WorkbenchShell persistence and run bundles", () => {
  it("disables saving when no repository is provided", () => {
    renderHarness();

    expect((screen.getByRole("button", { name: "Save run" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("saves the current runtime state through the repository", async () => {
    const repo = createRepository();
    const { runtime, runId } = renderHarness({ repo });

    fireEvent.click(screen.getByRole("button", { name: "Save run" }));

    await waitFor(() => expect(repo.save).toHaveBeenCalledTimes(1));
    expect(repo.save).toHaveBeenCalledWith(runtime.getState(runId));
  });

  it("downloads an exported run bundle through an object URL", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderHarness({ seedData: false });

    fireEvent.click(screen.getByRole("button", { name: "Download run bundle" }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("imports an exported bundle and selects its run", async () => {
    const onActiveRunChange = vi.fn();
    const { container, session } = renderHarness({ seedData: false, onActiveRunChange });
    const bundle = await session.exportRunBundle();
    const file = new File([serializeRunBundle(bundle)], "bundle.json", {
      type: "application/json",
    });

    await act(async () => {
      fireEvent.change(getFileInput(container), { target: { files: [file] } });
      await Promise.resolve();
    });

    await waitFor(() => expect(onActiveRunChange).toHaveBeenCalledWith(bundle.run.id));
  });

  it("reports failed imports and clears the file input", async () => {
    const { container } = renderHarness();
    const input = getFileInput(container);
    Object.defineProperty(input, "value", {
      configurable: true,
      value: "C:\\fakepath\\invalid.json",
      writable: true,
    });
    const file = new File(["not valid json"], "invalid.json", {
      type: "application/json",
    });

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
      await Promise.resolve();
    });

    expect((await screen.findByText(/^Import failed:/)).textContent).toMatch(/^Import failed:/);
    expect(input.value).toBe("");
  });
});
