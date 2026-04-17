import type { RunStoreState } from "../runtime/types.js";

export type SavedRunMeta = {
  id: string;
  workflowId: string;
  startedAt: string;
  endedAt?: string;
  status: string;
  tags?: string[];
};

/**
 * Persistence port. **Authentication/authorization is always the host app's responsibility**
 * (attach cookies, bearer tokens, signed URLs, etc. in `HttpRunRepository` options).
 */
export interface RunRepository {
  save(state: RunStoreState): Promise<void>;
  load(runId: string): Promise<RunStoreState | null>;
  list(opts?: { limit?: number }): Promise<SavedRunMeta[]>;
  delete(runId: string): Promise<void>;
}
