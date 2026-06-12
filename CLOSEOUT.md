# Closeout: Slice 4 - Runtime & MCP error-path hardening

Runtime and MCP error paths now fail loudly and predictably without changing
public runtime declarations:

- `WorkbenchRuntime.cancelRunCascade()` logs refused per-node cancellations with
  the `[llm-workbench]` prefix while preserving skip-and-continue cascade
  semantics.
- `materializeArtifact()` `INVALID_JSON` errors now include the artifact key,
  external store ref, and payload byte length.
- MCP `verify_run_integrity` / `validate_run_bundle` serialize bundles through a
  safe helper that rejects circular/unsupported values with a clean message and
  caps serialized input at 25 MiB.

---

## Evidence

### 1. New regression tests

- `packages/runtime/src/runtime/supervision.test.ts`
  - `logs and skips runs that refuse cancellation while continuing the cascade`
- `packages/runtime/src/persistence/artifactStore.test.ts`
  - `materializeArtifact reports artifact key and store ref for invalid external JSON`
- `packages/mcp/src/server.test.ts`
  - `verify_run_integrity reports circular bundles without leaking raw stringify errors`
  - `validate_run_bundle reports circular bundles as invalid data`
  - `rejects oversized bundles cleanly in verify and validate tools`

### 2. Runtime package test output

`npm test -w @llm-workbench/runtime -- --reporter verbose`

```
> @llm-workbench/runtime@0.2.0 test
> vitest run --reporter verbose

 RUN  v3.2.6 /Users/roymcfarland/Projects/llm-workbench/packages/runtime

 ✓ src/persistence/artifactStore.test.ts > WorkbenchSession.writeArtifactAsync routing > materializeArtifact reports artifact key and store ref for invalid external JSON 0ms
 ✓ src/runtime/supervision.test.ts > WorkbenchRuntime.runChildrenOf and cancelRunCascade > logs and skips runs that refuse cancellation while continuing the cascade 35ms

 Test Files  13 passed (13)
      Tests  105 passed (105)
```

### 3. MCP package test output

`npm test -w @llm-workbench/mcp -- --reporter verbose`

```
> @llm-workbench/mcp@0.2.0 test
> vitest run --reporter verbose

 RUN  v3.2.6 /Users/roymcfarland/Projects/llm-workbench/packages/mcp

 ✓ src/server.test.ts > createWorkbenchMcpServer > verify_run_integrity reports circular bundles without leaking raw stringify errors 2ms
 ✓ src/server.test.ts > createWorkbenchMcpServer > validate_run_bundle reports circular bundles as invalid data 2ms
 ✓ src/server.test.ts > createWorkbenchMcpServer > rejects oversized bundles cleanly in verify and validate tools 235ms

 Test Files  2 passed (2)
      Tests  14 passed (14)
```

### 4. Full CI

`npm run ci` passed. Test counts are 240 baseline + 5 new tests = 245 total:

```
@llm-workbench/runtime        105
@llm-workbench/adapters-react   1
@llm-workbench/ai-sdk          27
@llm-workbench/ui              13
@llm-workbench/mcp             14
test:scripts                   18
@llm-workbench/web             67
```

Last lines from the successful `npm run ci`:

```
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

### 5. Declaration-emit comparison

The original GNU-style `diff --include='*.d.ts'` command is not supported by
the macOS/BSD `diff` in this environment, so the declaration comparison used an
equivalent `.d.ts` file-list plus per-file byte diff. Runtime public declarations
are byte-identical.

```
git stash push --include-untracked -m dts-comparison-error-path-hardening
Saved working directory and index state On fix/error-path-hardening: dts-comparison-error-path-hardening

git checkout main
Switched to branch 'main'
Your branch is up to date with 'origin/main'.

npm run build -w @llm-workbench/runtime
> @llm-workbench/runtime@0.2.0 build
> tsc -p tsconfig.build.json

cp -R packages/runtime/dist /tmp/dts-parent-slice4

git checkout fix/error-path-hardening
Switched to branch 'fix/error-path-hardening'

git stash pop stash@{0}
On branch fix/error-path-hardening
Changes not staged for commit:
  modified:   CHANGELOG.md
  modified:   packages/mcp/src/server.test.ts
  modified:   packages/mcp/src/server.ts
  modified:   packages/runtime/src/persistence/artifactStore.test.ts
  modified:   packages/runtime/src/runtime/artifactController.ts
  modified:   packages/runtime/src/runtime/supervision.test.ts
  modified:   packages/runtime/src/runtime/workbench.ts
Dropped stash@{0} (a489fb8a5b553826aa53cfd0ecc9781b05c3fd49)

npm run build -w @llm-workbench/runtime
> @llm-workbench/runtime@0.2.0 build
> tsc -p tsconfig.build.json

find /tmp/dts-parent-slice4 -name '*.d.ts' -print | sed 's#^/tmp/dts-parent-slice4/##' | sort > /tmp/dts-parent-slice4.files
find packages/runtime/dist -name '*.d.ts' -print | sed 's#^packages/runtime/dist/##' | sort > /tmp/dts-current-slice4.files
diff -u /tmp/dts-parent-slice4.files /tmp/dts-current-slice4.files
while IFS= read -r file; do diff -u "/tmp/dts-parent-slice4/$file" "packages/runtime/dist/$file"; done < /tmp/dts-parent-slice4.files
OK: d.ts byte-identical
```
