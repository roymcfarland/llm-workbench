import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const API_REFERENCE_FILES = {
  runtime: { title: "Runtime", fileName: "runtime.src.md" },
  ui: { title: "UI", fileName: "ui.src.md" },
  "adapters-react": {
    title: "Adapters-React",
    fileName: "adapters-react.src.md",
  },
  "ai-sdk": { title: "AI SDK", fileName: "ai-sdk.src.md" },
  mcp: { title: "MCP", fileName: "mcp.src.md" },
} as const;

export const API_REFERENCE_PACKAGES = [
  { name: "runtime", ...API_REFERENCE_FILES.runtime },
  { name: "ui", ...API_REFERENCE_FILES.ui },
  { name: "adapters-react", ...API_REFERENCE_FILES["adapters-react"] },
  { name: "ai-sdk", ...API_REFERENCE_FILES["ai-sdk"] },
  { name: "mcp", ...API_REFERENCE_FILES.mcp },
] as const;

export type ApiReferencePackageName = keyof typeof API_REFERENCE_FILES;

function normalizeApiReferenceMarkdown(markdown: string): string {
  return markdown
    .replace(/^# [^\n]+\n+/, "")
    .replace(/^\*\*\*\s*$/gm, "")
    .replace(/\[([^\]]+)\]\(#[^)]+\)/g, "$1")
    .replace(/^#{2,6}(?=\s)/gm, (heading) =>
      "#".repeat(Math.min(4, heading.length + 1)),
    )
    .trim();
}

export async function getApiReferenceMarkdown(
  packageName: ApiReferencePackageName,
): Promise<string> {
  const { fileName } = API_REFERENCE_FILES[packageName];
  const filePath = path.join(process.cwd(), ".typedoc-cache", fileName);

  try {
    return normalizeApiReferenceMarkdown(await fs.readFile(filePath, "utf8"));
  } catch {
    return "_API reference not yet generated for this build. Run `npm run docs:api` and reload._";
  }
}
