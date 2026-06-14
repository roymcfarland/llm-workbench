import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { type NextRequest, NextResponse } from "next/server";

import { contentSecurityPolicy } from "@/lib/security/csp";

function redisFromEnv(): Redis | null {
  // Accept either naming scheme: the native Upstash vars
  // (`UPSTASH_REDIS_REST_*`) or the `KV_REST_API_*` vars that Vercel's
  // "Upstash for Redis" Marketplace integration injects. `||` (not `??`) so an
  // empty string falls through to the next candidate.
  const url =
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim();
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

const redis = redisFromEnv();
const UNCONFIGURED_RETRY_AFTER_SECONDS = "60";

/** Default JSON/MCP-style API traffic (requests / minute, per client IP). */
const limiterDefault =
  redis &&
  new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(120, "1 m"),
    analytics: true,
    prefix: "ratelimit:api",
  });

/** Expensive routes: LLM proxy and MCP. */
const limiterHeavy =
  redis &&
  new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    analytics: true,
    prefix: "ratelimit:heavy",
  });

function clientKey(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  return "unknown";
}

function isHeavyApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/llm") ||
    pathname.startsWith("/api/mcp") ||
    pathname.startsWith("/trpc")
  );
}

function skipRateLimit(pathname: string): boolean {
  if (pathname === "/api/health") return true;
  return false;
}

function unconfiguredRateLimitFailsClosed(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.RATE_LIMIT_ALLOW_UNCONFIGURED !== "1"
  );
}

function rateLimitJsonResponse(
  error: string,
  status: 429 | 503,
  retryAfter: string,
): NextResponse {
  return NextResponse.json(
    { error },
    {
      status,
      headers: {
        "Retry-After": retryAfter,
        "Content-Security-Policy": contentSecurityPolicy(),
      },
    },
  );
}

/**
 * Edge-safe API rate limiting. Configured Upstash env vars enforce limits;
 * missing config fails closed in production unless `RATE_LIMIT_ALLOW_UNCONFIGURED=1`;
 * missing config remains a no-op in development and test.
 */
export async function rateLimitApiIfConfigured(
  req: NextRequest,
): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname;
  if (!pathname.startsWith("/api/")) return null;
  if (skipRateLimit(pathname)) return null;

  const limiter = isHeavyApiPath(pathname) ? limiterHeavy : limiterDefault;
  if (!limiter) {
    if (!unconfiguredRateLimitFailsClosed()) return null;
    return rateLimitJsonResponse(
      "Rate limiter not configured",
      503,
      UNCONFIGURED_RETRY_AFTER_SECONDS,
    );
  }

  const { success, reset } = await limiter.limit(clientKey(req));
  if (success) return null;

  const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return rateLimitJsonResponse("Too many requests", 429, String(retryAfterSec));
}
