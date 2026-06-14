import { WorkbenchRuntime } from "@llm-workbench/runtime";
import { describe, expect, it } from "vitest";

import {
  serializedToState,
  stateToSerialized,
} from "@/lib/supabase/runs-store";
import { demoScenarios, getScenario } from ".";

describe("beloved-story demo scenarios", () => {
  it.each(demoScenarios)("$id builds a completed serialized run", (scenario) => {
    const runtime = new WorkbenchRuntime();
    const runId = scenario.build(runtime);
    const state = runtime.getState(runId);

    expect(runId).toBeTruthy();
    expect(state).toBeTruthy();

    const serialized = stateToSerialized(state!);
    const roundTripped = serializedToState(serialized);

    expect(roundTripped.run.status).toBe("completed");
    expect(roundTripped.run.workflowSnapshot.steps.length).toBeGreaterThanOrEqual(3);
    expect(
      roundTripped.trace.some((event) => event.type === "human_gate_resolved"),
    ).toBe(true);
  });

  it("returns a pinned scenario by id", () => {
    expect(getScenario("ring").id).toBe("ring");
  });

  it("returns one of the seeded scenarios when no id is supplied", () => {
    const ids = new Set(demoScenarios.map((scenario) => scenario.id));

    expect(ids.has(getScenario(undefined).id)).toBe(true);
  });
});
