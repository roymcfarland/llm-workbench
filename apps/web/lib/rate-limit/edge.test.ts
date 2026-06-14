import { NextRequest, type NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the Upstash SDKs so the "configured" path is exercisable without a real
// Redis: any constructed limiter allows the request.
vi.mock("@upstash/redis", () => ({
  Redis: class FakeRedis {},
}));
vi.mock("@upstash/ratelimit", () => {
  class FakeRatelimit {
    static slidingWindow() {
      return {};
    }
    limit() {
      return Promise.resolve({ success: true, reset: Date.now() + 60_000 });
    }
  }
  return { Ratelimit: FakeRatelimit };
});

function request(pathname: string): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`);
}

async function loadRateLimiter(
  env: Record<string, string> = {},
): Promise<typeof import("./edge")> {
  vi.resetModules();
  // Zero out BOTH naming schemes so "unconfigured" cases are deterministic
  // regardless of what the host/CI environment exports.
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("KV_REST_API_URL", "");
  vi.stubEnv("KV_REST_API_TOKEN", "");
  vi.stubEnv("RATE_LIMIT_ALLOW_UNCONFIGURED", "");
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  return import("./edge");
}

function expectResponse(response: NextResponse | null): NextResponse {
  if (!response) throw new Error("Expected a NextResponse");
  return response;
}

describe("rateLimitApiIfConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns 503 for API requests in production when Upstash is missing and no opt-out is set", async () => {
    const { rateLimitApiIfConfigured } = await loadRateLimiter({
      NODE_ENV: "production",
    });

    const response = expectResponse(
      await rateLimitApiIfConfigured(request("/api/runs")),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Rate limiter not configured",
    });
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
  });

  it("enforces via the limiter (no 503) when configured through KV_* names", async () => {
    const { rateLimitApiIfConfigured } = await loadRateLimiter({
      NODE_ENV: "production",
      KV_REST_API_URL: "https://example.upstash.io",
      KV_REST_API_TOKEN: "fake-token",
    });

    // Limiter is configured from the Vercel-injected KV_* vars, so the request
    // passes through it (mocked to allow) instead of failing closed with 503.
    await expect(rateLimitApiIfConfigured(request("/api/runs"))).resolves.toBe(
      null,
    );
  });

  it("returns null in production without Upstash when RATE_LIMIT_ALLOW_UNCONFIGURED=1", async () => {
    const { rateLimitApiIfConfigured } = await loadRateLimiter({
      NODE_ENV: "production",
      RATE_LIMIT_ALLOW_UNCONFIGURED: "1",
    });

    await expect(rateLimitApiIfConfigured(request("/api/runs"))).resolves.toBe(
      null,
    );
  });

  it("returns null outside production when Upstash is missing", async () => {
    const { rateLimitApiIfConfigured } = await loadRateLimiter({
      NODE_ENV: "test",
    });

    await expect(rateLimitApiIfConfigured(request("/api/runs"))).resolves.toBe(
      null,
    );
  });

  it("skips /api/health even when production Upstash config is missing", async () => {
    const { rateLimitApiIfConfigured } = await loadRateLimiter({
      NODE_ENV: "production",
    });

    await expect(
      rateLimitApiIfConfigured(request("/api/health")),
    ).resolves.toBe(null);
  });

  it("returns null for non-API paths before rate-limit enforcement", async () => {
    const { rateLimitApiIfConfigured } = await loadRateLimiter({
      NODE_ENV: "production",
    });

    await expect(rateLimitApiIfConfigured(request("/blog"))).resolves.toBe(
      null,
    );
  });
});
