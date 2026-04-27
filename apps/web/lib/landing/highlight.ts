/**
 * Tiny TypeScript tokenizer for the landing-page code samples. We intentionally
 * avoid pulling in shiki / prism: the inputs are short, controlled, and the
 * output only needs to colour comments, strings, keywords, and identifiers.
 */
export type Tok =
  | { kind: "kw"; text: string }
  | { kind: "str"; text: string }
  | { kind: "com"; text: string }
  | { kind: "id"; text: string }
  | { kind: "num"; text: string }
  | { kind: "punct"; text: string }
  | { kind: "ws"; text: string };

const KEYWORDS = new Set([
  "import",
  "from",
  "const",
  "let",
  "var",
  "function",
  "return",
  "await",
  "async",
  "if",
  "else",
  "for",
  "while",
  "type",
  "interface",
  "export",
  "default",
  "new",
  "class",
  "true",
  "false",
  "null",
  "undefined",
  "as",
]);

export function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i]!;
    // Line comment
    if (c === "/" && src[i + 1] === "/") {
      let j = i;
      while (j < n && src[j] !== "\n") j++;
      toks.push({ kind: "com", text: src.slice(i, j) });
      i = j;
      continue;
    }
    // Block comment
    if (c === "/" && src[i + 1] === "*") {
      let j = i + 2;
      while (j < n - 1 && !(src[j] === "*" && src[j + 1] === "/")) j++;
      j = Math.min(n, j + 2);
      toks.push({ kind: "com", text: src.slice(i, j) });
      i = j;
      continue;
    }
    // Strings (', ", `)
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      let j = i + 1;
      while (j < n) {
        const ch = src[j];
        if (ch === "\\") {
          j += 2;
          continue;
        }
        if (ch === quote) {
          j++;
          break;
        }
        j++;
      }
      toks.push({ kind: "str", text: src.slice(i, j) });
      i = j;
      continue;
    }
    // Whitespace
    if (/\s/.test(c)) {
      let j = i;
      while (j < n && /\s/.test(src[j]!)) j++;
      toks.push({ kind: "ws", text: src.slice(i, j) });
      i = j;
      continue;
    }
    // Number
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < n && /[0-9._eE+-]/.test(src[j]!)) j++;
      toks.push({ kind: "num", text: src.slice(i, j) });
      i = j;
      continue;
    }
    // Identifier / keyword
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j]!)) j++;
      const text = src.slice(i, j);
      toks.push({ kind: KEYWORDS.has(text) ? "kw" : "id", text });
      i = j;
      continue;
    }
    // Punctuation / operator (single char)
    toks.push({ kind: "punct", text: c });
    i += 1;
  }
  return toks;
}

const COLOR: Record<Tok["kind"], string> = {
  kw: "text-violet-300",
  str: "text-emerald-300",
  com: "text-zinc-500 italic",
  id: "text-zinc-100",
  num: "text-amber-300",
  punct: "text-zinc-400",
  ws: "",
};

export function tokensToHtml(toks: Tok[]): string {
  return toks
    .map((t) => {
      if (t.kind === "ws") return escape(t.text);
      const cls = COLOR[t.kind];
      return `<span class="${cls}">${escape(t.text)}</span>`;
    })
    .join("");
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Split highlighted source into lines (preserving empty lines). */
export function highlightLines(src: string): string[] {
  const lines = src.split("\n");
  return lines.map((line) => tokensToHtml(tokenize(line)));
}
