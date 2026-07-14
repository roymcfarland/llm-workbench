import type { MetadataRoute } from "next";

import { getAllPostsForList, getAllTags, getPostsByTag } from "@/lib/blog";
import { siteOrigin } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const posts = getAllPostsForList();
  const newestPostDate = posts
    .map((p) => new Date(p.updated ?? p.date).getTime())
    .reduce((max, t) => (t > max ? t : max), 0);
  const blogLastModified =
    newestPostDate > 0 ? new Date(newestPostDate) : undefined;

  const pathConfigs: {
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"];
    lastModified?: Date;
  }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    {
      path: "/blog",
      priority: 0.88,
      changeFrequency: "weekly",
      ...(blogLastModified === undefined
        ? {}
        : { lastModified: blogLastModified }),
    },
    { path: "/docs/protocol", priority: 0.78, changeFrequency: "weekly" },
    { path: "/docs/getting-started", priority: 0.8, changeFrequency: "monthly" },
    { path: "/docs/architecture", priority: 0.76, changeFrequency: "monthly" },
    { path: "/runs/demo", priority: 0.72, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
  ];

  const staticEntries = pathConfigs.map((entry): MetadataRoute.Sitemap[0] => ({
    url:
      entry.path === "/"
        ? `${origin}/`
        : `${origin}${entry.path}`,
    ...(entry.lastModified === undefined
      ? {}
      : { lastModified: entry.lastModified }),
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

  // Multi-post tag landing pages inherit the newest post date in the topic.
  const tagEntries = getAllTags()
    .filter((t) => t.count >= 2)
    .map((t): MetadataRoute.Sitemap[0] => {
      const tagged = getPostsByTag(t.slug);
      const newest = tagged.reduce((max, p) => {
        const ts = new Date(p.updated ?? p.date).getTime();
        return ts > max ? ts : max;
      }, 0);
      return {
        url: `${origin}/blog/tags/${t.slug}`,
        lastModified: new Date(newest),
        changeFrequency: "weekly",
        priority: 0.6,
      };
    });

  return [...staticEntries, ...postEntries, ...tagEntries];
}
