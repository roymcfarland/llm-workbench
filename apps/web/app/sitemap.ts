import type { MetadataRoute } from "next";

import { getAllPostsForList, getAllTags, getPostsByTag } from "@/lib/blog";
import { siteOrigin } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const now = new Date();
  const posts = getAllPostsForList();
  const newestPostDate = posts
    .map((p) => new Date(p.updated ?? p.date).getTime())
    .reduce((max, t) => (t > max ? t : max), 0);
  const blogLastModified = newestPostDate > 0 ? new Date(newestPostDate) : now;

  const pathConfigs: {
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"];
    lastModified?: Date;
  }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/blog", priority: 0.88, changeFrequency: "weekly", lastModified: blogLastModified },
    { path: "/feed.xml", priority: 0.55, changeFrequency: "weekly", lastModified: blogLastModified },
    { path: "/docs/protocol", priority: 0.78, changeFrequency: "weekly" },
    { path: "/runs/demo", priority: 0.72, changeFrequency: "monthly" },
    { path: "/llms.txt", priority: 0.55, changeFrequency: "monthly" },
    { path: "/llms-full.txt", priority: 0.45, changeFrequency: "monthly" },
    { path: "/agents.md", priority: 0.45, changeFrequency: "monthly" },
    { path: "/humans.txt", priority: 0.3, changeFrequency: "yearly" },
    { path: "/api/openapi.json", priority: 0.52, changeFrequency: "weekly" },
    { path: "/.well-known/mcp.json", priority: 0.52, changeFrequency: "monthly" },
    { path: "/.well-known/security.txt", priority: 0.35, changeFrequency: "monthly" },
  ];

  const staticEntries = pathConfigs.map((entry): MetadataRoute.Sitemap[0] => ({
    url:
      entry.path === "/"
        ? `${origin}/`
        : `${origin}${entry.path}`,
    lastModified: entry.lastModified ?? now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));

  const postEntries = posts.map(
    (p): MetadataRoute.Sitemap[0] => ({
      url: `${origin}/blog/${p.slug}`,
      lastModified: new Date(p.updated ?? p.date),
      changeFrequency: "monthly",
      priority: 0.75,
    }),
  );

  // Tag/topic landing pages — lastModified mirrors the newest post in the
  // tag bucket so search engines see meaningful change cadence per topic.
  const tagEntries = getAllTags().map((t): MetadataRoute.Sitemap[0] => {
    const tagged = getPostsByTag(t.slug);
    const newest = tagged.reduce((max, p) => {
      const ts = new Date(p.updated ?? p.date).getTime();
      return ts > max ? ts : max;
    }, 0);
    return {
      url: `${origin}/blog/tags/${t.slug}`,
      lastModified: newest > 0 ? new Date(newest) : now,
      changeFrequency: "weekly",
      priority: 0.6,
    };
  });

  return [...staticEntries, ...postEntries, ...tagEntries];
}
