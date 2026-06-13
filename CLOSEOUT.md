# Closeout: Hotfix - Retain unsafe-eval for Ajv CSP compatibility

This hotfix restores `'unsafe-eval'` to the production nonce-mode
`script-src` because `@llm-workbench/runtime`'s Ajv-backed `SchemaRegistry`
compiles validators in the browser with `new Function`. The nonce +
`'strict-dynamic'` inline-injection protection remains in place; removing eval
is re-tracked behind an Ajv standalone/precompiled-validator slice.

## Motivating Incident

Production `/runs/demo` failed after #17 with the browser reporting:

```text
EvalError: Evaluating a string as JavaScript violates the following Content Security
Policy directive because 'unsafe-eval' is not an allowed source of script: script-src
'self' 'nonce-...' 'strict-dynamic' 'unsafe-inline' ...
```

The prior e2e console filter matched only `/Refused to (execute|load)[^]*script/i`,
which cannot match this EvalError wording. The new `/runs/demo` regression pin
looks for CSP messages that reference `script-src`, so it catches both classic
script execution/load failures and eval violations while ignoring unrelated
dev-key Clerk `connect-src` noise.

## Evidence

### Focused CSP unit test

`npm test -w @llm-workbench/web -- lib/security/csp.test.ts --reporter verbose`

```text
> @llm-workbench/web@0.1.0 test
> vitest run --passWithNoTests lib/security/csp.test.ts --reporter verbose

 RUN  v4.1.5 /Users/roymcfarland/Projects/llm-workbench/apps/web

 ✓ lib/security/csp.test.ts > contentSecurityPolicy > uses nonce plus strict-dynamic and retains unsafe-eval for Ajv in production 5ms
 ✓ lib/security/csp.test.ts > contentSecurityPolicy > keeps unsafe-inline as a CSP2 fallback in production nonce mode 0ms
 ✓ lib/security/csp.test.ts > contentSecurityPolicy > keeps the permissive development script policy 0ms
 ✓ lib/security/csp.test.ts > contentSecurityPolicy > preserves the legacy production script policy without a nonce 0ms
 ✓ lib/security/csp.test.ts > contentSecurityPolicy > keeps non-script hardening directives unchanged in both modes 1ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

### Full CI

`npm run ci`

Result: exit 0. Workspace Vitest count remains 250:

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

Result: exit 0, no output; Chromium cache was already warm.

`cd apps/web && npm run test:e2e`

```text
Running 4 tests using 1 worker

  ✓  1 [chromium] › e2e/smoke.spec.ts:4:3 › Public smoke (no sign-in) › GET /api/health (334ms)
  ✓  2 [chromium] › e2e/smoke.spec.ts:11:3 › Public smoke (no sign-in) › GET /llms.txt (route handler, no document handshake) (11ms)
  ✓  3 [chromium] › e2e/smoke.spec.ts:22:3 › Public smoke (no sign-in) › GET / renders under strict CSP without script violations (1.2s)
  ✓  4 [chromium] › e2e/smoke.spec.ts:52:3 › Public smoke (no sign-in) › GET /runs/demo renders the workbench under strict CSP without script or eval violations (302ms)

  4 passed (4.8s)
```
