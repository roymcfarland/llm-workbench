import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { rateLimitApiIfConfigured } from "@/lib/rate-limit/edge";
import {
  PLAYWRIGHT_CLERK_BYPASS_COOKIE,
  PLAYWRIGHT_CLERK_BYPASS_ENV,
  PLAYWRIGHT_CLERK_BYPASS_HEADER,
  resolvePlaywrightClerkBypassSecret,
} from "@/lib/playwright-clerk-bypass";
import { contentSecurityPolicy } from "@/lib/security/csp";

// Public surface: marketing landing, sign-in/up flows, public docs/demos, and
// the agentic discovery files (llms.txt / llms-full.txt / agents.md /
// robots.txt / sitemap / mcp.json / openapi.json). Everything else (the (app)
// group, /api/runs, /api/llm) requires an authenticated session.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health",
  "/docs/(.*)",
  "/runs/demo",
  "/llms.txt",
  "/llms-full.txt",
  "/agents.md",
  "/robots.txt",
  "/sitemap.xml",
  "/.well-known/(.*)",
  "/api/openapi.json",
  // /api/mcp gates auth inside each tool handler so that MCP discovery
  // (`tools/list`) works for unauthenticated agents but mutating tools
  // require Clerk credentials. Marking it public here lets the JSON-RPC
  // envelope reach our handler.
  "/api/mcp",
]);

// API routes that require auth must respond with JSON `401 Unauthorized`
// instead of a sign-in redirect — JSON callers (curl, programmatic clients,
// and the OpenAPI surface) expect a structured error, not an HTML page.
const isApiRoute = createRouteMatcher(["/api/(.*)", "/trpc/(.*)"]);

const cspHeaders = (): HeadersInit => ({
  "Content-Security-Policy": contentSecurityPolicy(),
});

function isPlaywrightClerkBypass(req: NextRequest): boolean {
  if (process.env[PLAYWRIGHT_CLERK_BYPASS_ENV] !== "1") return false;
  const expected = resolvePlaywrightClerkBypassSecret();
  const headerToken = req.headers.get(PLAYWRIGHT_CLERK_BYPASS_HEADER);
  const cookieToken = req.cookies.get(PLAYWRIGHT_CLERK_BYPASS_COOKIE)?.value;
  if (headerToken !== expected && cookieToken !== expected) {
    return false;
  }
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  return req.nextUrl.pathname === "/";
}

const clerk = clerkMiddleware(async (auth, req) => {
  const rate = await rateLimitApiIfConfigured(req);
  if (rate) return rate;

  if (isPublicRoute(req)) {
    return NextResponse.next({ headers: cspHeaders() });
  }

  const { userId, redirectToSignIn } = await auth();
  if (userId) {
    return NextResponse.next({ headers: cspHeaders() });
  }

  if (isApiRoute(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: cspHeaders() },
    );
  }

  const signInRedirect = (await redirectToSignIn({
    returnBackUrl: req.url,
  })) as NextResponse;
  signInRedirect.headers.set(
    "Content-Security-Policy",
    contentSecurityPolicy(),
  );
  return signInRedirect;
});

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  if (isPlaywrightClerkBypass(req)) {
    const rate = await rateLimitApiIfConfigured(req);
    if (rate) return rate;
    return NextResponse.next({ headers: cspHeaders() });
  }
  return clerk(req, event);
}

export const config = {
  matcher: [
    // Skip Next internals, static assets, and `/api/health` (liveness must not go
    // through Next 16’s internal localhost proxy hop — breaks CI / Playwright).
    // One pattern only: a second matcher regressed `/` in production smoke (404).
    "/((?!_next|.*\\..*|api/health$).*)",
  ],
};
