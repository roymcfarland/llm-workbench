// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT
import matter from "gray-matter";
import { describe, expect, it } from "vitest";

import { blogFrontMatterSchema } from "../apps/web/lib/blog/schema.ts";
import {
  buildPostMarkdown,
  buildSourcesSection,
  ensureUniqueSlug,
  selectSources,
  slugify,
  validateGeneratedPost,
  wordCount,
} from "./lib/blog-autopublish-core.mjs";

const sourceItems = [
  {
    feedName: "Feed A",
    title: "A1",
    link: "https://example.com/a1",
    isoDate: "2026-06-15T12:00:00Z",
    snippet: "Newest item.",
  },
  {
    feedName: "Feed A",
    title: "A2",
    link: "https://example.com/a2",
    isoDate: "2026-06-14T12:00:00Z",
    snippet: "Second item.",
  },
  {
    feedName: "Feed A",
    title: "A3",
    link: "https://example.com/a3",
    isoDate: "2026-06-13T12:00:00Z",
    snippet: "Capped out.",
  },
  {
    feedName: "Feed B",
    title: "Duplicate A1",
    link: "https://example.com/a1",
    isoDate: "2026-06-12T12:00:00Z",
    snippet: "Duplicate link.",
  },
  {
    feedName: "Feed B",
    title: "B1",
    link: "https://example.com/b1",
    isoDate: "2026-06-11T12:00:00Z",
    snippet: "Different feed.",
  },
  {
    feedName: "Feed C",
    title: "Too old",
    link: "https://example.com/old",
    isoDate: "2026-05-15T12:00:00Z",
    snippet: "Outside the window.",
  },
  {
    feedName: "Feed C",
    title: "Invalid date",
    link: "https://example.com/invalid",
    isoDate: "not a date",
    snippet: "Ignored.",
  },
];

const goodFixture = buildPostMarkdown({
  frontMatter: {
    title: "Agent Observability After a Busy AI News Week",
    description: "A grounded look at why AI news keeps pointing back to observable agent operations.",
    date: "2026-06-16T12:00:00.000Z",
    tags: ["AI governance", "agent observability", "cost telemetry"],
    author: "LLM Workbench",
  },
  body: [
    "## What Changed",
    "Grounded systems need traces, gates, budgets, and replayable evidence. ".repeat(8),
    "",
    "## Why It Matters",
    "Teams need practical controls that convert weekly model and platform news into auditable operations. ".repeat(
      8,
    ),
    "",
    "## Sources",
    "",
    "- [Source A](https://example.com/a) — Feed A",
  ].join("\n"),
});

describe("blog autopublish core", () => {
  it("slugifies titles with casing, punctuation, and repeated separators", () => {
    expect(slugify("AI Governance: Agents, Gates & Traces!!")).toBe(
      "ai-governance-agents-gates-traces",
    );
    expect(slugify("  Cost---Telemetry   Week  ")).toBe("cost-telemetry-week");
  });

  it("adds collision suffixes for duplicate slugs", () => {
    expect(ensureUniqueSlug("weekly-ai-news", new Set(["other"]))).toBe("weekly-ai-news");
    expect(
      ensureUniqueSlug(
        "weekly-ai-news",
        new Set(["weekly-ai-news", "weekly-ai-news-2"]),
      ),
    ).toBe("weekly-ai-news-3");
  });

  it("counts prose words after stripping markdown code and markup", () => {
    const markdown =
      "## Hi\nHello [world](https://example.com) `ignored code` ![alt](img.png) **there**";
    expect(wordCount(markdown)).toBe(4);
  });

  it("selects recent, deduped sources with per-feed caps and an enough flag", () => {
    const selected = selectSources(sourceItems, {
      now: new Date("2026-06-16T12:00:00Z"),
      lookbackDays: 14,
      maxPerFeed: 2,
      minItems: 3,
    });

    expect(selected.enough).toBe(true);
    expect(selected.items.map((item) => item.link)).toEqual([
      "https://example.com/a1",
      "https://example.com/a2",
      "https://example.com/b1",
    ]);

    const notEnough = selectSources(sourceItems, {
      now: new Date("2026-06-16T12:00:00Z"),
      lookbackDays: 14,
      maxPerFeed: 2,
      minItems: 4,
    });
    expect(notEnough.enough).toBe(false);
  });

  it("builds a Sources block with all links", () => {
    const section = buildSourcesSection(sourceItems.slice(0, 2));
    expect(section).toContain("\n## Sources\n\n");
    expect(section).toContain("https://example.com/a1");
    expect(section).toContain("https://example.com/a2");
  });

  it("validates a generated post and reports contract errors", () => {
    expect(validateGeneratedPost(goodFixture, { minWords: 20, maxWords: 220 })).toEqual({
      ok: true,
      errors: [],
    });

    const missingTitle = buildPostMarkdown({
      frontMatter: { ...matter(goodFixture).data, title: "" },
      body: matter(goodFixture).content,
    });
    expect(
      validateGeneratedPost(missingTitle, { minWords: 20, maxWords: 220 }).errors,
    ).toContain("missing title");

    const noHeading = buildPostMarkdown({
      frontMatter: matter(goodFixture).data,
      body: "No heading here. " + "Still prose. ".repeat(30),
    });
    expect(validateGeneratedPost(noHeading, { minWords: 20, maxWords: 220 }).errors).toContain(
      "missing ## heading",
    );

    const noSources = goodFixture.replace(/\n## Sources[\s\S]*$/, "");
    expect(validateGeneratedPost(noSources, { minWords: 20, maxWords: 220 }).errors).toContain(
      "missing ## Sources section",
    );

    const tooShort = buildPostMarkdown({
      frontMatter: matter(goodFixture).data,
      body: "## Tiny\nToo short.\n\n## Sources\n\n- [Source A](https://example.com/a) — Feed A",
    });
    expect(validateGeneratedPost(tooShort, { minWords: 20, maxWords: 220 }).errors).toEqual(
      expect.arrayContaining([expect.stringContaining("word count")]),
    );
  });

  it("keeps generated front matter compatible with the real blog schema", () => {
    const parsed = matter(goodFixture);
    expect(blogFrontMatterSchema.safeParse(parsed.data).success).toBe(true);
  });
});
