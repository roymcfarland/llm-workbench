import { describe, expect, it, vi } from "vitest";

import { getAllPostsForList, getAllTags } from "@/lib/blog";

import sitemap from "./sitemap";

vi.mock("@/lib/site", () => ({
  siteOrigin: async () => "https://www.llmworkbench.io",
}));

const ORIGIN = "https://www.llmworkbench.io";

describe("sitemap", () => {
  it("submits only indexable HTML URLs", async () => {
    const entries = await sitemap();

    for (const entry of entries) {
      const pathname = new URL(entry.url).pathname;
      expect(pathname, entry.url).not.toMatch(/\.(?:xml|json|txt|md)$/);
      expect(pathname, entry.url).not.toContain("/api/");
      expect(pathname, entry.url).not.toContain("/.well-known/");
    }
  });

  it("includes only tags with at least two posts", async () => {
    const entries = await sitemap();
    const expectedTagSlugs = new Set(
      getAllTags()
        .filter((tag) => tag.count >= 2)
        .map((tag) => tag.slug),
    );
    const sitemapTagSlugs = new Set(
      entries.flatMap((entry) => {
        const pathname = new URL(entry.url).pathname;
        const prefix = "/blog/tags/";
        return pathname.startsWith(prefix)
          ? [pathname.slice(prefix.length)]
          : [];
      }),
    );

    expect(sitemapTagSlugs).toEqual(expectedTagSlugs);
  });

  it("omits lastModified unless a content date is known", async () => {
    const entries = await sitemap();
    const byUrl = new Map(entries.map((entry) => [entry.url, entry]));

    for (const path of ["/", "/docs/protocol", "/runs/demo", "/faq"]) {
      const url = path === "/" ? `${ORIGIN}/` : `${ORIGIN}${path}`;
      expect(byUrl.get(url)?.lastModified).toBeUndefined();
    }

    expect(byUrl.get(`${ORIGIN}/blog`)?.lastModified).toBeDefined();

    for (const post of getAllPostsForList()) {
      expect(
        byUrl.get(`${ORIGIN}/blog/${post.slug}`)?.lastModified,
      ).toBeDefined();
    }
  });

  it("keeps the root and blog index in the sitemap", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain(`${ORIGIN}/`);
    expect(urls).toContain(`${ORIGIN}/blog`);
  });
});
