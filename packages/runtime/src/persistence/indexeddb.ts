import { WorkbenchError } from "../errors.js";
import type { RunRepository, SavedRunMeta } from "./types.js";
import type { RunStoreState } from "../runtime/types.js";

const DB_NAME = "llm-workbench";
const STORE = "runs";
const DB_VERSION = 1;

function getIndexedDb(): IDBFactory {
  const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!idb) {
    throw new WorkbenchError(
      "STORAGE_UNAVAILABLE",
      "IndexedDbRunRepository requires a browser environment with `indexedDB`",
    );
  }
  return idb;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = getIndexedDb().open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "run.id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB.open failed"));
    req.onblocked = () => reject(new Error("indexedDB.open blocked"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("indexedDB tx aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB tx error"));
  });
}

async function withDb<T>(work: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDb();
  try {
    return await work(db);
  } finally {
    db.close();
  }
}

/**
 * Browser persistence. Host apps should scope sensitive data to authenticated users
 * (separate DB per user profile, or encrypt payloads before storing).
 *
 * Use `IndexedDbRunRepository.isSupported()` before instantiating in code that may
 * also run on the server (Next.js, Remix, etc.) to avoid throwing at construction.
 */
export class IndexedDbRunRepository implements RunRepository {
  /** True when the current global has a usable `indexedDB` implementation. */
  static isSupported(): boolean {
    return typeof (globalThis as { indexedDB?: unknown }).indexedDB !== "undefined";
  }

  async save(state: RunStoreState): Promise<void> {
    await withDb(async (db) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(serializeState(state));
      await txDone(tx);
    });
  }

  async load(runId: string): Promise<RunStoreState | null> {
    return withDb(async (db) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(runId);
      const row = await new Promise<SerializedRun | undefined>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result as SerializedRun | undefined);
        req.onerror = () => reject(req.error ?? new Error("indexedDB get failed"));
      });
      await txDone(tx);
      return row ? deserializeState(row) : null;
    });
  }

  async list(opts?: { limit?: number }): Promise<SavedRunMeta[]> {
    const limit = opts?.limit ?? 100;
    return withDb(async (db) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.openCursor();
      const metas: SavedRunMeta[] = [];
      await new Promise<void>((resolve, reject) => {
        req.onerror = () => reject(req.error ?? new Error("indexedDB cursor failed"));
        req.onsuccess = () => {
          const cur = req.result;
          if (!cur) return resolve();
          const state = deserializeState(cur.value as SerializedRun);
          metas.push({
            id: state.run.id,
            workflowId: state.run.workflowId,
            startedAt: state.run.startedAt,
            endedAt: state.run.endedAt,
            status: state.run.status,
            tags: state.run.tags,
          });
          if (metas.length >= limit) return resolve();
          cur.continue();
        };
      });
      await txDone(tx);
      metas.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
      return metas.slice(0, limit);
    });
  }

  async delete(runId: string): Promise<void> {
    await withDb(async (db) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(runId);
      await txDone(tx);
    });
  }
}

type SerializedRun = {
  revision: number;
  run: RunStoreState["run"];
  trace: RunStoreState["trace"];
  artifactsByKey: Array<[string, RunStoreState["artifactsByKey"] extends Map<string, infer V> ? V : never]>;
  ruleSetsById: Array<[string, RunStoreState["ruleSetsById"] extends Map<string, infer V> ? V : never]>;
  stepStatus: Array<[string, string]>;
  gateState: Array<[string, RunStoreState["gateState"] extends Map<string, infer V> ? V : never]>;
  idempotency: Array<[string, { artifactKey: string; version: number }]>;
};

function serializeState(s: RunStoreState): SerializedRun {
  return {
    revision: s.revision,
    run: s.run,
    trace: s.trace,
    artifactsByKey: [...s.artifactsByKey.entries()],
    ruleSetsById: [...s.ruleSetsById.entries()],
    stepStatus: [...s.stepStatus.entries()],
    gateState: [...s.gateState.entries()],
    idempotency: [...s.idempotency.entries()],
  };
}

function deserializeState(row: SerializedRun): RunStoreState {
  return {
    revision: row.revision ?? 0,
    run: row.run,
    trace: Array.isArray(row.trace) ? row.trace : [],
    artifactsByKey: new Map(row.artifactsByKey),
    ruleSetsById: new Map(row.ruleSetsById),
    stepStatus: new Map(row.stepStatus) as RunStoreState["stepStatus"],
    gateState: new Map(row.gateState),
    idempotency: new Map(row.idempotency),
  };
}
