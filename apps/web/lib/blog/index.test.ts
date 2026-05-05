import { describe, expect, it } from "vitest";

import {
  getAllPostsForList,
  getAllTags,
  getPostBySlug,
  getPostsByTag,
  getRelatedPosts,
  getPostSlugs,
  readingTimeIso,
  resolveTagDisplayName,
  tagSlug,
  wordCountOf,
} from "./index";

describe("blog index helpers", () => {
  it("lists posts sorted newest first", () => {
    const posts = getAllPostsForList();
    expect(posts.length).toBeGreaterThan(0);
    for (let i = 1; i < posts.length; i += 1) {
      expect(new Date(posts[i - 1]!.date).getTime()).toBeGreaterThanOrEqual(
        new Date(posts[i]!.date).getTime(),
      );
    }
  });

  it("loads each slug by id and renders html", () => {
    const slugs = getPostSlugs();
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      const post = getPostBySlug(slug);
      expect(post, `post ${slug} should resolve`).toBeTruthy();
      expect(post!.html).toMatch(/<h2|<p/);
      expect(post!.title.length).toBeGreaterThan(0);
      expect(post!.description.length).toBeGreaterThan(0);
    }
  });

  it("computes word count and reading time", () => {
    const wc = wordCountOf("hello world this has five words");
    expect(wc).toBe(6);
    expect(readingTimeIso(0)).toBe("PT1M");
    expect(readingTimeIso(440)).toBe("PT2M");
  });

  it("returns related posts excluding the current slug", () => {
    const posts = getAllPostsForList();
    const head = posts[0]!;
    const related = getRelatedPosts(head, 3);
    expect(related.length).toBeGreaterThan(0);
    for (const r of related) {
      expect(r.slug).not.toBe(head.slug);
    }
  });

  it("includes headings on full post records", () => {
    const slug = getPostSlugs()[0]!;
    const post = getPostBySlug(slug)!;
    expect(Array.isArray(post.headings)).toBe(true);
    expect(post.headings.length).toBeGreaterThan(0);
    for (const h of post.headings) {
      expect(h.id.length).toBeGreaterThan(0);
      expect(h.level).toBeGreaterThanOrEqual(1);
      expect(h.level).toBeLessThanOrEqual(4);
    }
  });

  it("slugifies tags consistently", () => {
    expect(tagSlug("AI Governance")).toBe("ai-governance");
    expect(tagSlug("  context window  ")).toBe("context-window");
    expect(tagSlug("LLM/MCP")).toBe("llmmcp");
  });

  it("aggregates tags across all posts", () => {
    const tags = getAllTags();
    expect(tags.length).toBeGreaterThan(0);
    for (const t of tags) {
      expect(t.count).toBeGreaterThan(0);
      expect(t.slug.length).toBeGreaterThan(0);
    }
    // Sorted by count desc, then alpha — first bucket has the largest count.
    for (let i = 1; i < tags.length; i += 1) {
      expect(tags[i - 1]!.count).toBeGreaterThanOrEqual(tags[i]!.count);
    }
  });

  it("returns posts for a known tag and resolves display names", () => {
    const tags = getAllTags();
    const head = tags[0]!;
    const matched = getPostsByTag(head.slug);
    expect(matched.length).toBe(head.count);
    expect(resolveTagDisplayName(head.slug)).toBe(head.tag);
    expect(resolveTagDisplayName("does-not-exist-xyz")).toBeNull();
  });
});
