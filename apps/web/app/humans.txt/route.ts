import { WORKBENCH_PROTOCOL_VERSION } from "@llm-workbench/runtime";

import {
  BRIGHTLINE_LABS_NAME,
  BRIGHTLINE_LABS_URL,
  GITHUB_URL,
  LICENSE_NAME,
  SITE_NAME,
  siteOrigin,
} from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * https://humanstxt.org — small file that names the humans behind a site.
 * Crawlers ignore it, but it's a small SEO/citizenship signal and a nice
 * artifact for anyone curious enough to look.
 */
export async function GET(): Promise<Response> {
  const origin = await siteOrigin();
  const body = `/* TEAM */

  Maintainer: Roy McFarland
  Site: ${BRIGHTLINE_LABS_URL}
  Project: ${SITE_NAME}

/* THANKS */

  To everyone who shipped LLM agents into production and discovered
  that "the model worked" is rarely the same as "we can prove it."

/* SITE */

  Last update: ${new Date().toISOString().slice(0, 10)}
  Standards: HTML5, CSS, OpenAPI 3.1, Model Context Protocol, RSS 2.0
  Components: Next.js 16 (App Router), React 19, Tailwind v4, Clerk, Supabase
  Software: Built with TypeScript, AI SDK v5, ${BRIGHTLINE_LABS_NAME} stack
  Protocol: v${WORKBENCH_PROTOCOL_VERSION}
  License: ${LICENSE_NAME}
  Source: ${GITHUB_URL}
  Canonical: ${origin}

/* MACHINES */

  /robots.txt
  /sitemap.xml
  /feed.xml
  /llms.txt
  /llms-full.txt
  /agents.md
  /.well-known/mcp.json
  /api/openapi.json
`;
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
