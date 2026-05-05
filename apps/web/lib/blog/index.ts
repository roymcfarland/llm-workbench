import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import {
  renderMarkdownWithHeadings,
  type RenderedHeading,
} from "@/lib/landing/markdown";

import { blogFrontMatterSchema, type BlogFrontMatter } from "./schema";

export type BlogPostPreview = BlogFrontMatter & {
  slug: string;
  /** Source path basename, e.g. `audit-trails.md`. */
  basename: string;
};

export type BlogPost = BlogPostPreview & {
  html: string;
  rawMarkdown: string;
  headings: RenderedHeading[];
};

const BLOG_REL = ["content", "blog"] as const;

function blogDir(): string {
  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    ...BLOG_REL,
  );
}

function listMarkdownFiles(): string[] {
  const dir = blogDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

export function getPostSlugs(): string[] {
  return listMarkdownFiles().map((f) => path.basename(f, ".md"));
}

function slugFromBasename(file: string): string {
  return path.basename(file, ".md");
}

function includeDrafts(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function getAllPostsForList(): BlogPostPreview[] {
  const previews: BlogPostPreview[] = [];
  for (const file of listMarkdownFiles()) {
    const full = path.join(blogDir(), file);
    const raw = fs.readFileSync(full, "utf8");
    const parsed = matter(raw);
    const meta = blogFrontMatterSchema.safeParse(parsed.data);
    if (!meta.success) {
      throw new Error(
        `Invalid front matter in ${file}: ${meta.error.message}`,
      );
    }
    const data = meta.data;
    if (data.draft && !includeDrafts()) continue;
    const slug = slugFromBasename(file);
    previews.push({
      ...data,
      slug,
      basename: file,
    });
  }
  return previews.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export function getPostBySlug(slug: string): BlogPost | null {
  const file = `${slug}.md`;
  const full = path.join(blogDir(), file);
  if (!fs.existsSync(full)) return null;
  const raw = fs.readFileSync(full, "utf8");
  const parsed = matter(raw);
  const meta = blogFrontMatterSchema.safeParse(parsed.data);
  if (!meta.success) {
    throw new Error(`Invalid front matter in ${file}: ${meta.error.message}`);
  }
  const data = meta.data;
  if (data.draft && !includeDrafts()) return null;
  const { html, headings } = renderMarkdownWithHeadings(parsed.content.trim());
  return {
    ...data,
    slug,
    basename: file,
    html,
    rawMarkdown: parsed.content,
    headings,
  };
}

/**
 * Approximate word count for a markdown body. Used for `wordCount` and
 * `timeRequired` in Article JSON-LD; precision is not important — search
 * engines and assistants only need a credible order-of-magnitude.
 */
export function wordCountOf(markdown: string): number {
  const stripped = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#>*_~`|\-]+/g, " ");
  const tokens = stripped.split(/\s+/).filter(Boolean);
  return tokens.length;
}

/**
 * ISO 8601 duration string for an estimated reading time, assuming
 * ~220 WPM (a common baseline for technical readers).
 */
export function readingTimeIso(wordCount: number): string {
  const minutes = Math.max(1, Math.round(wordCount / 220));
  return `PT${minutes}M`;
}

/**
 * Pick up to `limit` related posts by tag overlap, then recency. Excludes the
 * current slug. When no overlap exists, falls back to the newest other posts
 * so the related-posts block always renders.
 */
export function getRelatedPosts(
  current: BlogPostPreview,
  limit = 3,
): BlogPostPreview[] {
  const all = getAllPostsForList().filter((p) => p.slug !== current.slug);
  const tags = new Set(current.tags ?? []);
  const scored = all.map((p) => {
    const overlap = (p.tags ?? []).reduce(
      (n, t) => n + (tags.has(t) ? 1 : 0),
      0,
    );
    return { post: p, overlap };
  });
  scored.sort((a, b) => {
    if (b.overlap !== a.overlap) return b.overlap - a.overlap;
    return new Date(b.post.date).getTime() - new Date(a.post.date).getTime();
  });
  return scored.slice(0, limit).map((s) => s.post);
}

/**
 * URL-safe form of a tag for use in /blog/tags/[tag]. Lowercase, hyphenated,
 * stable across casing/punctuation drift in front matter.
 */
export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export type TagBucket = {
  tag: string;
  slug: string;
  count: number;
};

/**
 * Aggregate all tags across published posts. Display-name (`tag`) is taken
 * from the first occurrence to preserve casing/punctuation as authored.
 */
export function getAllTags(): TagBucket[] {
  const map = new Map<string, TagBucket>();
  for (const post of getAllPostsForList()) {
    for (const t of post.tags ?? []) {
      const slug = tagSlug(t);
      if (!slug) continue;
      const existing = map.get(slug);
      if (existing) existing.count += 1;
      else map.set(slug, { tag: t, slug, count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.tag.localeCompare(b.tag);
  });
}

/**
 * Posts whose front-matter tags map to the given slug, sorted newest first.
 */
export function getPostsByTag(slug: string): BlogPostPreview[] {
  return getAllPostsForList().filter((p) =>
    (p.tags ?? []).some((t) => tagSlug(t) === slug),
  );
}

/**
 * Resolve a tag slug to the canonical display name from front matter.
 */
export function resolveTagDisplayName(slug: string): string | null {
  const tag = getAllTags().find((t) => t.slug === slug);
  return tag ? tag.tag : null;
}
