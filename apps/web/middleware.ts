import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId, redirectToSignIn } = await auth();
  if (userId) return;

  if (isApiRoute(req)) {
    // Bare HTTP 401 with a JSON body — no HTML, no rewrite to /_not-found.
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Page route: 307 redirect to /sign-in with the original URL so the user
  // can resume after authenticating. `auth.protect()` would *rewrite* to
  // /_not-found by default, which surfaces as a 404 to the user.
  return redirectToSignIn({ returnBackUrl: req.url });
});

export const config = {
  matcher: [
    // Skip Next internals and static assets.
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
