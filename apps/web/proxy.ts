import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { rateLimitApiIfConfigured } from "@/lib/rate-limit/edge";
import { contentSecurityPolicy } from "@/lib/security/csp";

// Public surface: marketing landing, sign-in/up flows, public docs/demos,
// discoverability (blog, RSS, robots/sitemap), and the agentic discovery files
// (llms.txt / llms-full.txt / agents.md / openapi / mcp.json). Everything else
// (the (app) group, /api/runs, /api/llm) requires an authenticated session.
//
// SEO / crawlers: keep `isPublicRoute` aligned with `app/robots.txt`, `app/sitemap.ts`,
// and playground CTAs (`components/playground-marketing-link.tsx`). Next.js OG routes
// (`/opengraph-image`, `/twitter-image`) and page-specific image routes stay
// public — crawlers do not send cookies.
const isPublicRoute = createRouteMatcher([
  "/",
  "/opengraph-image(.*)",
  "/twitter-image(.*)",
  "/apple-icon(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health",
  "/docs/(.*)",
  "/runs/demo",
  "/faq",
  "/faq/opengraph-image(.*)",
  "/faq/twitter-image(.*)",
  "/blog",
  "/blog/(.*)",
  "/feed.xml",
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

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function nextWithCsp(csp: string, requestHeaders: Headers): NextResponse {
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export default clerkMiddleware(async (auth, req) => {
  const rate = await rateLimitApiIfConfigured(req);
  if (rate) return rate;

  const nonce = createNonce();
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  if (isPublicRoute(req)) {
    return nextWithCsp(csp, requestHeaders);
  }

  const { userId, redirectToSignIn } = await auth();
  if (userId) {
    return nextWithCsp(csp, requestHeaders);
  }

  if (isApiRoute(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Content-Security-Policy": csp } },
    );
  }

  const signInRedirect = (await redirectToSignIn({
    returnBackUrl: req.url,
  })) as NextResponse;
  signInRedirect.headers.set("Content-Security-Policy", csp);
  return signInRedirect;
});

export const config = {
  matcher: [
    // Skip Next internals, static assets, and `/api/health` (liveness must not go
    // through Next 16’s internal localhost proxy hop — breaks CI / Playwright).
    // One pattern only: a second matcher regressed `/` in production smoke (404).
    "/((?!_next|.*\\..*|api/health$).*)",
  ],
};
