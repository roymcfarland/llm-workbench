import { describe, expect, it } from "vitest";

import {
  getAllPostsForList,
  getPostBySlug,
  getRelatedPosts,
  getPostSlugs,
  readingTimeIso,
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
});
