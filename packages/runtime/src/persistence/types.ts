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
 *
 * The optional `signal` argument lets callers cancel in-flight operations
 * (e.g. on component unmount). Implementations that cannot cancel should
 * still accept the option and ignore it.
 */
export interface RunRepository {
  save(state: RunStoreState, opts?: { signal?: AbortSignal }): Promise<void>;
  load(runId: string, opts?: { signal?: AbortSignal }): Promise<RunStoreState | null>;
  list(opts?: { limit?: number; signal?: AbortSignal }): Promise<SavedRunMeta[]>;
  delete(runId: string, opts?: { signal?: AbortSignal }): Promise<void>;
}
