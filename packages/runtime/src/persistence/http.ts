import { WorkbenchError } from "../errors.js";
import type { RunRepository, SavedRunMeta } from "./types.js";
import type { RunStoreState } from "../runtime/types.js";

export type HttpRunRepositoryOptions = {
  baseUrl: string;
  /**
   * Return headers for each request. Use this to attach `Authorization`, cookies via `credentials`,
   * or signed headers. The workbench runtime does not interpret these values.
   */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  fetchImpl?: typeof fetch;
};

/**
 * Minimal REST adapter expecting:
 * - `PUT ${baseUrl}/runs/:runId` body: JSON serialized `RunStoreState`
 * - `GET ${baseUrl}/runs/:runId`
 * - `GET ${baseUrl}/runs?limit=...`
 * - `DELETE ${baseUrl}/runs/:runId`
 *
 * The host server must enforce authZ/authN.
 */
export class HttpRunRepository implements RunRepository {
  constructor(private readonly opts: HttpRunRepositoryOptions) {}

  private async headers(): Promise<Record<string, string>> {
    const extra = (await this.opts.getHeaders?.()) ?? {};
    return { "content-type": "application/json", ...extra };
  }

  private get fetchFn(): typeof fetch {
    return this.opts.fetchImpl ?? fetch;
  }

  async save(state: RunStoreState): Promise<void> {
    const url = `${this.opts.baseUrl.replace(/\/$/, "")}/runs/${encodeURIComponent(state.run.id)}`;
    const res = await this.fetchFn(url, {
      method: "PUT",
      headers: await this.headers(),
      body: JSON.stringify(serializeState(state)),
    });
    if (!res.ok) {
      const body = await safeReadBody(res);
      throw new WorkbenchError("HTTP_ERROR", `HttpRunRepository.save failed: ${res.status} ${body}`);
    }
  }

  async load(runId: string): Promise<RunStoreState | null> {
    const url = `${this.opts.baseUrl.replace(/\/$/, "")}/runs/${encodeURIComponent(runId)}`;
    const res = await this.fetchFn(url, { headers: await this.headers() });
    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await safeReadBody(res);
      throw new WorkbenchError("HTTP_ERROR", `HttpRunRepository.load failed: ${res.status} ${body}`);
    }
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      throw new WorkbenchError("HTTP_INVALID_JSON", "HttpRunRepository.load: response is not valid JSON", e);
    }
    return deserializeState(json);
  }

  async list(opts?: { limit?: number }): Promise<SavedRunMeta[]> {
    const limit = opts?.limit ?? 100;
    const url = `${this.opts.baseUrl.replace(/\/$/, "")}/runs?limit=${encodeURIComponent(String(limit))}`;
    const res = await this.fetchFn(url, { headers: await this.headers() });
    if (!res.ok) {
      const body = await safeReadBody(res);
      throw new WorkbenchError("HTTP_ERROR", `HttpRunRepository.list failed: ${res.status} ${body}`);
    }
    const text = await res.text();
    try {
      return text ? (JSON.parse(text) as SavedRunMeta[]) : [];
    } catch (e) {
      throw new WorkbenchError("HTTP_INVALID_JSON", "HttpRunRepository.list: response is not valid JSON", e);
    }
  }

  async delete(runId: string): Promise<void> {
    const url = `${this.opts.baseUrl.replace(/\/$/, "")}/runs/${encodeURIComponent(runId)}`;
    const res = await this.fetchFn(url, { method: "DELETE", headers: await this.headers() });
    if (!res.ok) {
      const body = await safeReadBody(res);
      throw new WorkbenchError("HTTP_ERROR", `HttpRunRepository.delete failed: ${res.status} ${body}`);
    }
  }
}

async function safeReadBody(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t.length > 500 ? `${t.slice(0, 500)}…` : t;
  } catch {
    return "";
  }
}

type SerializedRun = {
  revision: number;
  run: RunStoreState["run"];
  trace: RunStoreState["trace"];
  artifactsByKey: Array<[string, unknown]>;
  ruleSetsById: Array<[string, unknown]>;
  stepStatus: Array<[string, string]>;
  gateState: Array<[string, unknown]>;
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

function deserializeState(json: unknown): RunStoreState {
  const row = json as SerializedRun;
  return {
    revision: row.revision ?? 0,
    run: row.run,
    trace: row.trace,
    artifactsByKey: new Map(row.artifactsByKey as unknown as RunStoreState["artifactsByKey"]),
    ruleSetsById: new Map(row.ruleSetsById as unknown as RunStoreState["ruleSetsById"]),
    stepStatus: new Map(row.stepStatus) as RunStoreState["stepStatus"],
    gateState: new Map(row.gateState as unknown as RunStoreState["gateState"]),
    idempotency: new Map(row.idempotency),
  };
}
