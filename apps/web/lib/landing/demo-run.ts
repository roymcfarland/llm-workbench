import { WorkbenchRuntime, type RunStoreState } from "@llm-workbench/runtime";

import { stateToSerialized, type SerializedRun } from "@/lib/supabase/runs-store";
import { getScenario } from "./scenarios";

/**
 * Build a seeded sample run so the public `/runs/demo` page renders the exact
 * same surface the auth-gated `/runs/[runId]` page would show — minus auth and
 * persistence. Pass a scenario id to pin shareable/verification URLs; omit it
 * to rotate through the public demo scenarios.
 *
 * NOTE: ids and timestamps inside the run are non-deterministic because the
 * runtime mints them from `Date.now()` and a counter. That is acceptable for
 * a demo; the bundle still validates and renders identically.
 */
export function buildDemoRunSerialized(scenarioId?: string): {
  runId: string;
  serialized: SerializedRun;
  title: string;
  blurb: string;
} {
  const runtime = new WorkbenchRuntime();
  const scenario = getScenario(scenarioId);
  const runId = scenario.build(runtime);

  const state: RunStoreState = runtime.getState(runId)!;
  return {
    runId,
    serialized: stateToSerialized(state),
    title: scenario.title,
    blurb: scenario.blurb,
  };
}
