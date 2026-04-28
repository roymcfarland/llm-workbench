import "server-only";

import * as Sentry from "@sentry/nextjs";

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Log server-side failures and return a client-safe message. In production,
 * never forward raw `Error#message` for unexpected 500s — it may contain SQL,
 * paths, or provider details.
 */
export function logInternalError(context: string, err: unknown): void {
  const e = err instanceof Error ? err : new Error(String(err));
  console.error(`[${context}]`, e);
  Sentry.captureException(e, { tags: { context } });
}

export function publicInternalErrorMessage(
  context: string,
  err: unknown,
): string {
  logInternalError(context, err);
  return IS_PROD ? "Internal server error" : getPrivateMessage(err);
}

function getPrivateMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Internal error";
}

/** For authenticated MCP tool surfaces: generic copy in prod, detail in dev. */
export function publicToolFailureMessage(
  context: string,
  err: unknown,
  fallback: string,
): string {
  logInternalError(context, err);
  return IS_PROD ? fallback : getPrivateMessage(err);
}
