# Closeout: Esbuild High Advisory Remediation

This dependency slice clears the dev-inclusive high audit gate by forcing
Vite's esbuild child dependency to 0.28.1 and moving `job-search-demo` to
Vite 8 / `@vitejs/plugin-react` 6 so its build supports that fixed esbuild
version.

## Files Changed

- `package.json`
- `examples/job-search-demo/package.json`
- `package-lock.json`
- `CHANGELOG.md`
- `CLOSEOUT.md`

## Evidence

### Audit Gates

Before this slice, `npm audit --audit-level=high` exited 1 with 6 high
advisories rooted in esbuild.

After the override and demo Vite 8 bump:

```text
npm audit --audit-level=high
exit: 0

npm audit --omit=dev --audit-level=high
prod exit: 0

residual audit findings: 12 vulnerabilities (3 low, 9 moderate)
```

### Esbuild Version List

```text
esbuild@0.28.1
```

### Job Search Demo Build

`npm run build -w job-search-demo`

```text
vite v8.0.16 building client environment for production...
✓ 614 modules transformed.
✓ built in 182ms
```

Vite 8 emitted the expected large-chunk / `rolldownOptions` warning.

### Full CI

`npm ci && npm run ci`

Result: exit 0.

```text
runtime: 147 tests passed
adapters-react: 1 test passed
ai-sdk: 27 tests passed
ui: 13 tests passed
mcp: 14 tests passed
scripts: 18 tests passed
web: 72 tests passed
total: 292 tests passed

Next production build completed successfully.
```
