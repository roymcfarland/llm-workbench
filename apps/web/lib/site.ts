import { headers } from "next/headers";

export const SITE_NAME = "LLM Workbench" as const;
export const BRIGHTLINE_LABS_NAME = "Brightline Labs" as const;
export const BRIGHTLINE_LABS_URL = "https://www.brightline.io" as const;
/** Hostname displayed on share cards and in copy (no scheme). */
export const SITE_SHARE_HOST = "www.llmworkbench.io" as const;
/** Alt text for OG / Twitter generated image routes and metadata. */
export const OG_IMAGE_ALT =
  "LLM Workbench — Ship LLM agents you can debug, fork, and replay. Tamper-evident bundles, MCP & OpenAPI." as const;

/** Blog index meta description (RSS, OG, listings). */
export const BLOG_INDEX_DESCRIPTION =
  "Articles on LLM Workbench — audit-ready run bundles, human gates, model-agnostic tracing, and the protocol behind replayable agents." as const;

/** Alt text for the blog index OG/Twitter image routes. */
export const BLOG_INDEX_OG_ALT =
  "LLM Workbench blog — audit-ready run bundles, human gates, and model-agnostic tracing." as const;

export function blogPostOgImageAlt(postTitle: string): string {
  return `${postTitle} — ${SITE_NAME} blog`;
}
export const SITE_TAGLINE =
  "Model-agnostic LLM control plane: tamper-evident, human-gated, replayable run bundles." as const;
export const GITHUB_URL = "https://github.com/roymcfarland/llm-workbench" as const;
export const LICENSE_NAME = "MIT" as const;
export const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE` as const;
/** npm organization scope for the published packages. */
export const NPM_ORG_URL = "https://www.npmjs.com/org/llm-workbench" as const;
export const DEFAULT_ORIGIN = "https://workbench.example.com" as const;

/**
 * Resolve the canonical site origin for the current request, falling back to a
 * known constant when called outside a request context (build-time, scripts).
 */
export async function siteOrigin(): Promise<string> {
  try {
    const h = await headers();
    const explicit = h.get("x-forwarded-host") || h.get("host");
    const proto =
      h.get("x-forwarded-proto") ||
      (process.env.NODE_ENV === "development" ? "http" : "https");
    if (explicit) return `${proto}://${explicit}`;
  } catch {
    // headers() throws when called outside a request scope; fall through.
  }
  return process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || DEFAULT_ORIGIN;
}

export function siteOriginSync(): string {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim() || DEFAULT_ORIGIN;
}
