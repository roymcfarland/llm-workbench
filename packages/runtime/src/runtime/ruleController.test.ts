import { describe, expect, it, vi } from "vitest";
import { WorkbenchError } from "../errors.js";
import type { ArtifactVersion } from "../protocol/artifacts.js";
import type { RuleSet } from "../protocol/rules.js";
import type { TraceEvent } from "../protocol/trace.js";
import { TraceEventSchema } from "../protocol/trace.js";
import type { WorkflowSpec } from "../protocol/workflow.js";
import { WORKBENCH_PROTOCOL_VERSION } from "../protocol/version.js";
import { canStartStep } from "./readiness.js";
import { RuleController } from "./ruleController.js";
import { RunLifecycleController } from "./runLifecycleController.js";
import type { SessionContext } from "./sessionContext.js";
import type { RunStoreState } from "./types.js";
import { WorkbenchRuntime } from "./workbench.js";

const autoWorkflow = {
  id: "wf",
  version: 1,
  steps: [{ id: "a", gatePolicy: "AUTO" as const }],
  edges: [],
};

function expectWorkbenchError(fn: () => unknown, code: WorkbenchError["code"]) {
  try {
    fn();
  } catch (error) {
    expect(WorkbenchError.is(error)).toBe(true);
    if (!WorkbenchError.is(error)) return;
    expect(error.code).toBe(code);
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

function snapshotNonTraceState(state: RunStoreState) {
  return structuredClone({
    run: state.run,
    artifactsByKey: [...state.artifactsByKey.entries()],
    ruleSetsById: [...state.ruleSetsById.entries()],
    stepStatus: [...state.stepStatus.entries()],
    gateState: [...state.gateState.entries()],
    idempotency: [...state.idempotency.entries()],
  });
}

function ruleSet(id = "rs"): RuleSet {
  return {
    id,
    ruleSchemaId: "demoJobRule",
    rules: [
      {
        id: "a",
        priority: 0,
        enabled: true,
        payload: { kind: "keyword", value: "alpha" },
      },
      {
        id: "b",
        priority: 1,
        enabled: true,
        payload: { kind: "keyword", value: "beta" },
      },
      {
        id: "c",
        priority: 2,
        enabled: false,
        payload: { kind: "keyword", value: "gamma" },
      },
    ],
  };
}

function artifactVersion(): ArtifactVersion {
  return {
    artifactKey: "doc",
    typeId: "json",
    version: 1,
    createdAt: "2026-06-12T00:00:00.000Z",
    data: { count: 1 },
  };
}

function makeHarness(workflow: WorkflowSpec = autoWorkflow) {
  const runtime = new WorkbenchRuntime();
  const { runId } = runtime.startRun({ workflow });
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
  };
  const lifecycle = new RunLifecycleController(ctx);

  return {
    state,
    rules: new RuleController(ctx, lifecycle),
  };
}

describe("RuleController", () => {
  it("replaceRuleSet stores and overwrites rule sets while appending rule_changed", () => {
    const { rules, state } = makeHarness();
    const first = ruleSet();
    const replacement = {
      ...ruleSet(),
      rules: [
        {
          id: "z",
          priority: 0,
          enabled: true,
          payload: { kind: "keyword", value: "zeta" },
        },
      ],
    };

    rules.replaceRuleSet(first);
    rules.replaceRuleSet(replacement);

    expect(state.ruleSetsById.get("rs")).toBe(replacement);
    const changed = eventsOfType(state.trace, "rule_changed");
    expect(changed).toHaveLength(2);
    expect(changed[0]).toMatchObject({
      id: "evt_1",
      ruleSetId: "rs",
      snapshot: first,
    });
    expect(changed[1]).toMatchObject({
      id: "evt_2",
      ruleSetId: "rs",
      snapshot: replacement,
    });
  });

  it("reorderRules applies a valid permutation, renumbers priorities, and appends rule_changed", () => {
    const { rules, state } = makeHarness();
    state.ruleSetsById.set("rs", ruleSet());

    rules.reorderRules({ ruleSetId: "rs", orderedRuleIds: ["c", "a", "b"] });

    expect(state.ruleSetsById.get("rs")?.rules.map(({ id, priority }) => ({ id, priority }))).toEqual([
      { id: "c", priority: 0 },
      { id: "a", priority: 1 },
      { id: "b", priority: 2 },
    ]);
    const changed = eventsOfType(state.trace, "rule_changed");
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({
      ruleSetId: "rs",
      snapshot: {
        id: "rs",
        rules: [
          expect.objectContaining({ id: "c", priority: 0 }),
          expect.objectContaining({ id: "a", priority: 1 }),
          expect.objectContaining({ id: "b", priority: 2 }),
        ],
      },
    });
  });

  it("reorderRules rejects unknown rule sets and unknown rule ids", () => {
    const { rules, state } = makeHarness();

    expectWorkbenchError(
      () => rules.reorderRules({ ruleSetId: "missing", orderedRuleIds: ["a"] }),
      "UNKNOWN_RULESET",
    );

    state.ruleSetsById.set("rs", ruleSet());
    expectWorkbenchError(
      () => rules.reorderRules({ ruleSetId: "rs", orderedRuleIds: ["a", "missing", "c"] }),
      "INVALID_INPUT",
    );
  });

  it("annotate appends annotation without mutating run state", () => {
    const { rules, state } = makeHarness();
    state.ruleSetsById.set("rs", ruleSet());
    state.artifactsByKey.set("doc", artifactVersion());
    const before = snapshotNonTraceState(state);

    rules.annotate({ text: "reviewed manually", tags: ["review", "policy"] });

    expect(snapshotNonTraceState(state)).toEqual(before);
    expect(eventsOfType(state.trace, "annotation")).toContainEqual(
      expect.objectContaining({
        id: "evt_1",
        runId: state.run.id,
        text: "reviewed manually",
        tags: ["review", "policy"],
      }),
    );
  });

  it("forkNotice appends run_forked without mutating run state", () => {
    const { rules, state } = makeHarness();
    state.ruleSetsById.set("rs", ruleSet());
    state.artifactsByKey.set("doc", artifactVersion());
    const before = snapshotNonTraceState(state);

    rules.forkNotice("run_parent", "a");

    expect(snapshotNonTraceState(state)).toEqual(before);
    expect(eventsOfType(state.trace, "run_forked")).toContainEqual(
      expect.objectContaining({
        id: "evt_1",
        runId: state.run.id,
        parentRunId: "run_parent",
        forkedFromStepId: "a",
      }),
    );
  });
});
