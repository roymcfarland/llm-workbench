import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const layoutPath = fileURLToPath(new URL("../app/layout.tsx", import.meta.url));
const layout = readFileSync(layoutPath, "utf8");
const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("self-hosted web fonts", () => {
  it("does not import next/font/google, which fetches fonts during builds", () => {
    expect(layout).not.toMatch(/\bimport\s+[\s\S]*?\bfrom\s*["']next\/font\/google["']/);
  });

  it("imports the next/font/local loader", () => {
    expect(layout).toMatch(/\bimport\s+localFont\s+from\s*["']next\/font\/local["']/);
  });

  it.each(["--font-outfit", "--font-jetbrains", "--font-newsreader"])(
    "keeps %s in both the layout and globals.css",
    (variable) => {
      expect(layout).toContain(variable);
      expect(globals).toContain(variable);
    },
  );

  it("references three local WOFF2 files that exist and are non-empty", () => {
    const sources = Array.from(
      layout.matchAll(/\bsrc\s*:\s*["']([^"']+\.woff2)["']/g),
      (match) => match[1],
    );
    expect(sources).toEqual([
      "./fonts/outfit-latin-wght-normal.woff2",
      "./fonts/jetbrains-mono-latin-wght-normal.woff2",
      "./fonts/newsreader-latin-wght-normal.woff2",
    ]);
    for (const source of sources) {
      const fontPath = resolve(dirname(layoutPath), source);
      expect(existsSync(fontPath), `${source} must exist`).toBe(true);
      expect(statSync(fontPath).isFile(), `${source} must be a file`).toBe(true);
      expect(statSync(fontPath).size, `${source} must be non-empty`).toBeGreaterThan(0);
    }
  });
});
