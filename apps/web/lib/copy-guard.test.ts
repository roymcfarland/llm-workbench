import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const webRoot = fileURLToPath(new URL("../", import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || relative(webRoot, path).replaceAll("\\", "/").includes("content/blog")) return [];
      return sourceFiles(path);
    }
    return /\.(?:test|spec)\.[^/]+$/.test(entry.name) ? [] : [path];
  });
}

const sources = ["app", "components", "lib"].flatMap((directory) =>
  sourceFiles(join(webRoot, directory)).map((path) => ({
    path: relative(webRoot, path),
    text: readFileSync(path, "utf8").replace(/\s+/g, " ").toLowerCase(),
  })),
);

describe("shipped copy accuracy", () => {
  it.each([
    "cryptographically signed",
    "signed bundle",
    "signed json",
    "signed artifact",
    "replay a run deterministically",
  ])("does not claim %s", (phrase) => {
    expect(sources.filter(({ text }) => text.includes(phrase)).map(({ path }) => path)).toEqual([]);
  });
});
