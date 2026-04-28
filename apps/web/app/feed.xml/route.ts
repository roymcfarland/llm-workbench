import { getAllPostsForList } from "@/lib/blog";
import { SITE_NAME, SITE_TAGLINE, siteOrigin } from "@/lib/site";

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rssDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const origin = await siteOrigin();
  const posts = getAllPostsForList();
  const feedUrl = `${origin}/feed.xml`;
  const blogUrl = `${origin}/blog`;

  const items = posts
    .map((p) => {
      const link = `${origin}/blog/${p.slug}`;
      return `    <item>
      <title>${xmlEscape(p.title)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <pubDate>${rssDate(p.date)}</pubDate>
      <description>${xmlEscape(p.description)}</description>
    </item>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(`${SITE_NAME} blog`)}</title>
    <link>${xmlEscape(blogUrl)}</link>
    <description>${xmlEscape(SITE_TAGLINE)} Articles on run bundles, gates, tracing, and the protocol.</description>
    <language>en-us</language>
    <lastBuildDate>${rssDate(posts[0]?.date ?? new Date().toISOString())}</lastBuildDate>
    <atom:link href="${xmlEscape(feedUrl)}" rel="self" type="application/rss+xml" />
    <image>
      <url>${xmlEscape(`${origin}/opengraph-image`)}</url>
      <title>${xmlEscape(`${SITE_NAME} blog`)}</title>
      <link>${xmlEscape(blogUrl)}</link>
    </image>
${items}
  </channel>
</rss>
`;

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
