import { NextRequest, type NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

function request(pathname: string): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`);
}

async function loadRateLimiter(
  env: Record<string, string> = {},
): Promise<typeof import("./edge")> {
  vi.resetModules();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
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
