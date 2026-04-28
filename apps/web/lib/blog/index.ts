import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { renderMarkdown } from "@/lib/landing/markdown";

import { blogFrontMatterSchema, type BlogFrontMatter } from "./schema";

export type BlogPostPreview = BlogFrontMatter & {
  slug: string;
  /** Source path basename, e.g. `audit-trails.md`. */
  basename: string;
};

export type BlogPost = BlogPostPreview & {
  html: string;
  rawMarkdown: string;
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
  const html = renderMarkdown(parsed.content.trim());
  return {
    ...data,
    slug,
    basename: file,
    html,
    rawMarkdown: parsed.content,
  };
}
