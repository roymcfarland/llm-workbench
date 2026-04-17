export type RedactionPath = { path: string; replacement?: unknown };

/**
 * Very small redactor for export/logging: replaces values at JSON Pointer paths.
 * Paths use JSON Pointer tokens, e.g. ["/apiKey", "/user/email"].
 */
export function redactJson(input: { value: unknown; paths: string[]; replacement?: unknown }): unknown {
  const rep = input.replacement ?? "[REDACTED]";
  const root = structuredClone(input.value) as unknown;
  for (const p of input.paths) {
    try {
      setAtPointer(root, p, rep);
    } catch {
      // Skip invalid or non-applicable pointers so exports stay resilient to schema drift.
    }
  }
  return root;
}

function setAtPointer(root: unknown, pointer: string, replacement: unknown) {
  if (!pointer.startsWith("/")) throw new Error(`Invalid JSON pointer: ${pointer}`);
  const parts = pointer.split("/").slice(1).map(jsonPointerUnescape);
  let cur: unknown = root;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i]!;
    const last = i === parts.length - 1;
    if (last) {
      if (cur && typeof cur === "object" && !Array.isArray(cur)) {
        (cur as Record<string, unknown>)[key] = replacement;
      } else if (Array.isArray(cur)) {
        const idx = Number(key);
        if (!Number.isFinite(idx)) throw new Error(`Invalid array index: ${key}`);
        (cur as unknown[])[idx] = replacement;
      } else {
        throw new Error(`Cannot set path ${pointer}`);
      }
      return;
    }
    cur = drill(cur, key);
  }
}

function drill(cur: unknown, key: string): unknown {
  if (cur && typeof cur === "object" && !Array.isArray(cur)) return (cur as Record<string, unknown>)[key];
  if (Array.isArray(cur)) return (cur as unknown[])[Number(key)];
  throw new Error(`Cannot drill into path segment ${key}`);
}

function jsonPointerUnescape(s: string): string {
  return s.replaceAll("~1", "/").replaceAll("~0", "~");
}
