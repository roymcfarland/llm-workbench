import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { type NextRequest, NextResponse } from "next/server";

import { contentSecurityPolicy } from "@/lib/security/csp";

function redisFromEnv(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

const redis = redisFromEnv();

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

/**
 * Edge-safe API rate limit when Upstash env vars are set. No-op otherwise
 * (configure `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` to enable).
 */
export async function rateLimitApiIfConfigured(
  req: NextRequest,
): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname;
  if (!pathname.startsWith("/api/")) return null;
  if (skipRateLimit(pathname)) return null;

  const limiter = isHeavyApiPath(pathname) ? limiterHeavy : limiterDefault;
  if (!limiter) return null;

  const { success, reset } = await limiter.limit(clientKey(req));
  if (success) return null;

  const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "Content-Security-Policy": contentSecurityPolicy(),
      },
    },
  );
}
