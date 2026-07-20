// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpError, pollUntil, request } from "./http.mjs";

function fakeResponse({ body = "", contentType = "text/plain", ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    headers: {
      get: (name) => (name.toLowerCase() === "content-type" ? contentType : null),
    },
    text: async () => body,
  };
}

async function captureRejection(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected promise to reject");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request", () => {
  it("parses successful JSON responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({
      body: JSON.stringify({ ready: true }),
      contentType: "application/json; charset=utf-8",
      status: 201,
    }));

    await expect(request("https://example.com/widgets", { method: "POST" }, { fetchImpl })).resolves.toEqual({
      status: 201,
      body: { ready: true },
    });
  });

  it("returns successful non-JSON responses as text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({ body: "ready" }));

    await expect(request("https://example.com/status", undefined, { fetchImpl })).resolves.toEqual({
      status: 200,
      body: "ready",
    });
  });

  it("returns null for an empty response body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({ body: "" }));

    await expect(request("https://example.com/empty", undefined, { fetchImpl })).resolves.toEqual({
      status: 200,
      body: null,
    });
  });

  it("returns malformed JSON responses as text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({
      body: "{not-json}",
      contentType: "application/json",
    }));

    await expect(request("https://example.com/status", undefined, { fetchImpl })).resolves.toEqual({
      status: 200,
      body: "{not-json}",
    });
  });

  it("throws an HttpError with the default GET method", async () => {
    const url = "https://example.com/missing";
    const body = { error: "not found" };
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({
      body: JSON.stringify(body),
      contentType: "application/json",
      ok: false,
      status: 404,
    }));

    const error = await captureRejection(request(url, undefined, { fetchImpl }));

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({
      message: `GET ${url} -> 404`,
      status: 404,
      url,
      body,
    });
  });

  it("includes the supplied method in HttpError messages", async () => {
    const url = "https://example.com/widgets";
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse({
      body: "conflict",
      ok: false,
      status: 409,
    }));

    const error = await captureRejection(request(url, { method: "POST" }, { fetchImpl }));

    expect(error).toBeInstanceOf(HttpError);
    expect(error.message).toBe(`POST ${url} -> 409`);
  });

  it("rejects when no fetch implementation is available", async () => {
    vi.stubGlobal("fetch", undefined);

    await expect(request("https://example.com/status")).rejects.toThrow(
      "global fetch is not available — Node 18.18+ required",
    );
  });
});

describe("HttpError", () => {
  it("extends Error and preserves response details", () => {
    const body = { a: 1 };
    const error = new HttpError("msg", {
      status: 500,
      url: "https://x",
      body,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "HttpError",
      message: "msg",
      status: 500,
      url: "https://x",
      body,
    });
  });
});

describe("pollUntil", () => {
  it("returns immediately without sleeping when the first check is done", async () => {
    const check = vi.fn().mockResolvedValue({ done: true, value: "x" });
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const nowImpl = vi.fn().mockReturnValue(0);

    await expect(pollUntil(check, { sleepImpl, nowImpl })).resolves.toBe("x");
    expect(check).toHaveBeenCalledOnce();
    expect(sleepImpl).not.toHaveBeenCalled();
  });

  it("retries until a later check is done", async () => {
    const check = vi.fn()
      .mockResolvedValueOnce({ done: false })
      .mockResolvedValueOnce({ done: false })
      .mockResolvedValueOnce({ done: true, value: "ready" });
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const nowImpl = vi.fn().mockReturnValue(0);

    await expect(pollUntil(check, {
      intervalMs: 25,
      timeoutMs: 1_000,
      sleepImpl,
      nowImpl,
    })).resolves.toBe("ready");
    expect(check).toHaveBeenCalledTimes(3);
    expect(sleepImpl).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenNthCalledWith(1, 25);
    expect(sleepImpl).toHaveBeenNthCalledWith(2, 25);
  });

  it("includes the latest result label in timeout errors", async () => {
    const check = vi.fn().mockResolvedValue({ done: false, label: "widget ready" });
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const nowImpl = vi.fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1_001);

    await expect(pollUntil(check, {
      timeoutMs: 1_000,
      sleepImpl,
      nowImpl,
    })).rejects.toThrow("timed out after 1s waiting for widget ready");
    expect(sleepImpl).not.toHaveBeenCalled();
  });

  it("falls back to condition in timeout errors", async () => {
    const check = vi.fn().mockResolvedValue({ done: false });
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const nowImpl = vi.fn()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2_001);

    await expect(pollUntil(check, {
      timeoutMs: 2_000,
      sleepImpl,
      nowImpl,
    })).rejects.toThrow("timed out after 2s waiting for condition");
    expect(sleepImpl).not.toHaveBeenCalled();
  });
});
