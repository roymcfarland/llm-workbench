# Closeout: Slice 1 Decompose WorkbenchSession

## Summary

`packages/runtime/src/runtime/session.ts` was decomposed into a backwards-compatible `WorkbenchSession` facade plus six focused runtime controllers: run lifecycle, gates, steps, artifacts, trace, and rules. The original runtime mutation behavior was moved into those controllers without changing test assertions or downstream call sites, and the shared constructor dependency object is now represented by the internal `SessionContext` type in `packages/runtime/src/runtime/sessionContext.ts`. The package root still re-exports `WorkbenchSession` from `runtime/session.js`; the controllers and `SessionContext` are not re-exported from `packages/runtime/src/index.ts`.

## Acceptance Evidence

### 1. Unit tests pass

Command:

```sh
npm test
```

Output:

```text
> test
> npm test -w @llm-workbench/runtime && npm test -w @llm-workbench/adapters-react && npm test -w @llm-workbench/ai-sdk && npm test -w @llm-workbench/ui && npm test -w @llm-workbench/mcp && npm run test:scripts && npm test -w @llm-workbench/web


> @llm-workbench/runtime@0.2.0 test
> vitest run


 RUN  v3.2.4 /Users/roymcfarland/Projects/llm-workbench/packages/runtime

 ✓ src/persistence/http.test.ts (13 tests) 17ms
 ✓ src/protocol/correctness.test.ts (11 tests) 7ms
 ✓ src/schema/registry.test.ts (2 tests) 21ms
 ✓ src/persistence/artifactStore.test.ts (17 tests) 24ms
 ✓ src/telemetry/modelTelemetry.test.ts (2 tests) 55ms
 ✓ src/runtime/stability.test.ts (21 tests) 36ms
 ✓ src/runtime/workbench.test.ts (11 tests) 91ms
 ✓ src/persistence/indexeddb.test.ts (2 tests) 4ms
 ✓ src/runtime/correctness.test.ts (3 tests) 11ms
 ✓ src/runtime/spans.test.ts (4 tests) 9ms
 ✓ src/errors.test.ts (3 tests) 2ms
 ✓ src/runtime/supervision.test.ts (13 tests) 12ms
 ✓ src/persistence/memory.test.ts (1 test) 4ms

 Test Files  13 passed (13)
      Tests  103 passed (103)
   Start at  13:03:03
   Duration  1.01s (transform 467ms, setup 0ms, collect 1.51s, tests 294ms, environment 2ms, prepare 925ms)


> @llm-workbench/adapters-react@0.2.0 test
> vitest run


 RUN  v3.2.4 /Users/roymcfarland/Projects/llm-workbench/packages/adapters-react

 ✓ src/useWorkbenchRunRevision.test.tsx (1 test) 15ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  13:03:05
   Duration  920ms (transform 106ms, setup 0ms, collect 258ms, tests 15ms, environment 374ms, prepare 37ms)


> @llm-workbench/ai-sdk@0.2.0 test
> vitest run


 RUN  v3.2.4 /Users/roymcfarland/Projects/llm-workbench/packages/ai-sdk

 ✓ src/internal.test.ts (12 tests) 3ms
 ✓ src/tools.test.ts (3 tests) 7ms
 ✓ src/streamObject.test.ts (2 tests) 9ms
 ✓ src/streamText.test.ts (2 tests) 9ms
 ✓ src/generateText.test.ts (5 tests) 38ms
 ✓ src/generateObject.test.ts (3 tests) 45ms

 Test Files  6 passed (6)
      Tests  27 passed (27)
   Start at  13:03:06
   Duration  663ms (transform 325ms, setup 0ms, collect 1.36s, tests 110ms, environment 1ms, prepare 364ms)


> @llm-workbench/ui@0.2.0 test
> vitest run


 RUN  v3.2.4 /Users/roymcfarland/Projects/llm-workbench/packages/ui

 ✓ src/WorkbenchShell.reorder.test.tsx (8 tests) 4ms
 ✓ src/WorkflowGraph.test.tsx (5 tests) 52ms

 Test Files  2 passed (2)
      Tests  13 passed (13)
   Start at  13:03:08
   Duration  921ms (transform 196ms, setup 0ms, collect 634ms, tests 56ms, environment 368ms, prepare 90ms)


> @llm-workbench/mcp@0.2.0 test
> vitest run


 RUN  v3.2.4 /Users/roymcfarland/Projects/llm-workbench/packages/mcp

 ✓ src/server.test.ts (10 tests) 42ms
 ✓ src/http.test.ts (1 test) 22ms

 Test Files  2 passed (2)
      Tests  11 passed (11)
   Start at  13:03:09
   Duration  592ms (transform 135ms, setup 0ms, collect 454ms, tests 64ms, environment 0ms, prepare 104ms)


> test:scripts
> vitest run --config scripts/vitest.config.mjs


 RUN  v3.2.4 /Users/roymcfarland/Projects/llm-workbench

 ✓ scripts/bootstrap.test.mjs (18 tests) 4ms

 Test Files  1 passed (1)
      Tests  18 passed (18)
   Start at  13:03:10
   Duration  280ms (transform 29ms, setup 0ms, collect 36ms, tests 4ms, environment 0ms, prepare 37ms)


> @llm-workbench/web@0.1.0 test
> vitest run --passWithNoTests


 RUN  v4.1.5 /Users/roymcfarland/Projects/llm-workbench/apps/web

 Test Files  8 passed (8)
      Tests  62 passed (62)
   Start at  13:03:11
   Duration  1.24s (transform 1.06s, setup 0ms, import 2.61s, tests 243ms, environment 1ms)
```

### 2. All package builds pass

Command:

```sh
npm run build
```

Output:

```text
> build
> npm run build -w @llm-workbench/runtime -w @llm-workbench/adapters-react -w @llm-workbench/ui -w @llm-workbench/ai-sdk -w @llm-workbench/mcp


> @llm-workbench/runtime@0.2.0 build
> tsc -p tsconfig.build.json


> @llm-workbench/adapters-react@0.2.0 build
> tsc -p tsconfig.build.json


> @llm-workbench/ui@0.2.0 build
> tsc -p tsconfig.build.json && node scripts/copy-theme.mjs


> @llm-workbench/ai-sdk@0.2.0 build
> tsc -p tsconfig.build.json


> @llm-workbench/mcp@0.2.0 build
> tsc -p tsconfig.build.json
```

### 3. apps/web typechecks

Command:

```sh
npm run typecheck -w @llm-workbench/web
```

Output:

```text
> @llm-workbench/web@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit
```

### 4. apps/web lints

Command:

```sh
npm run lint -w @llm-workbench/web
```

Output:

```text
> @llm-workbench/web@0.1.0 lint
> eslint . --max-warnings 0
```

### 5. apps/web production build passes

The first sandboxed run failed because Turbopack could not bind a local port inside the sandbox. The same command was rerun with approved unsandboxed execution and passed.

Command:

```sh
npm run build:web
```

Successful output:

```text
> build:web
> npm run build -w apps/web


> @llm-workbench/web@0.1.0 build
> next build

▲ Next.js 16.2.4 (Turbopack)
- Experiments (use with caution):
  · clientTraceMetadata

⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
  Creating an optimized production build ...
✓ Compiled successfully in 8.4s
  Running next.config.js provided runAfterProductionCompile ...
✓ Completed runAfterProductionCompile in 871ms
  Running TypeScript ...
  Finished TypeScript in 4.7s ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/51) ...
  Generating static pages using 7 workers (12/51)
  Generating static pages using 7 workers (25/51)
  Generating static pages using 7 workers (38/51)
✓ Generating static pages using 7 workers (51/51) in 963ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /.well-known/mcp.json
├ ƒ /.well-known/security.txt
├ ƒ /agents.md
├ ƒ /api/health
├ ƒ /api/llm
├ ƒ /api/mcp
├ ƒ /api/openapi.json
├ ƒ /api/runs
├ ƒ /api/runs/[runId]
├ ƒ /blog
├ ƒ /blog/[slug]
├ ● /blog/[slug]/opengraph-image/[__metadata_id__]
├ ● /blog/[slug]/twitter-image/[__metadata_id__]
├ ○ /blog/opengraph-image
├ ƒ /blog/tags/[tag]
├ ● /blog/tags/[tag]/opengraph-image/[__metadata_id__]
├ ● /blog/tags/[tag]/twitter-image/[__metadata_id__]
├ ○ /blog/twitter-image
├ ƒ /docs/protocol
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

### 6. Runtime files are under 500 lines

Command:

```sh
find packages/runtime/src/runtime -type f -name '*.ts' -exec wc -l {} + | sort -rn | head -10
```

Output:

```text
    2683 total
     348 packages/runtime/src/runtime/workbench.ts
     318 packages/runtime/src/runtime/stability.test.ts
     307 packages/runtime/src/runtime/artifactController.ts
     236 packages/runtime/src/runtime/workbench.test.ts
     196 packages/runtime/src/runtime/session.ts
     147 packages/runtime/src/runtime/traceController.ts
     139 packages/runtime/src/runtime/hydrate.ts
     133 packages/runtime/src/runtime/supervision.test.ts
     118 packages/runtime/src/runtime/stepController.ts
```

### 7. Runtime public TypeScript surface is unchanged

The pre-refactor runtime declarations were generated before code changes and copied to `/private/tmp/session.before.d.ts` and `/private/tmp/runtime-index.before.d.ts`. The package root declaration file is byte-identical, and a public-member comparison of `WorkbenchSession` reports no public shape change after ignoring comments and private declarations.

Command:

```sh
node --input-type=module -e "import fs from 'node:fs'; function read(p){return fs.readFileSync(p,'utf8')} if (read('/private/tmp/runtime-index.before.d.ts') !== read('packages/runtime/dist/index.d.ts')) { console.log('runtime index declarations changed'); process.exit(1); } function shape(path){ const lines=read(path).split('\n'); const out=[]; let inClass=false, depth=0, inBlock=false; for (const line of lines){ if (!inClass){ if (line.startsWith('export declare class WorkbenchSession')){ inClass=true; depth=(line.match(/\{/g)?.length??0)-(line.match(/\}/g)?.length??0); out.push(line.trim()); } continue; } const t=line.trim(); const opens=(line.match(/\{/g)?.length??0); const closes=(line.match(/\}/g)?.length??0); if (t.startsWith('/**') && !t.endsWith('*/')) { inBlock=true; depth += opens - closes; continue; } if (t.startsWith('/**') && t.endsWith('*/')) { depth += opens - closes; continue; } if (inBlock) { if (t.endsWith('*/')) inBlock=false; depth += opens - closes; continue; } if (!t.startsWith('private ')) out.push(t); depth += opens - closes; if (depth === 0) break; } return out.filter(Boolean).join('\n').replace(/\s+/g,' ').trim(); } if (shape('/private/tmp/session.before.d.ts') !== shape('packages/runtime/dist/runtime/session.d.ts')) { console.log('public WorkbenchSession shape changed'); process.exit(1); } console.log('runtime index declarations unchanged'); console.log('public WorkbenchSession shape unchanged');"
```

Output:

```text
runtime index declarations unchanged
public WorkbenchSession shape unchanged
```

Controller export check:

```ts
export * from "./errors.js";
export * from "./protocol/index.js";
export * from "./export/userBundle.js";
export * from "./runtime/workbench.js";
export * from "./runtime/session.js";
export * from "./runtime/hydrate.js";
export * from "./runtime/readiness.js";
export * from "./runtime/graph.js";
export * from "./runtime/types.js";
export {
  assertRunStoreStateStructuralInvariants,
  cloneRunStoreState,
} from "./runtime/state.js";
export * from "./schema/index.js";
export * from "./persistence/index.js";
export * from "./host/index.js";
export * from "./telemetry/index.js";
```

### 8. Behavior is preserved

No test files were changed, and the full `npm test` suite above passed with existing assertions. The moved method bodies preserve trace/event ordering by keeping the same append points and by routing cross-controller calls through the same lifecycle/gate methods that the original class used.

Command:

```sh
git diff --name-only -- '*test*'
```

Output:

```text
```

### 9. PROJECT.md rules are honored

Package privacy/license scan:

```sh
node --input-type=module -e "import fs from 'node:fs'; const files=['package.json',...fs.readdirSync('packages').map(n=>'packages/'+n+'/package.json'),...fs.readdirSync('apps').map(n=>'apps/'+n+'/package.json'),...fs.readdirSync('examples').map(n=>'examples/'+n+'/package.json')].filter(p=>fs.existsSync(p)); for (const file of files){ const p=JSON.parse(fs.readFileSync(file,'utf8')); console.log(file + ': private=' + p.private + ', license=' + p.license); }"
```

Output:

```text
package.json: private=true, license=SEE LICENSE IN LICENSE
packages/adapters-react/package.json: private=true, license=SEE LICENSE IN LICENSE
packages/ai-sdk/package.json: private=true, license=SEE LICENSE IN LICENSE
packages/mcp/package.json: private=true, license=SEE LICENSE IN LICENSE
packages/runtime/package.json: private=true, license=SEE LICENSE IN LICENSE
packages/ui/package.json: private=true, license=SEE LICENSE IN LICENSE
apps/web/package.json: private=true, license=SEE LICENSE IN LICENSE
examples/job-search-demo/package.json: private=true, license=SEE LICENSE IN LICENSE
examples/run-repo-server/package.json: private=true, license=SEE LICENSE IN LICENSE
```

Middleware/release check:

```sh
node --input-type=module -e "import fs from 'node:fs'; const checks = [ ['proxy.ts files', fs.existsSync('apps/web/proxy.ts') ? 'present' : 'absent'], ['release.yml', fs.existsSync('.github/workflows/release.yml') ? 'present' : 'absent'], ['root private', JSON.parse(fs.readFileSync('package.json','utf8')).private === true ? 'true' : 'not true'], ['root license', JSON.parse(fs.readFileSync('package.json','utf8')).license] ]; for (const [k,v] of checks) console.log(k + ': ' + v);"
```

Output:

```text
proxy.ts files: absent
release.yml: absent
root private: true
root license: SEE LICENSE IN LICENSE
```

`rg -n "npm publish" .github package.json packages apps examples scripts` produced no output.

## Diff Statistics

Complete working tree diff including this `CLOSEOUT.md` file:

```text
9 files changed, 1399 insertions(+), 708 deletions(-)
```

Implementation code diff before this `CLOSEOUT.md` file:

```text
8 files changed, 930 insertions(+), 708 deletions(-)
```

Breakdown:

```text
69	708	packages/runtime/src/runtime/session.ts
307	0	packages/runtime/src/runtime/artifactController.ts
83	0	packages/runtime/src/runtime/gateController.ts
75	0	packages/runtime/src/runtime/ruleController.ts
113	0	packages/runtime/src/runtime/runLifecycleController.ts
18	0	packages/runtime/src/runtime/sessionContext.ts
118	0	packages/runtime/src/runtime/stepController.ts
147	0	packages/runtime/src/runtime/traceController.ts
```

Per-file runtime line counts after the refactor:

```text
     236 packages/runtime/src/runtime/workbench.test.ts
     112 packages/runtime/src/runtime/state.ts
      75 packages/runtime/src/runtime/ruleController.ts
       7 packages/runtime/src/runtime/ids.ts
      57 packages/runtime/src/runtime/readiness.ts
     133 packages/runtime/src/runtime/supervision.test.ts
     318 packages/runtime/src/runtime/stability.test.ts
     118 packages/runtime/src/runtime/stepController.ts
     348 packages/runtime/src/runtime/workbench.ts
     110 packages/runtime/src/runtime/spans.test.ts
      42 packages/runtime/src/runtime/types.ts
     147 packages/runtime/src/runtime/traceController.ts
      41 packages/runtime/src/runtime/gates.ts
      58 packages/runtime/src/runtime/correctness.test.ts
     139 packages/runtime/src/runtime/hydrate.ts
     196 packages/runtime/src/runtime/session.ts
     307 packages/runtime/src/runtime/artifactController.ts
      18 packages/runtime/src/runtime/sessionContext.ts
      83 packages/runtime/src/runtime/gateController.ts
      25 packages/runtime/src/runtime/graph.ts
     113 packages/runtime/src/runtime/runLifecycleController.ts
    2683 total
```

## Findings Deferred To Follow-Up Slice

- Next.js 16.2.4 emits a build warning that the `middleware` file convention is deprecated in favor of `proxy`. `PROJECT.md` Q2 explicitly says `apps/web/middleware.ts` is canonical and forbids reintroducing `proxy.ts`, so no middleware naming change was made in this refactor slice.

## PROJECT.md Compliance Checklist

- [x] License fields unchanged; every package remains `private=true` and `license=SEE LICENSE IN LICENSE`.
- [x] Middleware naming unchanged; `apps/web/middleware.ts` remains canonical and no `proxy.ts` was introduced.
- [x] No `release.yml` workflow was reintroduced.
- [x] No repository visibility change was attempted.
- [x] No permissive license file or permissive license text was added.
- [x] No `npm publish` invocation was added.
