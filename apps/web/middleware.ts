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

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static assets.
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
