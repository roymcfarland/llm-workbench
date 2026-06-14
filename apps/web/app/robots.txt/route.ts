import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const origin = await siteOrigin();
  // One `User-agent: *` block: each named bot group is independent—keep all rules here.
  // Allow OpenAPI + `.well-known/*` explicitly so no future broad `/api` rule can
  // accidentally block discovery URLs.
  const body = `User-agent: *
Allow: /
Allow: /blog
Allow: /blog/tags/
Allow: /docs/
Allow: /runs/demo
Allow: /faq
Allow: /api/openapi.json
Allow: /.well-known/
Allow: /humans.txt

# JSON / streaming / probes — not HTML documents for search
Disallow: /api/runs
Disallow: /api/runs/
Disallow: /api/llm
Disallow: /api/mcp
Disallow: /api/health
Disallow: /trpc/

# Clerk-gated shells and auth flows
Disallow: /playground
Disallow: /runs
Disallow: /sign-in
Disallow: /sign-up

Sitemap: ${origin}/sitemap.xml
`;
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
