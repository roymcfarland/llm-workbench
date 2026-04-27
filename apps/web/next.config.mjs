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
};

export default nextConfig;
