import path from "node:path";
import { fileURLToPath } from "node:url";

import { withSentryConfig } from "@sentry/nextjs";

/** Monorepo root (avoids wrong Turbopack root when multiple lockfiles exist). */
const monorepoRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow importing TS sources from sibling workspace packages without separate builds.
  transpilePackages: [
    "@llm-workbench/runtime",
    "@llm-workbench/ui",
    "@llm-workbench/adapters-react",
    "@llm-workbench/ai-sdk",
  ],
  // Next.js 16 — Cache Components (PPR successor) is intentionally OFF here.
  //
  // Clerk's `<ClerkProvider>` reads request-scoped state during root layout
  // render, which trips Cache Components' "uncached data outside <Suspense>"
  // guard. Re-enable once `@clerk/nextjs` supports Cache Components natively
  // (track the upstream issue / changelog before flipping this back to true).
  // The pages and API routes in this app are all dynamic by intent, so the
  // current behaviour is functionally identical for the reference deployment.
  cacheComponents: false,

  turbopack: {
    root: monorepoRoot,
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  /** Legacy URLs from an earlier seeded blog reshaping */
  async redirects() {
    return [
      {
        source: "/blog/audit-trails-for-llm-agents",
        destination: "/blog/what-llm-workbench-solves",
        permanent: true,
      },
      {
        source: "/blog/human-gates-and-run-bundles",
        destination: "/blog/what-llm-workbench-solves",
        permanent: true,
      },
      {
        source: "/blog/model-agnostic-tracing-ai-sdk",
        destination: "/blog/who-benefits-and-how-to-start",
        permanent: true,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
});
