import { describe, expect, it } from "vitest";

import {
  renderMarkdown,
  renderMarkdownWithHeadings,
  slugifyHeading,
} from "./markdown";

describe("renderMarkdown", () => {
  it("renders headings, paragraphs, and lists", () => {
    const html = renderMarkdown(
      [
        "## Hello",
        "",
        "Some intro text with `inline code`.",
        "",
        "- one",
        "- two",
      ].join("\n"),
    );
    expect(html).toContain("<h2");
    expect(html).toContain("Hello");
    expect(html).toContain("<ul");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<code");
    expect(html).toContain("inline code");
  });

  it("renders GFM-style pipe tables", () => {
    const html = renderMarkdown(
      [
        "## Pricing",
        "",
        "| Tier | Cost |",
        "| --- | ---: |",
        "| Free | 0 |",
        "| Pro | 20 |",
      ].join("\n"),
    );
    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("<tbody");
    expect(html).toContain("Tier");
    expect(html).toContain("Cost");
    expect(html).toContain("Free");
    expect(html).toContain("Pro");
    // Right alignment from `---:` separator.
    expect(html).toContain("text-right");
  });

  it("does not treat random pipes as a table", () => {
    const html = renderMarkdown("This sentence contains | a pipe character.");
    expect(html).not.toContain("<table");
    expect(html).toContain("<p");
  });

  it("escapes HTML in inline content", () => {
    const html = renderMarkdown("Beware of <script>alert(1)</script>.");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders blockquotes and italics", () => {
    const html = renderMarkdown(
      ["> A *quoted* line.", "> Continues.", "", "Plain *italic* text."].join(
        "\n",
      ),
    );
    expect(html).toContain("<blockquote");
    expect(html).toContain("<em>quoted</em>");
    expect(html).toContain("<em>italic</em>");
  });

  it("does not italicize identifiers with underscores", () => {
    const html = renderMarkdown("Use snake_case_names in tests.");
    expect(html).not.toContain("<em>");
    expect(html).toContain("snake_case_names");
  });

  it("emits stable, slugified heading ids with hover anchors", () => {
    const { html, headings } = renderMarkdownWithHeadings(
      ["## Hello, world!", "", "## Hello, world!"].join("\n"),
    );
    expect(headings).toHaveLength(2);
    expect(headings[0]!.id).toBe("hello-world");
    expect(headings[1]!.id).toBe("hello-world-2");
    expect(html).toContain('id="hello-world"');
    expect(html).toContain('id="hello-world-2"');
    expect(html).toContain('href="#hello-world"');
  });

  it("supports h4 headings", () => {
    const { html, headings } = renderMarkdownWithHeadings("#### sub-section");
    expect(headings).toHaveLength(1);
    expect(headings[0]!.level).toBe(4);
    expect(html).toContain("<h4");
  });

  it("slugifies tricky heading text", () => {
    expect(slugifyHeading("What is a `run bundle`?")).toBe(
      "what-is-a-run-bundle",
    );
    expect(slugifyHeading("  Multiple   spaces -- here ")).toBe(
      "multiple-spaces-here",
    );
  });
});
