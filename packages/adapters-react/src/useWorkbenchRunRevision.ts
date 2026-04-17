import type { WorkbenchRuntime } from "@llm-workbench/runtime";
import { useSyncExternalStore } from "react";

/**
 * Tiny adapter: subscribe to a run’s monotonic `revision` counter for React rendering.
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
