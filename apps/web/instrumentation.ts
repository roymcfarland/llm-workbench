export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(
  err: unknown,
  request: { path?: string },
  context: unknown,
): Promise<void> {
  const hasDsn = Boolean(
    process.env.SENTRY_DSN?.trim() ||
      process.env.NEXT_PUBLIC_SENTRY_DSN?.trim(),
  );
  if (!hasDsn) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.captureException(err, {
    extra: { path: request?.path, context },
  });
}
