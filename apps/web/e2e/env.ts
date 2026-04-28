import { parseListenPortFromEnv } from "./listen-port";

/**
 * Shared defaults for Playwright smoke runs (`npm run test:e2e`) and CI.
 * These satisfy Clerk bootstrap; they are **not** for production deployments.
 *
 * Use **127.0.0.1** (not `localhost`) so resolver / sandbox setups that break
 * `localhost` stay stable. Port: see `PLAYWRIGHT_WEB_PORT` in `e2e/README.md`.
 */
export const E2E_LISTEN_PORT = parseListenPortFromEnv();
export const E2E_ORIGIN = `http://127.0.0.1:${E2E_LISTEN_PORT}` as const;

/** Matches Clerk docs / common CI placeholder patterns for pk_test_/sk_test_. */
export const E2E_CLERK_PUBLISHABLE_KEY =
  "pk_test_ZXhhbXBsZS5hY2NvdW50cy5kZXYk";
export const E2E_CLERK_SECRET_KEY =
  "sk_test_dGVzdCUyMF9zZWNyZXRfa2V5X2Zvcl9lMmU";
