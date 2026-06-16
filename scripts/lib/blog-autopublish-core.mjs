// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT
import matter from "gray-matter";

function oneLine(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function escapeLinkText(value) {
  return oneLine(value).replace(/([\[\]])/g, "\\$1");
}

export function slugify(title) {
  return String(title ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ensureUniqueSlug(base, existingSlugs) {
  const taken = new Set(existingSlugs);
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function wordCount(markdown) {
  const stripped = String(markdown ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#[\]>*_~`|(){}.!?,;:'"=+\\/-]+/g, " ");

  return stripped.split(/\s+/).filter(Boolean).length;
}

export function selectSources(items, { now, lookbackDays, maxPerFeed, minItems }) {
  const nowMs = new Date(now).getTime();
  const cutoffMs = nowMs - lookbackDays * 24 * 60 * 60 * 1000;

  const recent = items
    .map((item) => {
      const time = new Date(item.isoDate).getTime();
      return { ...item, time, link: oneLine(item.link) };
    })
    .filter(
      (item) =>
        item.link &&
        Number.isFinite(item.time) &&
        item.time <= nowMs &&
        item.time >= cutoffMs,
    )
    .sort((a, b) => b.time - a.time);

  const seenLinks = new Set();
  const byFeed = new Map();
  for (const item of recent) {
    if (seenLinks.has(item.link)) continue;

    const feedName = oneLine(item.feedName);
    const feedItems = byFeed.get(feedName) ?? [];
    if (feedItems.length >= maxPerFeed) continue;

    seenLinks.add(item.link);
    feedItems.push({
      feedName,
      title: oneLine(item.title),
      link: item.link,
      isoDate: item.isoDate,
      snippet: oneLine(item.snippet),
    });
    byFeed.set(feedName, feedItems);
  }

  const selected = Array.from(byFeed.values())
    .flat()
    .sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());

  return { items: selected, enough: selected.length >= minItems };
}

export function buildSourcesSection(items) {
  const lines = items.map(
    (item) =>
      `- [${escapeLinkText(item.title)}](${oneLine(item.link)}) — ${oneLine(
        item.feedName,
      )}`,
  );
  return `\n## Sources\n\n${lines.join("\n")}\n`;
}

export function buildGenerationMessages({ sources, existingTitles }) {
  const sourceList = sources
    .map((source, index) =>
      [
        `Source ${index + 1}:`,
        `Title: ${oneLine(source.title)}`,
        `Feed: ${oneLine(source.feedName)}`,
        `Date: ${oneLine(source.isoDate)}`,
        `Link: ${oneLine(source.link)}`,
        `Snippet: ${oneLine(source.snippet)}`,
      ].join("\n"),
    )
    .join("\n\n");

  const titleList =
    existingTitles.length > 0
      ? existingTitles.map((title) => `- ${oneLine(title)}`).join("\n")
      : "- No existing titles found.";

  const system = [
    "You are a senior engineer writing for the LLM Workbench blog.",
    "Connect this week's AI news to audit-ready run bundles, human-in-the-loop gates, model-agnostic tracing, agent observability, cost telemetry, and AI governance.",
    "Ground the post only in the provided sources; do not introduce unsupported facts.",
    "Cite sources inline as markdown links and include every provided source link in the post.",
    "Structure the post with ## headings and write roughly 600 to 1200 words.",
    "Do not reuse any title from the existing title list.",
  ].join(" ");

  const prompt = [
    "Write one source-grounded LLM Workbench blog post from these sources.",
    "",
    "Sources:",
    sourceList,
    "",
    "Existing titles to avoid:",
    titleList,
  ].join("\n");

  return { system, prompt };
}

export function buildPostMarkdown({ frontMatter, body }) {
  return matter.stringify(body, frontMatter);
}

export function validateGeneratedPost(markdown, { minWords, maxWords }) {
  const errors = [];
  let parsed;

  try {
    parsed = matter(markdown);
  } catch (error) {
    return { ok: false, errors: [`front matter parse error: ${error.message}`] };
  }

  const title = parsed.data.title;
  const description = parsed.data.description;
  const date = parsed.data.date;
  const body = parsed.content.trim();

  if (typeof title !== "string" || title.trim() === "") {
    errors.push("missing title");
  }
  if (typeof description !== "string" || description.trim() === "") {
    errors.push("missing description");
  }
  if (typeof date !== "string" || Number.isNaN(Date.parse(date))) {
    errors.push("missing or invalid date");
  }
  if (!/^## .+/m.test(body)) {
    errors.push("missing ## heading");
  }
  if (!/^## Sources\s*$/m.test(body)) {
    errors.push("missing ## Sources section");
  }

  const count = wordCount(body);
  if (count < minWords || count > maxWords) {
    errors.push(`word count ${count} outside ${minWords}-${maxWords}`);
  }

  return { ok: errors.length === 0, errors };
}
