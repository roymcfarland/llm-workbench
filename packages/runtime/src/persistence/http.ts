import { WorkbenchError } from "../errors.js";
import type { RunRepository, SavedRunMeta } from "./types.js";
import type { RunStoreState } from "../runtime/types.js";

export type HttpRetryOptions = {
  /** Maximum total attempts including the first try. Default: 3. Set to 1 to disable retries. */
  maxAttempts?: number;
  /** Base delay in ms between retries (exponential backoff: base * 2^attempt). Default: 250. */
  baseDelayMs?: number;
  /** Cap on backoff delay in ms. Default: 4_000. */
  maxDelayMs?: number;
};

export type HttpRunRepositoryOptions = {
  baseUrl: string;
  /**
   * Return headers for each request. Use this to attach `Authorization`, cookies via `credentials`,
   * or signed headers. The workbench runtime does not interpret these values.
   */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  fetchImpl?: typeof fetch;
  /** Per-request timeout in milliseconds. `0` or `undefined` disables the timeout. */
  timeoutMs?: number;
  /** Retry config for transient failures (network errors, 5xx, 429). Disable with `{ maxAttempts: 1 }`. */
  retry?: HttpRetryOptions;
  /** Sleeper hook. Useful for tests; defaults to `setTimeout`-based delay. */
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY: Required<HttpRetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 4_000,
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function isAbortError(e: unknown): boolean {
  return e instanceof Error && (e.name === "AbortError" || (e as { code?: string }).code === "ABORT_ERR");
}

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
  private readonly retry: Required<HttpRetryOptions>;

  constructor(private readonly opts: HttpRunRepositoryOptions) {
    this.retry = { ...DEFAULT_RETRY, ...(opts.retry ?? {}) };
  }

  private async headers(): Promise<Record<string, string>> {
    const extra = (await this.opts.getHeaders?.()) ?? {};
    return { "content-type": "application/json", ...extra };
  }

  private get fetchFn(): typeof fetch {
    return this.opts.fetchImpl ?? fetch;
  }

  private get sleep(): (ms: number) => Promise<void> {
    return this.opts.sleep ?? defaultSleep;
  }

  /**
   * Run a single HTTP attempt with timeout + caller-provided abort signal,
   * returning the raw `Response` (or throwing `WorkbenchError` on transport
   * failures). Retries are layered on top in `request()`.
   */
  private async attempt(
    url: string,
    init: RequestInit,
    callerSignal: AbortSignal | undefined,
  ): Promise<Response> {
    const timeoutMs = this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const internal = new AbortController();
    const onCallerAbort = () => internal.abort(callerSignal?.reason);
    if (callerSignal) {
      if (callerSignal.aborted) {
        throw new WorkbenchError("HTTP_ABORTED", "Request aborted before it was sent");
      }
      callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }
    const timer = timeoutMs > 0 ? setTimeout(() => internal.abort(new Error("timeout")), timeoutMs) : null;
    try {
      return await this.fetchFn(url, { ...init, signal: internal.signal });
    } catch (e) {
      if (callerSignal?.aborted) {
        throw new WorkbenchError("HTTP_ABORTED", "Request aborted by caller", e);
      }
      if (isAbortError(e) && timer) {
        throw new WorkbenchError(
          "HTTP_TIMEOUT",
          `Request to ${url} timed out after ${timeoutMs}ms`,
          e,
        );
      }
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
      if (callerSignal) callerSignal.removeEventListener("abort", onCallerAbort);
    }
  }

  /** Fetch with timeout + retry/backoff. Returns the final non-retried `Response`. */
  private async request(
    url: string,
    init: RequestInit,
    opts: { signal?: AbortSignal; retryOnStatus?: boolean } = {},
  ): Promise<Response> {
    const max = Math.max(1, this.retry.maxAttempts);
    let lastError: unknown;
    for (let attempt = 0; attempt < max; attempt++) {
      try {
        const res = await this.attempt(url, init, opts.signal);
        if (res.ok) return res;
        // 4xx never auto-retries; 5xx/429 do, unless caller opted out.
        if (opts.retryOnStatus && isTransientStatus(res.status) && attempt < max - 1) {
          await this.sleep(this.backoffMs(attempt));
          continue;
        }
        return res;
      } catch (e) {
        if (WorkbenchError.is(e) && (e.code === "HTTP_ABORTED")) throw e;
        lastError = e;
        if (attempt < max - 1) {
          await this.sleep(this.backoffMs(attempt));
          continue;
        }
        const msg = e instanceof Error ? e.message : String(e);
        if (WorkbenchError.is(e) && e.code === "HTTP_TIMEOUT") throw e;
        throw new WorkbenchError("HTTP_ERROR", `${init.method ?? "GET"} ${url} failed: ${msg}`, e);
      }
    }
    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new WorkbenchError("HTTP_ERROR", `${init.method ?? "GET"} ${url} failed: ${msg}`, lastError);
  }

  private backoffMs(attempt: number): number {
    const exp = this.retry.baseDelayMs * 2 ** attempt;
    return Math.min(exp, this.retry.maxDelayMs);
  }

  private url(path: string): string {
    return `${this.opts.baseUrl.replace(/\/$/, "")}${path}`;
  }

  async save(state: RunStoreState, opts?: { signal?: AbortSignal }): Promise<void> {
    if (!state?.run?.id) {
      throw new WorkbenchError("INVALID_INPUT", "HttpRunRepository.save requires state.run.id");
    }
    const url = this.url(`/runs/${encodeURIComponent(state.run.id)}`);
    const res = await this.request(
      url,
      {
        method: "PUT",
        headers: await this.headers(),
        body: JSON.stringify(serializeState(state)),
      },
      { signal: opts?.signal, retryOnStatus: true },
    );
    if (!res.ok) {
      const body = await safeReadBody(res);
      throw new WorkbenchError("HTTP_ERROR", `HttpRunRepository.save failed: ${res.status} ${body}`);
    }
  }

  async load(runId: string, opts?: { signal?: AbortSignal }): Promise<RunStoreState | null> {
    if (!runId) throw new WorkbenchError("INVALID_INPUT", "HttpRunRepository.load requires runId");
    const url = this.url(`/runs/${encodeURIComponent(runId)}`);
    const res = await this.request(
      url,
      { method: "GET", headers: await this.headers() },
      { signal: opts?.signal, retryOnStatus: true },
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await safeReadBody(res);
      throw new WorkbenchError("HTTP_ERROR", `HttpRunRepository.load failed: ${res.status} ${body}`);
    }
    const text = await res.text();
    if (!text) return null;
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new WorkbenchError("HTTP_INVALID_JSON", "HttpRunRepository.load: response is not valid JSON", e);
    }
    return deserializeState(json);
  }

  async list(opts?: { limit?: number; signal?: AbortSignal }): Promise<SavedRunMeta[]> {
    const limit = opts?.limit ?? 100;
    const url = this.url(`/runs?limit=${encodeURIComponent(String(limit))}`);
    const res = await this.request(
      url,
      { method: "GET", headers: await this.headers() },
      { signal: opts?.signal, retryOnStatus: true },
    );
    if (!res.ok) {
      const body = await safeReadBody(res);
      throw new WorkbenchError("HTTP_ERROR", `HttpRunRepository.list failed: ${res.status} ${body}`);
    }
    const text = await res.text();
    if (!text) return [];
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new WorkbenchError("HTTP_INVALID_JSON", "HttpRunRepository.list: response is not valid JSON", e);
    }
    if (!Array.isArray(json)) {
      throw new WorkbenchError(
        "HTTP_INVALID_JSON",
        `HttpRunRepository.list: expected JSON array, got ${typeof json}`,
      );
    }
    return json.filter(isSavedRunMeta);
  }

  async delete(runId: string, opts?: { signal?: AbortSignal }): Promise<void> {
    if (!runId) throw new WorkbenchError("INVALID_INPUT", "HttpRunRepository.delete requires runId");
    const url = this.url(`/runs/${encodeURIComponent(runId)}`);
    const res = await this.request(
      url,
      { method: "DELETE", headers: await this.headers() },
      { signal: opts?.signal, retryOnStatus: true },
    );
    if (!res.ok && res.status !== 404) {
      const body = await safeReadBody(res);
      throw new WorkbenchError("HTTP_ERROR", `HttpRunRepository.delete failed: ${res.status} ${body}`);
    }
  }
}

function isSavedRunMeta(v: unknown): v is SavedRunMeta {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.id === "string"
    && typeof obj.workflowId === "string"
    && typeof obj.startedAt === "string"
    && typeof obj.status === "string";
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
  if (!json || typeof json !== "object" || !("run" in (json as Record<string, unknown>))) {
    throw new WorkbenchError("HTTP_INVALID_JSON", "HttpRunRepository: response is not a serialized run");
  }
  const row = json as SerializedRun;
  return {
    revision: row.revision ?? 0,
    run: row.run,
    trace: Array.isArray(row.trace) ? row.trace : [],
    artifactsByKey: new Map(asEntries(row.artifactsByKey)) as RunStoreState["artifactsByKey"],
    ruleSetsById: new Map(asEntries(row.ruleSetsById)) as RunStoreState["ruleSetsById"],
    stepStatus: new Map(asEntries(row.stepStatus)) as RunStoreState["stepStatus"],
    gateState: new Map(asEntries(row.gateState)) as RunStoreState["gateState"],
    idempotency: new Map(asEntries(row.idempotency)) as RunStoreState["idempotency"],
  };
}

function asEntries<T>(v: unknown): Array<[string, T]> {
  return Array.isArray(v) ? (v as Array<[string, T]>) : [];
}
