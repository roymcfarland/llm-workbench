export function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const stringify = (v: unknown): string => {
    if (v === undefined) return "null";
    if (v === null) return "null";
    if (typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(stringify).join(",")}]`;
    const obj = v as Record<string, unknown>;
    if (seen.has(obj)) return `"[cyclic]"`;
    seen.add(obj);
    const keys = Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined);
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stringify(obj[k])}`).join(",")}}`;
  };
  return stringify(value);
}

export function diffSummary(a: unknown, b: unknown): { equal: boolean; left: string; right: string } {
  const left = stableStringify(a);
  const right = stableStringify(b);
  return { equal: left === right, left, right };
}
