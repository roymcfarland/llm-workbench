import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const origin = await siteOrigin();
  const body = `User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: CCBot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: *
Allow: /
Disallow: /api/runs/
Disallow: /sign-in
Disallow: /sign-up

Sitemap: ${origin}/sitemap.xml
`;
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
