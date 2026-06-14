/**
 * Browser Content-Security-Policy for Clerk, Next.js hydration, fonts, Supabase,
 * Vercel instrumentation, and Sentry. Tuned for this app; extend connect-src
 * via `CSP_EXTRA_CONNECT_SRC` (space-separated origins) if you add new API hosts.
 *
 * Development and no-nonce callers keep the legacy script policy so Turbopack
 * HMR and non-rendering response paths continue to work. Production HTML
 * responses pass a per-request nonce, which switches script-src to nonce +
 * strict-dynamic, leaving host sources and unsafe-inline only as CSP2 fallbacks.
 * Browser validators are precompiled with Ajv standalone at build time, so
 * production script-src does not need unsafe-eval.
 */
export function contentSecurityPolicy(nonce?: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const extraConnect = (process.env.CSP_EXTRA_CONNECT_SRC ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const connectParts = [
    "'self'",
    "https://*.clerk.com",
    "https://*.clerk.accounts.dev",
    "wss://*.clerk.com",
    "https://clerk-telemetry.com",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "wss://*.supabase.io",
    "https://*.sentry.io",
    "https://*.ingest.sentry.io",
    "https://*.ingest.us.sentry.io",
    "https://vercel.live",
    "https://*.vercel-insights.com",
    "https://vitals.vercel-insights.com",
    "https://*.vercel.com",
    "https://*.vercel.app",
    "https://*.vercel.sh",
    ...extraConnect,
  ];

  const scriptSrc =
    nonce && isProd
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https://*.clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.vercel-scripts.com`
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.vercel-scripts.com";

  const pieces = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectParts.join(" ")}`,
    "frame-src 'self' https://*.clerk.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "child-src 'self' blob:",
  ];

  if (isProd) {
    pieces.push("upgrade-insecure-requests");
  }

  return pieces.join("; ");
}

export function contentSecurityPolicyHeaderInit(nonce?: string): HeadersInit {
  return { "Content-Security-Policy": contentSecurityPolicy(nonce) };
}
