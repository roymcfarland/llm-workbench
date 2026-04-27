import type { MetadataRoute } from "next";

import { siteOrigin } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const now = new Date();
  const paths = [
    "/",
    "/docs/protocol",
    "/runs/demo",
    "/playground",
    "/llms.txt",
    "/llms-full.txt",
    "/agents.md",
    "/api/openapi.json",
    "/.well-known/mcp.json",
  ];
  return paths.map((p) => ({
    url: `${origin}${p}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: p === "/" ? 1.0 : 0.7,
  }));
}
