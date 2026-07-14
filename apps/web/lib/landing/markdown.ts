/**
 * Microscopic markdown → HTML renderer for the landing/docs surface. Handles
 * H1–H4 headings (with slugified ids and a hover-revealed `#` anchor),
 * paragraphs, fenced code blocks, unordered lists, GFM-style pipe tables,
 * blockquotes, inline `code`, **bold**, and *italic*. Anything more exotic
 * should be authored as JSX directly.
 */
function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(s: string): string {
  // inline code first so its contents are not further transformed
  const codeMarker: string[] = [];
  let withCode = s.replace(/`([^`]+)`/g, (_m, inner) => {
    const idx = codeMarker.push(escape(inner)) - 1;
    return `\u0000CODE${idx}\u0000`;
  });
  // backslash-escaped punctuation (TypeDoc escapes `<>{}[]|_` in generated
  // signatures so they survive markdown parsing untouched) -- unescape to the
  // literal character before the markup regexes below get a chance to
  // misinterpret it (e.g. `\_` as italics, `\[x\]` as a link fragment).
  const escapedMarker: string[] = [];
  withCode = withCode.replace(/\\([<>{}[\]|_])/g, (_m, ch) => {
    const idx = escapedMarker.push(ch) - 1;
    return `\u0000ESC${idx}\u0000`;
  });
  withCode = escape(withCode);
  // bold **text**
  withCode = withCode.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // italic *text* and _text_ — match single markers that don't touch
  // word characters on the wrong side, so things like `5 * 3` and
  // `snake_case` stay untouched.
  withCode = withCode.replace(
    /(^|[\s(])\*([^*\n]+?)\*(?=$|[\s).,;:!?])/g,
    "$1<em>$2</em>",
  );
  withCode = withCode.replace(
    /(^|[\s(])_([^_\n]+?)_(?=$|[\s).,;:!?])/g,
    "$1<em>$2</em>",
  );
  // links [label](url) — only http(s) and relative
  withCode = withCode.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, label, href) => {
      const safe = /^(https?:\/\/|\/)/.test(href) ? href : "#";
      return `<a href="${safe}" class="underline-offset-4 hover:underline text-cyan-300">${label}</a>`;
    },
  );
  // restore inline code
  withCode = withCode.replace(/\u0000CODE(\d+)\u0000/g, (_m, idx) => {
    return `<code class="rounded bg-[var(--color-muted)]/40 px-1 py-0.5 font-mono text-[0.85em]">${codeMarker[Number(idx)]}</code>`;
  });
  // restore unescaped punctuation, HTML-escaping it same as any other text
  withCode = withCode.replace(/\u0000ESC(\d+)\u0000/g, (_m, idx) => {
    return escape(escapedMarker[Number(idx)]!);
  });
  return withCode;
}

function isTableRow(s: string): boolean {
  return s.trim().startsWith("|") && s.trim().endsWith("|");
}

function isTableSeparator(s: string): boolean {
  // Header separator: | --- | :---: | ---: |
  if (!isTableRow(s)) return false;
  const cells = splitTableRow(s);
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-{3,}:?$/.test(c.trim()));
}

function splitTableRow(s: string): string[] {
  const trimmed = s.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function alignFromSep(sep: string): "left" | "center" | "right" {
  const t = sep.trim();
  const left = t.startsWith(":");
  const right = t.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  return "left";
}

/**
 * Slugify heading text for use as a stable `id`. Mirrors the GitHub-flavored
 * slug rules closely enough that links posted in chat / docs are predictable.
 */
export function slugifyHeading(input: string): string {
  return input
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function uniquifyId(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  const id = `${base}-${n}`;
  used.add(id);
  return id;
}

/**
 * One surface heading produced by the renderer. Useful for building tables
 * of contents from the same source the page renders from.
 */
export type RenderedHeading = {
  level: 1 | 2 | 3 | 4;
  /** Plain-text label (entities decoded; markup stripped). */
  text: string;
  id: string;
};

/**
 * Render markdown to HTML and (optionally) collect the headings that were
 * emitted so callers can build a sidebar TOC without re-parsing.
 *
 * `idPrefix` namespaces every heading id (e.g. `parameters` becomes
 * `runtime-parameters`) — needed when multiple independently-generated
 * markdown documents are concatenated onto one page and would otherwise
 * produce duplicate ids.
 */
export function renderMarkdownWithHeadings(
  src: string,
  options?: { idPrefix?: string },
): {
  html: string;
  headings: RenderedHeading[];
} {
  const idPrefix = options?.idPrefix;
  const lines = src.split("\n");
  const out: string[] = [];
  const headings: RenderedHeading[] = [];
  const usedIds = new Set<string>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    // fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.startsWith("```")) {
        buf.push(lines[i]!);
        i += 1;
      }
      i += 1;
      const cls = lang ? `language-${escape(lang)}` : "language-plain";
      out.push(
        `<pre class="my-4 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]/60 p-4 font-mono text-xs leading-relaxed"><code class="${cls}">${escape(buf.join("\n"))}</code></pre>`,
      );
      continue;
    }
    // headings (H1-H4 with slug ids and hover anchors)
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1]!.length as 1 | 2 | 3 | 4;
      const rawText = h[2]!;
      const text = inline(rawText);
      const plain = rawText.replace(/[`*_~]/g, "").trim();
      const slug = slugifyHeading(plain);
      const id = uniquifyId(idPrefix ? `${idPrefix}-${slug}` : slug, usedIds);
      headings.push({ level, text: plain, id });
      const sizes = [
        "text-3xl",
        "text-2xl",
        "text-lg",
        "text-base uppercase tracking-[0.18em] text-[var(--color-muted-foreground)]",
      ][level - 1];
      const margin =
        level === 1
          ? "mt-0 mb-6"
          : level === 2
            ? "mt-10 mb-4"
            : level === 3
              ? "mt-6 mb-2"
              : "mt-5 mb-2 font-mono";
      const fontFamily = level === 4 ? "" : "font-serif";
      out.push(
        `<h${level} id="${id}" class="group/heading scroll-mt-20 ${fontFamily} font-semibold tracking-tight ${sizes} ${margin}"><a href="#${id}" class="no-underline" aria-label="Anchor link to: ${escape(plain)}"><span class="mr-2 select-none text-[var(--color-muted-foreground)] opacity-0 transition-opacity group-hover/heading:opacity-60">#</span>${text}</a></h${level}>`,
      );
      i += 1;
      continue;
    }
    // unordered list (consecutive `- ` lines)
    if (/^- /.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^- /.test(lines[i]!)) {
        buf.push(`<li>${inline(lines[i]!.replace(/^- /, ""))}</li>`);
        i += 1;
      }
      out.push(
        `<ul class="my-4 ml-6 list-disc space-y-1 text-sm leading-relaxed text-zinc-100/90">${buf.join("")}</ul>`,
      );
      continue;
    }
    // blockquote (consecutive `> ` lines collapse into one paragraph)
    if (/^> ?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^> ?/.test(lines[i]!)) {
        buf.push(lines[i]!.replace(/^> ?/, ""));
        i += 1;
      }
      out.push(
        `<blockquote class="my-5 rounded-r-lg border-l-2 border-cyan-400/50 bg-[var(--color-card)]/40 px-4 py-3 text-sm italic leading-relaxed text-[var(--color-muted-foreground)]">${inline(
          buf.join(" "),
        )}</blockquote>`,
      );
      continue;
    }
    // GFM-style pipe table: header row, separator, then body rows.
    if (
      isTableRow(line) &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1]!)
    ) {
      const headerCells = splitTableRow(line);
      const aligns = splitTableRow(lines[i + 1]!).map(alignFromSep);
      i += 2;
      const bodyRows: string[][] = [];
      while (
        i < lines.length &&
        isTableRow(lines[i]!) &&
        !isTableSeparator(lines[i]!)
      ) {
        bodyRows.push(splitTableRow(lines[i]!));
        i += 1;
      }
      const alignClass = (idx: number): string => {
        const a = aligns[idx] ?? "left";
        if (a === "center") return "text-center";
        if (a === "right") return "text-right";
        return "text-left";
      };
      const headHtml = headerCells
        .map(
          (c, idx) =>
            `<th class="border-b border-[var(--color-border)] px-3 py-2 font-semibold ${alignClass(idx)}">${inline(c)}</th>`,
        )
        .join("");
      const bodyHtml = bodyRows
        .map(
          (row) =>
            `<tr class="transition-colors hover:bg-[var(--color-card)]/30">${row
              .map(
                (c, idx) =>
                  `<td class="border-b border-[var(--color-border)]/60 px-3 py-2 align-top ${alignClass(idx)}">${inline(c)}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("");
      out.push(
        `<div class="my-5 overflow-x-auto rounded-lg border border-[var(--color-border)]/70"><table class="w-full border-collapse text-sm leading-relaxed text-zinc-100/90"><thead class="bg-[var(--color-card)]/40"><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`,
      );
      continue;
    }
    // blank line
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    // paragraph: consume contiguous non-empty, non-special lines
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !/^#{1,4}\s+/.test(lines[i]!) &&
      !lines[i]!.startsWith("```") &&
      !/^- /.test(lines[i]!) &&
      !/^> ?/.test(lines[i]!) &&
      !(
        isTableRow(lines[i]!) &&
        i + 1 < lines.length &&
        isTableSeparator(lines[i + 1]!)
      )
    ) {
      buf.push(lines[i]!);
      i += 1;
    }
    out.push(
      `<p class="my-3 text-sm leading-relaxed text-zinc-100/90">${inline(buf.join(" "))}</p>`,
    );
  }
  return { html: out.join("\n"), headings };
}

/**
 * Convenience wrapper kept for callers that only need the HTML output.
 */
export function renderMarkdown(src: string): string {
  return renderMarkdownWithHeadings(src).html;
}
