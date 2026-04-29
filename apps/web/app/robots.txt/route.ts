import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const origin = await siteOrigin();
  // One `User-agent: *` block: per RFC, each named bot group is independent—duplicated
  // `Allow: /`–only stanzas (GPTBot, etc.) did not inherit these Disallow lines and
  // could index auth-only routes. Keep marketing + discoverability public; gate /runs
  // (except /runs/demo), playground, and auth surfaces.
  const body = `User-agent: *
Allow: /
Allow: /runs/demo
Disallow: /api/runs
Disallow: /api/llm
Disallow: /api/mcp
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
