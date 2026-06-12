# Closeout: Slice 8 - Package lint and audit CI gate

This slice adds package-wide lint coverage and a high/critical dependency
advisory gate without changing runtime behavior. ESLint now covers
`packages/*/src/**/*.{ts,tsx}` through a root flat config, the root `ci` script
runs that package lint step after web lint, and GitHub Actions runs both package
lint and `npm audit --audit-level=high` on each matrix node.

## Architectural Choices

- Root ESLint uses `typescript-eslint` recommended flat config, enforces
  `no-console`, and allows `_`-prefixed unused values for intentional drops.
- The ai-sdk empty interface became a type alias. This changes the package's
  emitted `.d.ts` shape from an empty extending interface to the equivalent
  `Pick<WorkbenchSession, ...>` alias; the runtime declaration-emit convention
  does not cover ai-sdk.
- Runtime source edits are type-only. The `WorkbenchError` V8
  `captureStackTrace` casts now use `unknown`, and the dead `RunContextRef`
  type import is gone. Small source-map padding is kept around those erased
  type positions so `packages/runtime/dist` stays byte-identical to `main`.

## Evidence

### Resolved dependency versions

`npm ls typescript-eslint --depth=0`

```text
llm-workbench@ /Users/roymcfarland/Projects/llm-workbench
└── typescript-eslint@8.61.0
```

### Packages lint

`npm run lint:packages`

```text
> lint:packages
> eslint "packages/*/src/**/*.{ts,tsx}"
```

Result: exit 0, zero errors, zero warnings.

### Audit gate

`npm audit --audit-level=high`

```text
11 vulnerabilities (3 low, 8 moderate)
```

Result: exit 0. No high or critical advisories block the new gate.

### Runtime declaration/dist comparison

```text
Saved working directory and index state WIP on chore/packages-lint-and-audit-gate: b3902ce chore(ci): timeout and cache the Playwright browser install (#15)
Switched to branch 'main'
Your branch is up to date with 'origin/main'.

> @llm-workbench/runtime@0.2.0 build
> tsc -p tsconfig.build.json

Switched to branch 'chore/packages-lint-and-audit-gate'
On branch chore/packages-lint-and-audit-gate
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   .github/workflows/ci.yml
	modified:   CHANGELOG.md
	modified:   package-lock.json
	modified:   package.json
	modified:   packages/ai-sdk/src/types.ts
	modified:   packages/runtime/src/errors.ts
	modified:   packages/runtime/src/runtime/workbench.ts

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	eslint.config.mjs

no changes added to commit (use "git add" and/or "git commit -a")
Dropped refs/stash@{0} (7ad77b3afe2862ef6eca2d60362c4b0585ec74b6)

> @llm-workbench/runtime@0.2.0 build
> tsc -p tsconfig.build.json

OK: runtime d.ts byte-identical
```

### Full CI

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
