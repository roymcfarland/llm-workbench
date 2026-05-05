import { describe, expect, it } from "vitest";

import { renderMarkdown } from "./markdown";

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
});
