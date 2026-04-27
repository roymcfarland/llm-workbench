/**
 * Microscopic markdown → HTML renderer for the landing/docs surface. Handles
 * H1-H3 headings, paragraphs, fenced code blocks, unordered lists, and inline
 * `code` spans. Anything more exotic should be authored as JSX directly.
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
  withCode = escape(withCode);
  // bold **text**
  withCode = withCode.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
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
  return withCode;
}

export function renderMarkdown(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
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
      const cls = lang
        ? `language-${escape(lang)}`
        : "language-plain";
      out.push(
        `<pre class="my-4 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]/60 p-4 font-mono text-xs leading-relaxed"><code class="${cls}">${escape(buf.join("\n"))}</code></pre>`,
      );
      continue;
    }
    // headings
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1]!.length;
      const text = inline(h[2]!);
      const sizes = ["text-3xl", "text-2xl", "text-lg"][level - 1];
      const margin = level === 1 ? "mt-0 mb-6" : level === 2 ? "mt-10 mb-4" : "mt-6 mb-2";
      out.push(
        `<h${level} class="font-serif font-semibold tracking-tight ${sizes} ${margin}">${text}</h${level}>`,
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
      !/^#{1,3}\s+/.test(lines[i]!) &&
      !lines[i]!.startsWith("```") &&
      !/^- /.test(lines[i]!)
    ) {
      buf.push(lines[i]!);
      i += 1;
    }
    out.push(
      `<p class="my-3 text-sm leading-relaxed text-zinc-100/90">${inline(buf.join(" "))}</p>`,
    );
  }
  return out.join("\n");
}
