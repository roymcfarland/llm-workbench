import type { WorkbenchRuntime } from "@llm-workbench/runtime";
import { useSyncExternalStore } from "react";

/**
 * Tiny adapter: subscribe to a run’s monotonic `revision` counter for React rendering.
 *
 * @param runtime The runtime instance owning the run's state.
 * @param runId The run to watch, or `null` to stay unsubscribed.
 * @returns The run's current `revision` counter, or `-1` when `runId` is
 *   `null`, the run is unknown, or during server-side rendering.
 */
export function useWorkbenchRunRevision(runtime: WorkbenchRuntime, runId: string | null): number {
  return useSyncExternalStore(
    (cb) => {
      if (!runId) return () => {};
      return runtime.subscribe(runId, cb);
    },
    () => (runId ? (runtime.getState(runId)?.revision ?? -1) : -1),
    () => -1,
  );
}
