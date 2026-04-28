/** Default port for `next start` + Playwright; override with `PLAYWRIGHT_WEB_PORT`. */
export const DEFAULT_PLAYWRIGHT_PORT = 3399;

/**
 * Resolves TCP port for smoke E2E. Invalid or empty env falls back to {@link DEFAULT_PLAYWRIGHT_PORT}.
 */
export function parseListenPortFromEnv(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env.PLAYWRIGHT_WEB_PORT?.trim();
  if (!raw) return DEFAULT_PLAYWRIGHT_PORT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    return DEFAULT_PLAYWRIGHT_PORT;
  }
  return n;
}
