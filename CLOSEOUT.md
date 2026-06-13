# Closeout: Moderate Advisory Cleanup (uuid via Resend; dompurify deferred)

This dependency slice removes the production-reachable `uuid` moderate advisory by
bumping `resend`, and documents why the `dompurify` moderate advisories are deferred
rather than overridden. No application source changes; the high-severity audit gate
stays at exit 0.

## Outcome

- **uuid — fixed.** `apps/web` `resend` `^6.12.2`→`^6.12.4`. Resend dropped Svix at
  6.12.3+ (its deps are now `postal-mime` + `standardwebhooks`), so the
  `svix`→`uuid@10.0.0` subtree is removed from the tree entirely. No override, no
  forced major.
- **dompurify — deferred (no real fix).** `monaco-editor@0.55.1` (latest) vendors its
  own DOMPurify copy and imports it directly; the `dompurify` npm package it declares
  is never imported. An override is both mechanically rejected by npm and runtime-inert,
  so it would be audit theater. Tracked for a future Monaco release.

## Files Changed

- `apps/web/package.json`
- `package-lock.json`
- `CHANGELOG.md`
- `CLOSEOUT.md`

(Root `package.json` is intentionally unchanged — no `dompurify` override is added.)

## Architectural choices

- **uuid via a Resend bump, not a uuid override.** Forcing `uuid@^11` under
  `svix@1.90.0` (which declares `^10`) would bypass semver on a server-side dependency.
  Bumping `resend` to `^6.12.4` removes Svix (and thus uuid) from the tree while staying
  within maintainer-blessed ranges. `apps/web` uses only `new Resend(apiKey)`, a stable
  API across 6.12.x.
- **dompurify deferred, not overridden.** Evidence the npm finding is a phantom:
  `monaco-editor/esm/vs/base/browser/domSanitize.js` does `import purify from
  './dompurify/dompurify.js'` (a vendored copy, version string "DOMPurify 3.2.7" baked
  into Monaco's source); `git grep` finds no first-party `dompurify` import; and
  `monaco-editor` is the only package declaring `dompurify` in the lockfile. Every
  override form tried (top-level, nested under `monaco-editor`, nested under
  `@monaco-editor/react`, exact and caret) left `dompurify@3.2.7` as `invalid …
  overridden`. This matches the same class of npm behavior already handled for esbuild.
- **esbuild override untouched.** `npm install` (not `npm audit fix`) was used so the
  `vite.esbuild: 0.28.1` override is not reshuffled.

## Evidence

### Audit gates

```text
npm audit --audit-level=high
high exit: 0

npm audit --omit=dev --audit-level=high
prod high exit: 0

npm audit
9 vulnerabilities (3 low, 6 moderate)
```

### Tree changes (svix/uuid removed; dompurify intentionally remains)

```text
npm ls resend
llm-workbench@ /Users/roymcfarland/Projects/llm-workbench
└─┬ @llm-workbench/web@0.1.0 -> ./apps/web
  └── resend@6.12.4

npm ls svix uuid
llm-workbench@ /Users/roymcfarland/Projects/llm-workbench
└── (empty)

npm ls esbuild
llm-workbench@ /Users/roymcfarland/Projects/llm-workbench
├─┬ @llm-workbench/web@0.1.0 -> ./apps/web
│ └─┬ vitest@4.1.5
│   └─┬ vite@8.0.16
│     └── esbuild@0.28.1 deduped
├─┬ job-search-demo@0.0.0 -> ./examples/job-search-demo
│ └─┬ vite@8.0.16
│   └── esbuild@0.28.1 overridden
└─┬ vitest@3.2.6
  └─┬ vite@7.3.5 overridden
    └── esbuild@0.28.1 deduped

npm ls dompurify
llm-workbench@ /Users/roymcfarland/Projects/llm-workbench
└─┬ @llm-workbench/ui@0.2.0 -> ./packages/ui
  └─┬ @monaco-editor/react@4.7.0
    └─┬ monaco-editor@0.55.1
      └── dompurify@3.2.7
```

### Full CI

`npm run ci`

```text
runtime: 147 tests passed
adapters-react: 1 test passed
ai-sdk: 27 tests passed
ui: 13 tests passed
mcp: 14 tests passed
scripts: 18 tests passed
web: 72 tests passed
total: 292 tests passed

✓ Compiled successfully in 12.9s
✓ Generating static pages using 7 workers (51/51) in 5.2s
Route (app)
ƒ Proxy (Middleware)
```

Next emitted non-fatal lockfile patch warnings during the web build, then exited 0.

### Demo build

`npm run build -w job-search-demo`

```text
vite v8.0.16 building client environment for production...
✓ 614 modules transformed.
✓ built in 145ms
```

### e2e smoke

`LLM_WB_E2E_DISABLE_DNS_SHIM=1 npm run test:e2e -w apps/web`

```text
Running 4 tests using 1 worker
✓  1 [chromium] › e2e/smoke.spec.ts:4:3 › Public smoke (no sign-in) › GET /api/health (328ms)
✓  2 [chromium] › e2e/smoke.spec.ts:11:3 › Public smoke (no sign-in) › GET /llms.txt (route handler, no document handshake) (24ms)
✓  3 [chromium] › e2e/smoke.spec.ts:22:3 › Public smoke (no sign-in) › GET / renders under strict CSP without script violations (950ms)
✓  4 [chromium] › e2e/smoke.spec.ts:52:3 › Public smoke (no sign-in) › GET /runs/demo renders the workbench under strict CSP without script or eval violations (327ms)

4 passed (4.0s)
```
