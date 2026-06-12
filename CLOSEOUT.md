# Closeout: Slice 2 - Fail-closed API rate limiting in production

`apps/web` now fails closed for API rate limiting in production: when Upstash
Redis env vars are absent, `/api/*` routes return `503` with JSON,
`Retry-After`, and the same CSP header discipline used by the existing `429`
path. `/api/health`, non-API routes, development/test, and deliberate production
opt-out via `RATE_LIMIT_ALLOW_UNCONFIGURED=1` remain no-ops. The legacy
`X-Frame-Options` header is now `DENY`, matching the existing CSP
`frame-ancestors 'none'` policy.

---

## Evidence

### 1. New rate-limit decision tests

`npm test -w @llm-workbench/web -- lib/rate-limit/edge.test.ts --reporter verbose`

```
> @llm-workbench/web@0.1.0 test
> vitest run --passWithNoTests lib/rate-limit/edge.test.ts --reporter verbose


 RUN  v4.1.5 /Users/roymcfarland/Projects/llm-workbench/apps/web

 ✓ lib/rate-limit/edge.test.ts > rateLimitApiIfConfigured > returns 503 for API requests in production when Upstash is missing and no opt-out is set 32ms
 ✓ lib/rate-limit/edge.test.ts > rateLimitApiIfConfigured > returns null in production without Upstash when RATE_LIMIT_ALLOW_UNCONFIGURED=1 1ms
 ✓ lib/rate-limit/edge.test.ts > rateLimitApiIfConfigured > returns null outside production when Upstash is missing 1ms
 ✓ lib/rate-limit/edge.test.ts > rateLimitApiIfConfigured > skips /api/health even when production Upstash config is missing 1ms
 ✓ lib/rate-limit/edge.test.ts > rateLimitApiIfConfigured > returns null for non-API paths before rate-limit enforcement 1ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

### 2. Web suite output

`npm test -w @llm-workbench/web`

```
> @llm-workbench/web@0.1.0 test
> vitest run --passWithNoTests


 RUN  v4.1.5 /Users/roymcfarland/Projects/llm-workbench/apps/web


 Test Files  9 passed (9)
      Tests  67 passed (67)
```

### 3. Full CI

`npm run ci` passed. Test counts are 235 baseline + 5 new tests = 240 total:

```
@llm-workbench/runtime        103
@llm-workbench/adapters-react   1
@llm-workbench/ai-sdk          27
@llm-workbench/ui              13
@llm-workbench/mcp             11
test:scripts                   18
@llm-workbench/web             67
```

Last lines from the successful `npm run ci`:

```
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

### 4. `X-Frame-Options` alignment

Before:

```
{ key: "X-Frame-Options", value: "SAMEORIGIN" },
```

After:

```
{ key: "X-Frame-Options", value: "DENY" },
```
