# Closeout: Slice 2 — Resolve WorkbenchSession constructor type duplication

The `WorkbenchSession` constructor previously declared its single parameter as an inline anonymous object that copy-pasted the eight-field shape of the `SessionContext` type defined one file over. That duplication left a silent-drift hole: TypeScript would loudly catch any **required**-field skew between the two declarations, but **optional**-field skew would pass through silently and propagate `undefined` to all six controllers. This slice retypes the constructor parameter as `SessionContext` directly, drops the now-redundant in-body reassignment, and tags the constructor `@internal` to signal that production callers reach `WorkbenchSession` only through `WorkbenchHost`. The type is not added to the public package surface — `packages/runtime/src/index.ts` is byte-identical to `main`.

---

## Evidence

### 1. `npm test -w @llm-workbench/runtime` — 13 files / 103 tests pass

```
npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

> @llm-workbench/runtime@0.2.0 test
> vitest run


 RUN  v3.2.4 /Users/roymcfarland/Projects/llm-workbench/packages/runtime

 ✓ src/persistence/http.test.ts (13 tests) 20ms
 ✓ src/schema/registry.test.ts (2 tests) 17ms
 ✓ src/runtime/correctness.test.ts (3 tests) 12ms
 ✓ src/persistence/artifactStore.test.ts (17 tests) 20ms
 ✓ src/runtime/workbench.test.ts (11 tests) 42ms
 ✓ src/telemetry/modelTelemetry.test.ts (2 tests) 26ms
 ✓ src/runtime/stability.test.ts (21 tests) 30ms
 ✓ src/protocol/correctness.test.ts (11 tests) 11ms
 ✓ src/persistence/indexeddb.test.ts (2 tests) 3ms
 ✓ src/errors.test.ts (3 tests) 2ms
 ✓ src/runtime/supervision.test.ts (13 tests) 8ms
 ✓ src/persistence/memory.test.ts (1 test) 6ms
 ✓ src/runtime/spans.test.ts (4 tests) 8ms

 Test Files  13 passed (13)
      Tests  103 passed (103)
   Start at  14:45:01
   Duration  931ms (transform 497ms, setup 0ms, collect 1.47s, tests 206ms, environment 1ms, prepare 1.02s)

npm notice
npm notice New minor version of npm available! 11.12.1 -> 11.14.1
npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.14.1
npm notice To update run: npm install -g npm@11.14.1
npm notice
```

Test count is exactly 103, matching the count required by §5.

### 2. `npm run build` — five-package build clean

```
npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

> build
> npm run build -w @llm-workbench/runtime -w @llm-workbench/adapters-react -w @llm-workbench/ui -w @llm-workbench/ai-sdk -w @llm-workbench/mcp

npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

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

All five workspace packages — `@llm-workbench/runtime`, `@llm-workbench/adapters-react`, `@llm-workbench/ui`, `@llm-workbench/ai-sdk`, `@llm-workbench/mcp` — emit with no diagnostics.

### 3. `npm run typecheck -w @llm-workbench/web` — clean

```
npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

> @llm-workbench/web@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit
```

`apps/web` is the only direct consumer of the `WorkbenchSession` constructor (transitively, via `WorkbenchHost.session` at `packages/runtime/src/runtime/workbench.ts:222`). The clean typecheck proves the new constructor signature is structurally compatible with the existing inline-typed object literal that `WorkbenchHost.session` passes — no source change to `workbench.ts` was needed.

### 4. `npm run lint -w @llm-workbench/web` — clean (`--max-warnings 0`)

```
npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.

> @llm-workbench/web@0.1.0 lint
> eslint . --max-warnings 0
```

### 5. `git diff main...HEAD -- packages/runtime/src/index.ts` — empty

```
(no output)
```

The public package surface is unchanged. `SessionContext` is **not** re-exported from `@llm-workbench/runtime`.

### 6. `git diff main...HEAD --name-only` — exactly two paths

```
CLOSEOUT.md
packages/runtime/src/runtime/session.ts
```

The diff scope envelope from §3 is honored: only the two files explicitly permitted by the slice prompt are touched.

> Note: at the time the code-only commit `ff5e7d0` was created, this command produced just `packages/runtime/src/runtime/session.ts`. The output above is reproducible at HEAD on this branch (which contains both the code commit and this CLOSEOUT.md commit).

### 7. `dist/runtime/session.d.ts` constructor signature — reviewed

Pre-slice (parent SHA `3e686c5`):

```
export declare class WorkbenchSession {
    private readonly ctx;
    private readonly lifecycle;
    private readonly gates;
    private readonly steps;
    private readonly artifacts;
    private readonly trace;
    private readonly rules;
    constructor(ctx: {
        protocolVersion: string;
        state: RunStoreState;
        appendTrace: (e: TraceEvent) => void;
        newEventId: () => string;
        nowIso: () => string;
        canStartStep: (stepId: string) => CanStart;
        /** Optional external byte store for large artifact payloads. */
        artifactStore?: ArtifactStore;
        /** Threshold above which `writeArtifactAsync` externalizes payloads. */
        artifactExternalizationThresholdBytes?: number;
    });
```

Post-slice (HEAD on `slice-2/session-context-constructor`):

```
export declare class WorkbenchSession {
    private readonly ctx;
    private readonly lifecycle;
    private readonly gates;
    private readonly steps;
    private readonly artifacts;
    private readonly trace;
    private readonly rules;
    /**
     * @internal Constructed only by `WorkbenchHost.session()`. The `SessionContext`
     * parameter type is internal to the runtime package and is not re-exported
     * from `packages/runtime/src/index.ts`; external callers must reach a
     * `WorkbenchSession` through `WorkbenchHost`, never via `new WorkbenchSession`.
     */
    constructor(ctx: SessionContext);
```

The signature **does** materially differ from the pre-slice form: the eight-field inline shape is replaced by the named `SessionContext` reference, and a corresponding `import type { SessionContext } from "./sessionContext.js";` is now emitted at the top of `dist/runtime/session.d.ts`. This change is **intentional and expected** under Option A — it is the entire point of the slice. The named type does **not** leak through to the public package surface for two reasons:

1. `packages/runtime/src/index.ts` does not re-export `./runtime/sessionContext.js`, so `import { SessionContext } from "@llm-workbench/runtime"` will not resolve.
2. The `exports` field in `packages/runtime/package.json` exposes only `.`, `./protocol`, `./persistence`, and `./telemetry` — there is no public sub-path under which `dist/runtime/sessionContext.d.ts` is reachable. External consumers cannot import the type by name even with sub-path spelunking.

External consumers can still pass an inline-typed object to the constructor by structural assignability (TypeScript will accept any object whose shape extends `SessionContext`), but the `@internal` JSDoc tag tells documentation tooling and `--declaration` consumers that the constructor is not part of the supported public surface. This satisfies the §3 constraint "no public-surface change" while resolving the duplication.

---

## Diff statistics

`git diff main...HEAD --stat`:

```
 CLOSEOUT.md                             | 480 ++++++++------------------------
 packages/runtime/src/runtime/session.ts |  39 +--
 2 files changed, 132 insertions(+), 387 deletions(-)
```

The CLOSEOUT.md insertion/deletion counts are large because this file replaces the Slice 1 `CLOSEOUT.md` that landed on `main` via the squash merge of PR #8 (per §6 of the Slice 2 Builder prompt: "It replaces the Slice 1 CLOSEOUT.md (which is preserved in main history via the squash merge of PR #8)"). The session.ts diff is the focused 14/25 line change that is the actual code of this slice.

---

## Architectural choices made during this slice

I chose **Option A** (rename the inline anonymous shape to the named `SessionContext` type and tag the constructor `@internal`).

**Why Option A and not Option B.** Option A is fewer lines of code, removes the duplication entirely rather than guarding against it with a custom utility type, and has zero behavioral difference for any existing consumer. The static analysis premise in §2 of the Builder prompt — that `WorkbenchHost.session()` is the only direct caller of the constructor — held during implementation. I did not encounter a blocker that would force Option B.

**Decisions made beyond the literal text of the prompt.** Three:

1. **`@internal` JSDoc placement.** I placed the `@internal` JSDoc tag immediately above the constructor as the prompt directed (`session.ts:42-47`), and inside that JSDoc block I also documented the architectural fact that production callers reach `WorkbenchSession` only through `WorkbenchHost`. The body of the JSDoc is more verbose than a bare `/** @internal */` would be; the additional sentences are the contract that `WorkbenchHost.session` is the supported construction path. This is consistent with the precedent set by PR #9's JSDoc on `RunLifecycleController.assertRunActive`, which also documents the inter-controller call contract in plain English alongside the `@internal` tag.

2. **Removed three declarations that became unused as a direct consequence of the constructor change.** With the inline anonymous shape gone, three identifiers in `session.ts` had no remaining references in this file: the `import type { TraceEvent } from "../protocol/trace.js"` (only used by the inline shape's `appendTrace` parameter), the `import type { ArtifactStore } from "../persistence/artifactStore.js"` (only used by the inline shape's `artifactStore?` field), and the `type CanStart = ReturnType<typeof import("./readiness.js").canStartStep>` alias (only used by the inline shape's `canStartStep` return type). Leaving these declarations in place would have been dead code that survives no purpose other than as fossils of the just-removed duplication, and would mislead a future reader into thinking the file still uses those types. I read §3 of the prompt's "imports as your edits naturally require" carve-out to permit removing imports made dead by the edit. If the Verifier disagrees, the three lines can be restored without affecting behavior or the constructor signature, since the runtime tsconfig does not set `noUnusedLocals`.

3. **Preserved the `private readonly ctx: SessionContext` parameter modifier.** The `private readonly` modifier is structurally required because the `runId` getter on the facade and the `snapshot()` method both reach `this.ctx.state` (`session.ts:58, 62`). Changing the modifier would have broken those methods. I confirmed by reading the facade in full before editing.

**Pre-condition deviation noted.** §4 of the prompt directed me to confirm that `git show 3e686c5:packages/runtime/src/runtime/sessionContext.ts | wc -l` reports 19 lines. The actual count is 18 lines (`wc -l` counts trailing newlines and the file has 18 lines of content with one trailing newline). The 19-vs-18 discrepancy does not affect the slice — the structural shape of `SessionContext` is intact at lines 5–18 inclusive of the file as the prompt described. I am noting this here per §4's "any deviation must be flagged" rule rather than treating it as a blocker.

---

## PROJECT.md compliance checklist

I read `PROJECT.md` §Conventions in full at HEAD on `main` (SHA `3e686c5`). The relevant items:

- **Auth enforcement** (API routes return JSON 401, never HTML redirects). N/A — this slice does not touch any API route or auth middleware. No change implicates this rule.
- **Middleware** (Clerk auth, CSP, optional Upstash rate-limiting). N/A — this slice does not touch `apps/web` middleware.
- **MCP discovery** (public discovery routes, authenticated mutating tools). N/A — this slice does not touch any MCP route.
- **Errors** (sanitized in production; `WorkbenchError` for stable cross-boundary codes). The slice does not introduce or modify any error path. `WorkbenchError` is not used in `session.ts` — it lives in the controllers, which I did not modify.
- **Cross-controller method elevation** (JSDoc must enumerate sibling controllers, state non-public-surface status, and tag `@internal`). This rule applies when a refactor elevates a previously-private method to support sibling-controller calls. **This slice elevates no method.** The `@internal` tag I added is on the constructor, not on a controller method, and is for a different reason (it documents the constructor as an internal construction site, not a cross-controller call contract). The rule is therefore not triggered. I did read PR #9's JSDoc on `RunLifecycleController.assertRunActive` (which **is** the rule's first application) to make sure my JSDoc style is consistent with the precedent.

No part of this slice's change conflicts with any convention encoded in `PROJECT.md` §Conventions.

---

## Findings deferred to follow-up slice

No findings deferred.

The slice's stated goal — resolve the inline-`ctx` / `SessionContext` duplication identified as Verifier comment #1 in `VERIFIER-AUDIT-PR8.md` — is fully accomplished by this PR. The `@internal` tag on the constructor and the structural-typing escape hatch together preserve the ability to construct `WorkbenchSession` from outside the package (as today's `WorkbenchHost` does) without requiring an explicit named import of `SessionContext`, which keeps the runtime package's public type surface stable. Verifier comment #2 from the same audit (the `assertRunActive` inter-controller documentation) was closed by PR #9 and is out of scope for this slice.
