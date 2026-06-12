# Closeout: Slice 1 - Dependency advisory remediation (lockfile-only)

Plain `npm audit fix` regenerated `package-lock.json` without touching any
`package.json` range or source/config file. The high/critical advisory gate now
passes, including the load-bearing Next.js middleware/proxy bypass and the
Vitest UI arbitrary-file-read advisory. The registry currently leaves 12
moderate/low findings for later slices; no `npm audit fix --force` was used.

---

## Evidence

### 1. Baseline `npm audit` tail

Captured on the fresh branch before `npm audit fix`:

```
To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force
```

The builder prompt baseline for this slice was 21 vulnerabilities: 1 critical,
4 high, 13 moderate, and 3 low.

### 2. Baseline test count

`npm test` before the lockfile update reported 80 total tests:

```
> test:scripts
> vitest run --config scripts/vitest.config.mjs

 RUN  v3.2.4 /Users/roymcfarland/Projects/llm-workbench

 ✓ scripts/bootstrap.test.mjs (18 tests) 5ms

 Test Files  1 passed (1)
      Tests  18 passed (18)

> @llm-workbench/web@0.1.0 test
> vitest run --passWithNoTests

 RUN  v4.1.5 /Users/roymcfarland/Projects/llm-workbench/apps/web

 Test Files  8 passed (8)
      Tests  62 passed (62)
```

Baseline total: 18 + 62 = 80 tests.

### 3. Advisory gate after `npm audit fix`

`npm audit --audit-level=high; echo "exit: $?"` exits 0 after the lockfile
update:

```
12 vulnerabilities (3 low, 9 moderate)

To address issues that do not require attention, run:
  npm audit fix

To address all issues possible (including breaking changes), run:
  npm audit fix --force

Some issues need review, and may require choosing
a different dependency.
exit: 0
```

Residual moderate/low findings remain in `@ai-sdk/provider-utils`/`ai`,
`dompurify` via `monaco-editor`, `postcss` via `next`, and `uuid` via
`svix`/`resend`. These are below the high/critical gate and require separate
range or upstream dependency decisions.

### 4. Post-fix `npm audit` tail

```
To address all issues possible (including breaking changes), run:
  npm audit fix --force

Some issues need review, and may require choosing
a different dependency.
```

### 5. `npm ls next vitest`

```
│ └── vitest@3.2.6 deduped
│ └── vitest@3.2.6 deduped
│ └── vitest@3.2.6 deduped
│ └── vitest@3.2.6 deduped
│ └── vitest@3.2.6 deduped
│ │ └── next@16.2.9 deduped
│ │ └── next@16.2.9 deduped
│ ├── next@16.2.9
│ └── vitest@4.1.5
└── vitest@3.2.6
```

There is no `vitest@<3.2.6` in the workspace. `npm audit fix` resolved Next.js
from 16.2.4 to 16.2.9; `npm view next@16.3.0 version` returned a registry 404,
so the pre-confirmed `next@>=16.3.0` expectation is not satisfiable from the
current npm registry.

### 6. Test count comparison

Baseline captured tail: 18 + 62 = 80 tests.

Post-fix comparable `npm run ci` tail: 18 + 62 = 80 tests.

Full post-fix `npm run ci` test phase: 235 tests.

```
@llm-workbench/runtime      103
@llm-workbench/adapters-react 1
@llm-workbench/ai-sdk       27
@llm-workbench/ui           13
@llm-workbench/mcp          11
test:scripts                18
@llm-workbench/web          62
```

### 7. Clean install and CI verification

`npm ci` passed from scratch after removing workspace `node_modules`
directories. It rebuilt 1,220 packages from `package-lock.json` and reported
the expected residual advisory count:

```
added 1220 packages, and audited 1229 packages in 16s

12 vulnerabilities (3 low, 9 moderate)
```

`npm run ci` passed after rerunning outside the sandbox. The first sandboxed
attempt failed in `next build` because Turbopack attempted to bind a local port
and the sandbox returned `Operation not permitted`; the escalated rerun passed.

Last lines from the successful `npm run ci`:

```
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

`node` lockfile sanity check:

```
No package-lock major-version changes detected.
```

### 8. Playwright smoke

`npx playwright install chromium` completed successfully, then
`npm run test:e2e` passed locally from `apps/web`:

```
Running 2 tests using 1 worker

  ✓  1 [chromium] › e2e/smoke.spec.ts:4:3 › Public smoke (no sign-in) › GET /api/health (336ms)
  ✓  2 [chromium] › e2e/smoke.spec.ts:11:3 › Public smoke (no sign-in) › GET /llms.txt (route handler, no document handshake) (12ms)

  2 passed (2.3s)
```
