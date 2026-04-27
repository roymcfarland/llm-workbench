import { headers } from "next/headers";

export const SITE_NAME = "LLM Workbench" as const;
export const SITE_TAGLINE =
  "Model-agnostic LLM control plane: tamper-evident, human-gated, replayable run bundles." as const;
// Placeholder GitHub URL — repo is not yet public at this slug. Update when it lands.
export const GITHUB_URL = "https://github.com/llmworkbench/llm-workbench" as const;
export const LICENSE_NAME = "PolyForm Noncommercial 1.0.0" as const;
export const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE` as const;
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
