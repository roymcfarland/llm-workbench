# Closeout: Slice 4.5 - CI Playwright install hardening

This slice hardens the Node 24 CI path against Playwright install wedges and
bumps the affected Playwright package to the fixed release without changing the
job matrix or the existing install/test commands.

- `build-test` now has a 20-minute job timeout.
- The existing Chromium install step now has a 10-minute timeout.
- The existing Playwright smoke step now has an 8-minute timeout.
- Node 24 runs cache `~/.cache/ms-playwright` with a key derived from the
  installed `@playwright/test` package version.
- `apps/web` now requests `@playwright/test` `^1.60.0`.

## Root cause

GitHub runners now resolve `node-version: 24` to Node 24.16.0. Playwright
1.59.1 is affected by a yauzl zip-extraction hang on Node 24.16+; the failed PR
run reproduced that shape by downloading Chromium to 100% and then timing out in
`Install Playwright Chromium`. Playwright 1.60.0 contains the upstream fix
tracked in microsoft/playwright#41000, so this amendment bumps the direct
`apps/web` dev dependency to `@playwright/test` `^1.60.0`.

---

## Evidence

### Playwright bump

`npm ls @playwright/test`

```
llm-workbench@ /Users/roymcfarland/Projects/llm-workbench
└─┬ @llm-workbench/web@0.1.0 -> ./apps/web
  ├── @playwright/test@1.60.0
  └─┬ next@16.2.9
    └── @playwright/test@1.59.1
```

### Changed workflow region

```yaml
jobs:
  build-test:
    name: build & test (node ${{ matrix.node }})
    runs-on: ubuntu-latest
    timeout-minutes: 20
    # Align NEXT_PUBLIC_* and PLAYWRIGHT_WEB_PORT with apps/web/e2e/env.ts + e2e/listen-port.ts
    # (default port 3399) so build output matches Playwright smoke `next start` (CI-only placeholders).
    env:
      # Run embedded @actions/*.js scripts on Node 24 (GH is deprecating the Node 20 action runtime).
      FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"
      PLAYWRIGHT_WEB_PORT: "3399"
      NEXT_PUBLIC_SITE_ORIGIN: http://localhost:3399
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk_test_ZXhhbXBsZS5hY2NvdW50cy5kZXYk
      CLERK_SECRET_KEY: sk_test_dGVzdCUyMF9zZWNyZXRfa2V5X2Zvcl9lMmU
    strategy:
      fail-fast: false
      matrix:
        node: ["22", "24"]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node ${{ matrix.node }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: npm

      - name: Install
        run: npm ci

      - name: Build all packages
        run: npm run build

      - name: Test
        run: npm test

      - name: Web typecheck
        run: npm run typecheck -w @llm-workbench/web

      - name: Web lint
        run: npm run lint -w @llm-workbench/web

      - name: Web production build
        run: npm run build:web

      - name: Get Playwright version
        if: matrix.node == '24'
        id: playwright-version
        working-directory: apps/web
        run: echo "version=$(node -p "require('@playwright/test/package.json').version")" >> "$GITHUB_OUTPUT"

      - name: Cache Playwright browsers
        if: matrix.node == '24'
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: ${{ runner.os }}-playwright-${{ steps.playwright-version.outputs.version }}

      - name: Install Playwright Chromium
        if: matrix.node == '24'
        timeout-minutes: 10
        working-directory: apps/web
        run: npx playwright install --with-deps chromium

      - name: Playwright smoke
        if: matrix.node == '24'
        timeout-minutes: 8
        working-directory: apps/web
        env:
          # Linux runners resolve localhost; the DNS shim can break Next 16's internal proxy.
          LLM_WB_E2E_DISABLE_DNS_SHIM: "1"
        run: npm run test:e2e
```

### Local verification

- YAML validation passed:
  `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"`
- `npm install` changed only `apps/web/package.json` and `package-lock.json`
  before ledger updates.
- `npx playwright install chromium` completed under `apps/web` with Playwright
  1.60.0.
- `npm run test:e2e` passed:

```
> @llm-workbench/web@0.1.0 test:e2e
> node ./scripts/run-playwright-e2e.mjs

Running 2 tests using 1 worker

  ✓  1 [chromium] › e2e/smoke.spec.ts:4:3 › Public smoke (no sign-in) › GET /api/health (345ms)
  ✓  2 [chromium] › e2e/smoke.spec.ts:11:3 › Public smoke (no sign-in) › GET /llms.txt (route handler, no document handshake) (23ms)

  2 passed (2.3s)
```

### PR CI status

The first PR run proved the guardrail: Node 24 failed at the 10-minute
`Install Playwright Chromium` timeout after the browser download reached 100%.
The amended PR CI status after the Playwright 1.60 bump is recorded in the final
task report.
