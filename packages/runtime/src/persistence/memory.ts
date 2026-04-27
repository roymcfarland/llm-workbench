import type { RunRepository, SavedRunMeta } from "./types.js";
import type { RunStoreState } from "../runtime/types.js";
import { assertRunStoreStateStructuralInvariants, cloneRunStoreState } from "../runtime/state.js";

export class MemoryRunRepository implements RunRepository {
  private store = new Map<string, RunStoreState>();

  async save(state: RunStoreState): Promise<void> {
    assertRunStoreStateStructuralInvariants(state);
    this.store.set(state.run.id, cloneRunStoreState(state));
  }

  async load(runId: string): Promise<RunStoreState | null> {
    const s = this.store.get(runId);
    return s ? cloneRunStoreState(s) : null;
  }

  async list(opts?: { limit?: number }): Promise<SavedRunMeta[]> {
    const limit = opts?.limit ?? 100;
    const items = [...this.store.values()]
      .map((s) => metaFromState(s))
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    return items.slice(0, limit);
  }

  async delete(runId: string): Promise<void> {
    this.store.delete(runId);
  }
}

function metaFromState(s: RunStoreState): SavedRunMeta {
  return {
    id: s.run.id,
    workflowId: s.run.workflowId,
    startedAt: s.run.startedAt,
    endedAt: s.run.endedAt,
    status: s.run.status,
    tags: s.run.tags,
  };
}
