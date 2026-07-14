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

  it("unescapes TypeDoc-style backslash-escaped punctuation to the literal character", () => {
    const html = renderMarkdown(
      "Returns \\{ amount: number; currency: string \\} | undefined.",
    );
    expect(html).toContain("{ amount: number; currency: string }");
    expect(html).not.toContain("\\{");
    expect(html).not.toContain("\\}");
  });

  it("re-escapes unescaped angle brackets for HTML instead of leaking them raw", () => {
    const html = renderMarkdown("Type: \\<T\\>.");
    expect(html).toContain("&lt;T&gt;");
    expect(html).not.toContain("<T>");
  });

  it("does not let an unescaped underscore trigger italics", () => {
    const html = renderMarkdown("snake\\_case\\_example");
    expect(html).not.toContain("<em>");
    expect(html).toContain("snake_case_example");
  });

  it("does not let unescaped brackets form a link", () => {
    const html = renderMarkdown("See \\[note\\] here.");
    expect(html).not.toContain("<a ");
    expect(html).toContain("See [note] here.");
  });

  it("unescapes a backslash-escaped pipe to a literal character", () => {
    const html = renderMarkdown("A \\| B");
    expect(html).toContain("A | B");
  });

  it("still escapes HTML-unsafe characters even when they arrive via an escape sequence", () => {
    // Guards the restore step: it must re-run escape() on the unescaped
    // character, not splice it back in raw.
    const html = renderMarkdown("\\<script\\>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("namespaces heading ids with idPrefix so concatenated documents don't collide", () => {
    const runtime = renderMarkdownWithHeadings("## Parameters", {
      idPrefix: "runtime",
    });
    const ui = renderMarkdownWithHeadings("## Parameters", { idPrefix: "ui" });
    expect(runtime.headings[0]!.id).toBe("runtime-parameters");
    expect(ui.headings[0]!.id).toBe("ui-parameters");
    expect(runtime.html).toContain('id="runtime-parameters"');
    expect(ui.html).toContain('id="ui-parameters"');
  });

  it("still uniquifies same-prefixed duplicate headings within one render", () => {
    const { headings } = renderMarkdownWithHeadings(
      ["## Parameters", "", "## Parameters"].join("\n"),
      { idPrefix: "runtime" },
    );
    expect(headings[0]!.id).toBe("runtime-parameters");
    expect(headings[1]!.id).toBe("runtime-parameters-2");
  });

  it("omitting idPrefix behaves exactly as before (unprefixed slug)", () => {
    const { headings } = renderMarkdownWithHeadings("## Parameters");
    expect(headings[0]!.id).toBe("parameters");
  });
});
