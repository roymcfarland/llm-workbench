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
/**
 * Clerk's production instances use a custom Frontend API domain (e.g.
 * `clerk.llmworkbench.io`) that the `*.clerk.*` wildcards do NOT match. The host
 * is encoded in the publishable key (`pk_(test|live)_<base64("<host>$")>`), so
 * derive it and allow it across the Clerk-facing directives. Returns e.g.
 * `https://clerk.llmworkbench.io`, or null when no valid key is present.
 */
function clerkFrontendApiOrigin(): string | null {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (!pk) return null;
  try {
    const host = atob(pk.replace(/^pk_(test|live)_/, ""))
      .replace(/\$+$/, "")
      .trim();
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host) ? `https://${host}` : null;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(nonce?: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const extraConnect = (process.env.CSP_EXTRA_CONNECT_SRC ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Clerk's prod custom Frontend API domain isn't covered by the *.clerk.*
  // wildcards; derive it from the publishable key and allow it everywhere Clerk
  // needs it — script load, API fetch/websocket, and frames.
  const clerkFapi = clerkFrontendApiOrigin();
  const clerkHosts = [
    "https://*.clerk.com",
    "https://*.clerk.accounts.dev",
    ...(clerkFapi ? [clerkFapi] : []),
  ];

  const connectParts = [
    "'self'",
    ...clerkHosts,
    "wss://*.clerk.com",
    ...(clerkFapi ? [clerkFapi.replace(/^https:/, "wss:")] : []),
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

  const clerkScriptHosts = clerkHosts.join(" ");
  const scriptSrc =
    nonce && isProd
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' ${clerkScriptHosts} https://challenges.cloudflare.com https://*.vercel-scripts.com`
      : `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${clerkScriptHosts} https://challenges.cloudflare.com https://*.vercel-scripts.com`;

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
    `frame-src 'self' ${clerkHosts.join(" ")} https://challenges.cloudflare.com`,
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
