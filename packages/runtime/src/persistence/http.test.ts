import { describe, expect, it, vi } from "vitest";
import { WorkbenchError } from "../errors.js";
import { HttpRunRepository } from "./http.js";
import type { RunStoreState } from "../runtime/types.js";

function buildState(): RunStoreState {
  return {
    revision: 0,
    run: {
      id: "r1",
      workflowId: "w",
      workflowVersion: 1,
      workflowSnapshot: {
        id: "w",
        version: 1,
        steps: [{ id: "a", gatePolicy: "AUTO" }],
        edges: [],
      },
      startedAt: new Date().toISOString(),
      status: "running",
    },
    trace: [],
    artifactsByKey: new Map(),
    ruleSetsById: new Map(),
    stepStatus: new Map([["a", "pending"]]),
    gateState: new Map(),
    idempotency: new Map(),
  };
}

describe("HttpRunRepository retry/backoff", () => {
  it("retries 5xx responses up to maxAttempts and returns the final body on success", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      if (calls < 3) return new Response("server fail", { status: 503 });
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };
    const sleep = vi.fn(async () => {});
    const repo = new HttpRunRepository({
      baseUrl: "http://example.test",
      fetchImpl,
      sleep,
      retry: { maxAttempts: 4, baseDelayMs: 10, maxDelayMs: 100 },
    });
    const out = await repo.list();
    expect(out).toEqual([]);
    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry 4xx errors", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response("bad", { status: 400 });
    };
    const repo = new HttpRunRepository({
      baseUrl: "http://example.test",
      fetchImpl,
      retry: { maxAttempts: 5, baseDelayMs: 1 },
    });
    await expect(repo.load("x")).rejects.toMatchObject({ code: "HTTP_ERROR" });
    expect(calls).toBe(1);
  });

  it("retries network errors up to maxAttempts", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      throw new TypeError("Failed to fetch");
    };
    const sleep = vi.fn(async () => {});
    const repo = new HttpRunRepository({
      baseUrl: "http://example.test",
      fetchImpl,
      sleep,
      retry: { maxAttempts: 3, baseDelayMs: 1 },
    });
    await expect(repo.list()).rejects.toMatchObject({ code: "HTTP_ERROR" });
    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});

describe("HttpRunRepository abort + timeout", () => {
  it("propagates AbortSignal as HTTP_ABORTED", async () => {
    const fetchImpl: typeof fetch = (_url, init) =>
      new Promise<Response>((_, reject) => {
        const sig = init?.signal as AbortSignal | undefined;
        sig?.addEventListener("abort", () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
        );
      });
    const repo = new HttpRunRepository({
      baseUrl: "http://example.test",
      fetchImpl,
      retry: { maxAttempts: 1 },
    });
    const ctrl = new AbortController();
    const p = repo.list({ signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ code: "HTTP_ABORTED" });
  });

  it("rejects already-aborted signals immediately", async () => {
    const fetchImpl: typeof fetch = async () => new Response("[]");
    const repo = new HttpRunRepository({ baseUrl: "http://example.test", fetchImpl });
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(repo.list({ signal: ctrl.signal })).rejects.toMatchObject({ code: "HTTP_ABORTED" });
  });

  it("times out slow responses with HTTP_TIMEOUT", async () => {
    const fetchImpl: typeof fetch = (_url, init) =>
      new Promise<Response>((_, reject) => {
        const sig = init?.signal as AbortSignal | undefined;
        sig?.addEventListener("abort", () =>
          reject(Object.assign(new Error("timeout"), { name: "AbortError" })),
        );
      });
    const repo = new HttpRunRepository({
      baseUrl: "http://example.test",
      fetchImpl,
      timeoutMs: 5,
      retry: { maxAttempts: 1 },
    });
    await expect(repo.list()).rejects.toMatchObject({ code: "HTTP_TIMEOUT" });
  });
});

describe("HttpRunRepository defensive parsing", () => {
  it("treats empty 200 body on list as []", async () => {
    const fetchImpl: typeof fetch = async () => new Response("", { status: 200 });
    const repo = new HttpRunRepository({ baseUrl: "http://example.test", fetchImpl });
    expect(await repo.list()).toEqual([]);
  });

  it("rejects non-array list responses", async () => {
    const fetchImpl: typeof fetch = async () => new Response("{\"ok\":true}", { status: 200 });
    const repo = new HttpRunRepository({ baseUrl: "http://example.test", fetchImpl });
    await expect(repo.list()).rejects.toMatchObject({ code: "HTTP_INVALID_JSON" });
  });

  it("filters list entries that don't match SavedRunMeta", async () => {
    const ok = { id: "a", workflowId: "w", startedAt: "2026-04-27T00:00:00Z", status: "running" };
    const bad = { hello: "world" };
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify([ok, bad]), { status: 200 });
    const repo = new HttpRunRepository({ baseUrl: "http://example.test", fetchImpl });
    const out = await repo.list();
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("a");
  });

  it("treats empty 200 body on load as null", async () => {
    const fetchImpl: typeof fetch = async () => new Response("", { status: 200 });
    const repo = new HttpRunRepository({ baseUrl: "http://example.test", fetchImpl });
    expect(await repo.load("x")).toBeNull();
  });

  it("rejects load responses missing run id", async () => {
    const fetchImpl: typeof fetch = async () => new Response("{}", { status: 200 });
    const repo = new HttpRunRepository({ baseUrl: "http://example.test", fetchImpl });
    await expect(repo.load("x")).rejects.toMatchObject({ code: "HTTP_INVALID_JSON" });
  });
});

describe("HttpRunRepository input validation", () => {
  it("save rejects state without run.id", async () => {
    const fetchImpl: typeof fetch = async () => new Response("", { status: 204 });
    const repo = new HttpRunRepository({ baseUrl: "http://example.test", fetchImpl });
    const state = buildState();
    (state.run as { id: string }).id = "";
    await expect(repo.save(state)).rejects.toBeInstanceOf(WorkbenchError);
  });

  it("delete tolerates 404 (idempotent)", async () => {
    const fetchImpl: typeof fetch = async () => new Response("", { status: 404 });
    const repo = new HttpRunRepository({ baseUrl: "http://example.test", fetchImpl });
    await expect(repo.delete("missing")).resolves.toBeUndefined();
  });
});
