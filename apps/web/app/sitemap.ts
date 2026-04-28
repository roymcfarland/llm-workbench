import type { MetadataRoute } from "next";

import { getAllPostsForList } from "@/lib/blog";
import { siteOrigin } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const now = new Date();
  const pathConfigs: {
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"];
  }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/blog", priority: 0.88, changeFrequency: "weekly" },
    { path: "/feed.xml", priority: 0.55, changeFrequency: "weekly" },
    { path: "/docs/protocol", priority: 0.78, changeFrequency: "weekly" },
    { path: "/runs/demo", priority: 0.72, changeFrequency: "monthly" },
    { path: "/playground", priority: 0.74, changeFrequency: "weekly" },
    { path: "/llms.txt", priority: 0.55, changeFrequency: "monthly" },
    { path: "/llms-full.txt", priority: 0.45, changeFrequency: "monthly" },
    { path: "/agents.md", priority: 0.45, changeFrequency: "monthly" },
    { path: "/api/openapi.json", priority: 0.52, changeFrequency: "weekly" },
    { path: "/.well-known/mcp.json", priority: 0.52, changeFrequency: "monthly" },
  ];

  const staticEntries = pathConfigs.map((entry): MetadataRoute.Sitemap[0] => ({
    url:
      entry.path === "/"
        ? `${origin}/`
        : `${origin}${entry.path}`,
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));

  const posts = getAllPostsForList();

  const postEntries = posts.map(
    (p): MetadataRoute.Sitemap[0] => ({
      url: `${origin}/blog/${p.slug}`,
      lastModified: new Date(p.updated ?? p.date),
      changeFrequency: "monthly",
      priority: 0.75,
    }),
  );

  return [...staticEntries, ...postEntries];
}
