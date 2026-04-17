import type { RunRepository, SavedRunMeta } from "./types.js";
import type { RunStoreState } from "../runtime/types.js";

export class MemoryRunRepository implements RunRepository {
  private store = new Map<string, RunStoreState>();

  async save(state: RunStoreState): Promise<void> {
    this.store.set(state.run.id, cloneState(state));
  }

  async load(runId: string): Promise<RunStoreState | null> {
    const s = this.store.get(runId);
    return s ? cloneState(s) : null;
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

function cloneState(s: RunStoreState): RunStoreState {
  return {
    ...s,
    revision: s.revision,
    trace: [...s.trace],
    artifactsByKey: new Map(s.artifactsByKey),
    ruleSetsById: new Map(s.ruleSetsById),
    stepStatus: new Map(s.stepStatus),
    gateState: new Map(s.gateState),
    idempotency: new Map(s.idempotency),
  };
}
