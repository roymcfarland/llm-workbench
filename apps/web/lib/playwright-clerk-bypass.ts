/**
 * Playwright-only escape hatch for Clerk’s dev “handshake” on document navigations.
 * Used when CI uses Clerk placeholder keys (no `@clerk/testing` token API).
 *
 * Enabled only when `LLM_WB_PLAYWRIGHT_CLERK_BYPASS=1` (set by Playwright’s
 * `webServer` env). Production deploys must not set that variable.
 */
export const PLAYWRIGHT_CLERK_BYPASS_ENV = "LLM_WB_PLAYWRIGHT_CLERK_BYPASS";
export const PLAYWRIGHT_CLERK_BYPASS_SECRET_ENV =
  "LLM_WB_PLAYWRIGHT_CLERK_BYPASS_SECRET";
export const PLAYWRIGHT_CLERK_BYPASS_HEADER =
  "x-llm-wb-playwright-clerk-bypass";

/** Cookie mirror of the header so navigations keep bypass after Clerk redirects. */
export const PLAYWRIGHT_CLERK_BYPASS_COOKIE = "llm-wb-pw-clerk-bypass";

/** Public default so local `npm run test:e2e` matches `next start` without extra env. */
export const PLAYWRIGHT_CLERK_BYPASS_DEFAULT_SECRET =
  "llm-wb-playwright-clerk-bypass-dev-2026";

export function resolvePlaywrightClerkBypassSecret(): string {
  return (
    process.env[PLAYWRIGHT_CLERK_BYPASS_SECRET_ENV]?.trim() ||
    PLAYWRIGHT_CLERK_BYPASS_DEFAULT_SECRET
  );
}
