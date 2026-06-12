# Closeout: Slice 3 - Nonce-based strict production CSP

This slice moves production-rendered pages to a nonce-based `script-src` with
`'strict-dynamic'`. Development and no-arg callers keep the legacy script policy
so Turbopack HMR and non-rendering response paths keep working.

## Architectural Choices

- `contentSecurityPolicy(nonce?: string)` is additive. With no nonce, it emits
  the legacy policy byte-for-byte for callers such as the rate-limit failure
  response.
- Middleware generates one nonce per request, forwards both `x-nonce` and the
  full CSP on request headers, and sets the same CSP on the response.
- `RootLayout` reads `x-nonce`, passes `dynamic` to `ClerkProvider`, and passes
  `nonce` to `ThemeProvider`.
- `style-src 'unsafe-inline'` is unchanged. This is an accepted residual risk
  because Monaco, React Flow, and theme inline styles still depend on it.
- The page e2e seeds Clerk's local dev-browser cookie so the dummy CI Clerk key
  stays signed out instead of redirecting document navigation to the external
  Clerk handshake endpoint.

## Evidence

### Focused CSP unit test

`npm test -w @llm-workbench/web -- lib/security/csp.test.ts`

```text
> @llm-workbench/web@0.1.0 test
> vitest run --passWithNoTests lib/security/csp.test.ts

 RUN  v4.1.5 /Users/roymcfarland/Projects/llm-workbench/apps/web

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  225ms
```

### Full CI

`npm run ci`

Result: exit 0. Workspace test count is now 250:

```text
runtime: 105
adapters-react: 1
ai-sdk: 27
ui: 13
mcp: 14
scripts: 18
web: 72
total: 250
```

Last CI lines:

```text
├ ƒ /feed.xml
├ ƒ /humans.txt
├ ƒ /llms-full.txt
├ ƒ /llms.txt
├ ○ /opengraph-image
├ ƒ /playground
├ ƒ /robots.txt
├ ƒ /runs
├ ƒ /runs/[runId]
├ ƒ /runs/demo
├ ƒ /sign-in/[[...sign-in]]
├ ƒ /sign-up/[[...sign-up]]
├ ƒ /sitemap.xml
└ ○ /twitter-image


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand
```

### E2E smoke

`cd apps/web && npx playwright install chromium`

```text
Removing unused browser at /Users/roymcfarland/Library/Caches/ms-playwright/chromium-1217
Removing unused browser at /Users/roymcfarland/Library/Caches/ms-playwright/chromium_headless_shell-1217
```

`cd apps/web && npm run test:e2e`

```text
Running 3 tests using 1 worker

  ✓  1 [chromium] › e2e/smoke.spec.ts:4:3 › Public smoke (no sign-in) › GET /api/health (346ms)
  ✓  2 [chromium] › e2e/smoke.spec.ts:11:3 › Public smoke (no sign-in) › GET /llms.txt (route handler, no document handshake) (14ms)
  ✓  3 [chromium] › e2e/smoke.spec.ts:22:3 › Public smoke (no sign-in) › GET / renders under strict CSP without script violations (909ms)

  3 passed (3.6s)
```

### Local production CSP transcript

`cd apps/web && npm run build`

```text
✓ Compiled successfully in 8.2s
✓ Completed runAfterProductionCompile in 565ms
✓ Generating static pages using 7 workers (51/51) in 882ms
```

`cd apps/web && env NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZXhhbXBsZS5hY2NvdW50cy5kZXYk CLERK_SECRET_KEY=sk_test_dGVzdCUyMF9zZWNyZXRfa2V5X2Zvcl9lMmU NEXT_PUBLIC_SITE_ORIGIN=http://localhost:3399 npm run start -- --hostname 0.0.0.0 --port 3399`

```text
▲ Next.js 16.2.9
- Local:         http://localhost:3399
- Network:       http://0.0.0.0:3399
✓ Ready in 90ms
```

`curl -i http://0.0.0.0:3399/`

```text
HTTP/1.1 200 OK
content-security-policy: default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'nonce-cz6UMLS/AE0NmOFsdJELoA==' 'strict-dynamic' 'unsafe-inline' https://*.clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.vercel-scripts.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev wss://*.clerk.com https://clerk-telemetry.com https://*.supabase.co wss://*.supabase.co wss://*.supabase.io https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://vercel.live https://*.vercel-insights.com https://vitals.vercel-insights.com https://*.vercel.com https://*.vercel.app https://*.vercel.sh; frame-src 'self' https://*.clerk.com https://challenges.cloudflare.com; worker-src 'self' blob:; media-src 'self' blob:; child-src 'self' blob:; upgrade-insecure-requests
```

Executable script count from a saved 200 HTML response. The nonce differs on
each request, as intended.

```text
executable_scripts=47
noncified_executable_scripts=47
unnonced_executable_scripts=0
```
