// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateObject } from "ai";
import matter from "gray-matter";
import Parser from "rss-parser";
import { z } from "zod";

import {
  buildGenerationMessages,
  buildPostMarkdown,
  buildSourcesSection,
  ensureUniqueSlug,
  selectSources,
  slugify,
  validateGeneratedPost,
} from "./lib/blog-autopublish-core.mjs";
import { logger } from "./lib/log.mjs";

const log = logger("blog");
const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));
const BLOG_DIR = path.join(ROOT_DIR, "apps", "web", "content", "blog");
const SOURCES_PATH = path.join(ROOT_DIR, "scripts", "blog-sources.json");
const PREVIEW_PATH = path.join(ROOT_DIR, "blog-autopublish-preview.md");
const DEFAULT_MODEL = "anthropic/claude-opus-4-8";
const MODES = new Set(["publish", "dry-run", "fetch-only"]);

const generatedPostSchema = z.object({
  title: z.string().min(8).max(120),
  description: z.string().min(20).max(220),
  tags: z.array(z.string()).min(3).max(6),
  bodyMarkdown: z.string().min(800),
});

function cleanOutputValue(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

async function writeOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  await writeFile(
    process.env.GITHUB_OUTPUT,
    `${key}=${cleanOutputValue(value)}\n`,
    { flag: "a" },
  );
}

async function skip(reason) {
  log.note(`skip: ${reason}`);
  await writeOutput("created", "");
  await writeOutput("skip_reason", reason);
}

async function loadSourcesConfig() {
  return JSON.parse(await readFile(SOURCES_PATH, "utf8"));
}

async function fetchFeed(parser, feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
    log.info(`fetched ${parsed.items.length} items from ${feed.name}`);
    return parsed.items.map((item) => ({
      feedName: feed.name,
      title: item.title ?? "",
      link: item.link ?? "",
      isoDate: item.isoDate ?? item.pubDate ?? "",
      snippet: item.contentSnippet ?? item.summary ?? item.content ?? "",
    }));
  } catch (error) {
    log.warn(`feed failed (${feed.name}): ${error.message}`);
    return [];
  }
}

async function readExistingPosts() {
  const files = (await readdir(BLOG_DIR)).filter((file) => file.endsWith(".md"));
  const titles = [];
  const slugs = [];

  for (const file of files) {
    const fullPath = path.join(BLOG_DIR, file);
    const parsed = matter(await readFile(fullPath, "utf8"));
    if (typeof parsed.data.title === "string" && parsed.data.title.trim()) {
      titles.push(parsed.data.title.trim());
    }
    slugs.push(path.basename(file, ".md"));
  }

  return { titles, slugs };
}

function hasSourcesSection(markdown) {
  return /^## Sources\s*$/m.test(markdown);
}

async function main() {
  const mode = process.env.BLOG_MODE || "publish";
  if (!MODES.has(mode)) {
    log.err(`invalid BLOG_MODE: ${mode}`);
    process.exit(1);
  }

  if (mode !== "fetch-only" && !process.env.AI_GATEWAY_API_KEY) {
    log.err("AI_GATEWAY_API_KEY is required unless BLOG_MODE=fetch-only");
    process.exit(1);
  }

  const config = await loadSourcesConfig();
  const parser = new Parser();
  const fetched = await Promise.all(config.feeds.map((feed) => fetchFeed(parser, feed)));
  const selected = selectSources(fetched.flat(), {
    now: new Date(),
    lookbackDays: config.lookbackDays,
    maxPerFeed: config.maxPerFeed,
    minItems: config.minItems,
  });

  if (!selected.enough) {
    await skip(`only ${selected.items.length} sources`);
    process.exit(0);
  }

  if (mode === "fetch-only") {
    process.stdout.write(`${JSON.stringify(selected.items, null, 2)}\n`);
    process.exit(0);
  }

  const existing = await readExistingPosts();
  const { system, prompt } = buildGenerationMessages({
    sources: selected.items,
    existingTitles: existing.titles,
  });

  const model = process.env.BLOG_MODEL || DEFAULT_MODEL;
  log.info(`generating post with ${model}`);
  const startedAt = Date.now();
  const result = await generateObject({
    model,
    schema: generatedPostSchema,
    system,
    prompt,
  });
  log.ok(`generated structured draft in ${Date.now() - startedAt}ms`);

  const draft = result.object;
  const bodyMarkdown = draft.bodyMarkdown.trim();
  const body = hasSourcesSection(bodyMarkdown)
    ? bodyMarkdown
    : `${bodyMarkdown}${buildSourcesSection(selected.items)}`;
  const markdown = buildPostMarkdown({
    frontMatter: {
      title: draft.title,
      description: draft.description,
      date: new Date().toISOString(),
      tags: draft.tags,
      author: "LLM Workbench",
    },
    body,
  });

  const validation = validateGeneratedPost(markdown, {
    minWords: config.minWords,
    maxWords: config.maxWords,
  });
  if (!validation.ok) {
    log.warn(`generated post failed validation: ${validation.errors.join("; ")}`);
    await skip(validation.errors.join("; "));
    process.exit(0);
  }

  if (mode === "dry-run") {
    await writeFile(PREVIEW_PATH, markdown);
    process.stdout.write(`${markdown}\n`);
    await writeOutput("preview", "blog-autopublish-preview.md");
    log.ok("wrote blog-autopublish-preview.md");
    process.exit(0);
  }

  const baseSlug = slugify(draft.title) || "weekly-ai-news";
  const slug = ensureUniqueSlug(baseSlug, existing.slugs);
  const relativePostPath = path.posix.join("apps/web/content/blog", `${slug}.md`);
  await writeFile(path.join(BLOG_DIR, `${slug}.md`), markdown);
  await writeOutput("created", relativePostPath);
  await writeOutput("slug", slug);
  await writeOutput("title", draft.title);
  log.ok(`created ${relativePostPath}`);
  process.exit(0);
}

main().catch((error) => {
  log.err(error.stack || error.message);
  process.exit(1);
});
