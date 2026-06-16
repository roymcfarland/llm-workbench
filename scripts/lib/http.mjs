// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT
//
// Thin fetch wrappers shared by the token-path provisioners. We model
// HTTP errors as plain objects with `{ status, body, url }` so the
// provisioners can pattern-match on status without re-implementing
// fetch ergonomics in three places.

export class HttpError extends Error {
  constructor(message, info) {
    super(message);
    this.name = "HttpError";
    this.status = info.status;
    this.url = info.url;
    this.body = info.body;
  }
}

/**
 * `request` is the single network seam. Tests inject a fake by passing
 * `{ fetchImpl }` so we never touch the real network in unit tests.
 */
export async function request(url, init, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("global fetch is not available — Node 18.18+ required");
  }
  const res = await fetchImpl(url, init);
  const text = await res.text();
  const body = parseBody(text, res.headers.get("content-type"));
  if (!res.ok) {
    throw new HttpError(`${init?.method ?? "GET"} ${url} -> ${res.status}`, {
      status: res.status,
      url,
      body,
    });
  }
  return { status: res.status, body };
}

function parseBody(text, contentType) {
  if (!text) return null;
  if (contentType && /application\/json/i.test(contentType)) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

export async function pollUntil(check, options = {}) {
  const {
    intervalMs = 5_000,
    timeoutMs = 5 * 60_000,
    sleepImpl = (ms) => new Promise((r) => setTimeout(r, ms)),
    nowImpl = Date.now,
  } = options;
  const start = nowImpl();
  while (true) {
    const result = await check();
    if (result.done) return result.value;
    if (nowImpl() - start > timeoutMs) {
      throw new Error(`timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${result.label ?? "condition"}`);
    }
    await sleepImpl(intervalMs);
  }
}
