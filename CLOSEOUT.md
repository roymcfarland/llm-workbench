# Closeout: Slice 8.1 hotfix - production-scope audit gate

This hotfix re-scopes the CI dependency audit gate to production dependencies:
`npm audit --omit=dev --audit-level=high`. The gate now matches the deployable
surface while dev-toolchain esbuild/vite/vitest majors remain a tracked
dependency-upgrade follow-up.

## Scope

- `.github/workflows/ci.yml`: renamed the audit step and added the
  production-scope audit command.
- `package-lock.json`: updated only by non-force `npm audit fix` commands.
- `CHANGELOG.md`: recorded the security ledger entry.
- `CLOSEOUT.md`: replaced with this verification record.

No `package.json` files changed.

## Audit Evidence

Advisory totals are registry-sensitive context; the pass/fail criterion is the
command exit code.

### Before the hotfix

`npm audit --audit-level=high`

```text
18 vulnerabilities (3 low, 9 moderate, 6 high)
exit: 1
```

The failing high findings are in the dev-toolchain esbuild/vite path whose
available remediation is a breaking Vite major.

`npm audit --omit=dev --audit-level=high`

```text
12 vulnerabilities (3 low, 9 moderate)
exit: 0
```

Production high/critical exposure was already clean.

### After non-force audit fix and gate re-scope

`npm audit --omit=dev --audit-level=high`

```text
12 vulnerabilities (3 low, 9 moderate)
exit: 0
```

`npm audit --audit-level=high`

```text
18 vulnerabilities (3 low, 9 moderate, 6 high)
exit: 1
```

`npm audit 2>&1 | grep -c dompurify`

```text
3
```

The builder prompt expected `0`, but current registry metadata still reports
the moderate Monaco path. `npm view monaco-editor version dependencies --json`
shows latest `monaco-editor@0.55.1` depends exactly on `dompurify@3.2.7`, while
the advisory flags `dompurify <=3.3.3`. Clearing that path would require a
manifest-level override, prerelease dependency selection, or a force-style
upgrade, all outside this slice's hard rules.

## Audit Fix Behavior

Commands run without `--force`:

```text
npm audit fix
npm audit fix --omit=dev
npm audit fix --package-lock-only
npm audit fix --workspaces --include-workspace-root
npm audit fix --workspace @llm-workbench/web
```

The initial `npm audit fix` updated only `package-lock.json`; subsequent
non-force passes made no manifest changes and did not clear the remaining
moderate `dompurify` / `uuid` registry findings.

## Full CI

`npm ci`

```text
added 1231 packages, and audited 1240 packages in 22s
18 vulnerabilities (3 low, 9 moderate, 6 high)
```

Result: exit 0. Local npm emitted an engine warning because the shell is using
Node 22.12.0 and `eslint-visitor-keys@5.0.1` declares `^20.19.0 || ^22.13.0 ||
>=24`; this was a warning, not a failure.

`npm run ci`

Result: exit 0. Workspace test count stayed exactly 245:

```text
runtime: 105
adapters-react: 1
ai-sdk: 27
ui: 13
mcp: 14
scripts: 18
web: 67
total: 245
```

Last CI lines:

```text
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
