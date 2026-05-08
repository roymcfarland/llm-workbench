# VERIFIER-AUDIT-PR10.md

Target PR: https://github.com/roymcfarland/llm-workbench/pull/10  
Audited branch before this verifier commit: `slice-2/session-context-constructor` at `6216067`  
Parent/base commit: `3e686c5`

I read `CLOSEOUT.md` first, then independently re-ran the required checks and inspected the actual diff. The submission is small enough that the main audit risk is rubber-stamping a plausible closeout, so the architectural sections below focus on the two places where a type-only refactor can still create a real problem: declaration-file exposure and scope-envelope creep.

## Layer 1 - Mechanical Verification

Branch/base facts:

```text
$ git rev-parse --short HEAD
6216067
```

```text
$ git rev-parse --short main
3e686c5
```

```text
$ git merge-base main HEAD
3e686c5564052b9044235956e58d0351f9ac50ac
```

The seven Builder-prompt acceptance criteria reproduce. My local outputs do not byte-match `CLOSEOUT.md` in transient details such as test timing and the npm warning line, but the verifiable acceptance facts match: runtime tests are exactly 13 files / 103 tests, all five package builds succeed, web typecheck and lint succeed, the public index diff is empty, the pre-audit PR diff contains exactly the two expected files, and the declaration signature changed exactly as `CLOSEOUT.md` reports.

### Criterion 1 - Runtime tests

```text
$ npm test -w @llm-workbench/runtime

> @llm-workbench/runtime@0.2.0 test
> vitest run


 RUN  v3.2.4 /Users/roymcfarland/Projects/llm-workbench/packages/runtime

 ✓ src/persistence/http.test.ts (13 tests) 18ms
 ✓ src/protocol/correctness.test.ts (11 tests) 10ms
 ✓ src/schema/registry.test.ts (2 tests) 18ms
 ✓ src/runtime/stability.test.ts (21 tests) 24ms
 ✓ src/persistence/artifactStore.test.ts (17 tests) 39ms
 ✓ src/runtime/workbench.test.ts (11 tests) 46ms
 ✓ src/telemetry/modelTelemetry.test.ts (2 tests) 32ms
 ✓ src/runtime/correctness.test.ts (3 tests) 11ms
 ✓ src/runtime/spans.test.ts (4 tests) 8ms
 ✓ src/runtime/supervision.test.ts (13 tests) 7ms
 ✓ src/errors.test.ts (3 tests) 2ms
 ✓ src/persistence/indexeddb.test.ts (2 tests) 6ms
 ✓ src/persistence/memory.test.ts (1 test) 3ms

 Test Files  13 passed (13)
      Tests  103 passed (103)
   Start at  15:04:37
   Duration  922ms (transform 473ms, setup 0ms, collect 1.48s, tests 225ms, environment 4ms, prepare 945ms)
```

### Criterion 2 - Five-package build

```text
$ npm run build

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

### Criterion 3 - Web typecheck

```text
$ npm run typecheck -w @llm-workbench/web

> @llm-workbench/web@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit
```

### Criterion 4 - Web lint

```text
$ npm run lint -w @llm-workbench/web

> @llm-workbench/web@0.1.0 lint
> eslint . --max-warnings 0
```

### Criterion 5 - Public package surface unchanged

```text
$ git diff main...HEAD -- packages/runtime/src/index.ts
(no output)
```

### Criterion 6 - Diff scope before this audit file

This was captured before creating `VERIFIER-AUDIT-PR10.md`; after this verifier commit, the audit file itself is expected to appear in the branch diff.

```text
$ git diff main...HEAD --name-only
CLOSEOUT.md
packages/runtime/src/runtime/session.ts
```

The stat likewise matched `CLOSEOUT.md` before this audit file:

```text
$ git diff main...HEAD --stat
 CLOSEOUT.md                             | 480 ++++++++------------------------
 packages/runtime/src/runtime/session.ts |  39 +--
 2 files changed, 132 insertions(+), 387 deletions(-)
```

### Criterion 7 - Declaration signature comparison

I checked out `main`, rebuilt only the runtime package, and captured the pre-slice declaration signature:

```text
$ git switch main
Switched to branch 'main'
Your branch is up to date with 'origin/main'.
```

```text
$ npm run build -w @llm-workbench/runtime

> @llm-workbench/runtime@0.2.0 build
> tsc -p tsconfig.build.json
```

```text
$ sed -n '/^export declare class WorkbenchSession/,/^    });/p' packages/runtime/dist/runtime/session.d.ts
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

Then I checked out the PR branch, rebuilt runtime, and captured the post-slice declaration signature:

```text
$ git switch slice-2/session-context-constructor
Switched to branch 'slice-2/session-context-constructor'
Your branch is up to date with 'origin/slice-2/session-context-constructor'.
```

```text
$ npm run build -w @llm-workbench/runtime

> @llm-workbench/runtime@0.2.0 build
> tsc -p tsconfig.build.json
```

```text
$ sed -n '/^export declare class WorkbenchSession/,/^    constructor/p' packages/runtime/dist/runtime/session.d.ts
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

The post-slice declaration imports `SessionContext` from an internal relative declaration file:

```text
$ sed -n '1,20p' packages/runtime/dist/runtime/session.d.ts
import type { Operation } from "fast-json-patch";
import type { ArtifactVersion } from "../protocol/artifacts.js";
import type { RuleSet } from "../protocol/rules.js";
import type { RunBundle } from "../protocol/run.js";
import type { ModelCost, ModelUsage } from "../protocol/trace.js";
import type { SchemaRegistry } from "../schema/registry.js";
import type { RunStoreState } from "./types.js";
import type { SessionContext } from "./sessionContext.js";
export type SpanHandle = {
    readonly spanId: string;
    end(opts?: {
        status?: "ok" | "error";
        attributes?: Record<string, unknown>;
        error?: {
            message: string;
            code?: string;
        };
    }): void;
};
export type ExportRunBundleOptions = {
```

Layer 1 passes.

## Layer 2 - Architectural Verification

The actual code diff against the parent commit is exactly the constructor refactor plus the now-dead type declaration cleanup:

```diff
$ git diff main...HEAD -- packages/runtime/src/runtime/session.ts
diff --git a/packages/runtime/src/runtime/session.ts b/packages/runtime/src/runtime/session.ts
index 5995ae0..60ccb0c 100644
--- a/packages/runtime/src/runtime/session.ts
+++ b/packages/runtime/src/runtime/session.ts
@@ -2,9 +2,8 @@ import type { Operation } from "fast-json-patch";
 import type { ArtifactVersion } from "../protocol/artifacts.js";
 import type { RuleSet } from "../protocol/rules.js";
 import type { RunBundle } from "../protocol/run.js";
-import type { ModelCost, ModelUsage, TraceEvent } from "../protocol/trace.js";
+import type { ModelCost, ModelUsage } from "../protocol/trace.js";
 import type { SchemaRegistry } from "../schema/registry.js";
-import type { ArtifactStore } from "../persistence/artifactStore.js";
 import { cloneRunStoreState } from "./state.js";
 import type { RunStoreState } from "./types.js";
 import { ArtifactController } from "./artifactController.js";
@@ -30,8 +29,6 @@ export type ExportRunBundleOptions = {
   includeEngine?: boolean;
 };
 
-type CanStart = ReturnType<typeof import("./readiness.js").canStartStep>;
-
 export type RunTerminalStatus = "completed" | "failed" | "cancelled";
 
 export class WorkbenchSession {
@@ -42,27 +39,19 @@ export class WorkbenchSession {
   private readonly trace: TraceController;
   private readonly rules: RuleController;
 
-  constructor(
-    private readonly ctx: {
-      protocolVersion: string;
-      state: RunStoreState;
-      appendTrace: (e: TraceEvent) => void;
-      newEventId: () => string;
-      nowIso: () => string;
-      canStartStep: (stepId: string) => CanStart;
-      /** Optional external byte store for large artifact payloads. */
-      artifactStore?: ArtifactStore;
-      /** Threshold above which `writeArtifactAsync` externalizes payloads. */
-      artifactExternalizationThresholdBytes?: number;
-    },
-  ) {
-    const sessionContext: SessionContext = ctx;
-    this.lifecycle = new RunLifecycleController(sessionContext);
-    this.gates = new GateController(sessionContext, this.lifecycle);
-    this.steps = new StepController(sessionContext, this.lifecycle, this.gates);
-    this.artifacts = new ArtifactController(sessionContext, this.lifecycle);
-    this.trace = new TraceController(sessionContext, this.lifecycle);
-    this.rules = new RuleController(sessionContext, this.lifecycle);
+  /**
+   * @internal Constructed only by `WorkbenchHost.session()`. The `SessionContext`
+   * parameter type is internal to the runtime package and is not re-exported
+   * from `packages/runtime/src/index.ts`; external callers must reach a
+   * `WorkbenchSession` through `WorkbenchHost`, never via `new WorkbenchSession`.
+   */
+  constructor(private readonly ctx: SessionContext) {
+    this.lifecycle = new RunLifecycleController(ctx);
+    this.gates = new GateController(ctx, this.lifecycle);
+    this.steps = new StepController(ctx, this.lifecycle, this.gates);
+    this.artifacts = new ArtifactController(ctx, this.lifecycle);
+    this.trace = new TraceController(ctx, this.lifecycle);
+    this.rules = new RuleController(ctx, this.lifecycle);
   }
 
   get runId() {
```

The `private readonly` parameter modifier is preserved. That matters because `runId` and `snapshot()` still read `this.ctx.state`:

```text
$ nl -ba packages/runtime/src/runtime/session.ts
    48	  constructor(private readonly ctx: SessionContext) {
    49	    this.lifecycle = new RunLifecycleController(ctx);
    50	    this.gates = new GateController(ctx, this.lifecycle);
    51	    this.steps = new StepController(ctx, this.lifecycle, this.gates);
    52	    this.artifacts = new ArtifactController(ctx, this.lifecycle);
    53	    this.trace = new TraceController(ctx, this.lifecycle);
    54	    this.rules = new RuleController(ctx, this.lifecycle);
    55	  }
    56	
    57	  get runId() {
    58	    return this.ctx.state.run.id;
    59	  }
    60	
    61	  snapshot(): RunStoreState {
    62	    return cloneRunStoreState(this.ctx.state);
    63	  }
```

### Concern A - Dead imports and alias cleanup

Decision: acceptable, but the methodology should encode the boundary explicitly.

The prompt text strictly authorized adding/removing `SessionContext` imports, while also allowing import reordering "as edits naturally require." The removed `TraceEvent` import, `ArtifactStore` import, and `CanStart` type alias were not arbitrary cleanup; their only purpose was to support the inline constructor type that this slice removed. Leaving them would have preserved dead code solely to satisfy an overly narrow wording of the prompt.

This is not a reason to reject. It is, however, a prompt/process learning: future scope envelopes should explicitly allow removal of imports and local helper type aliases rendered dead by the slice's exact edit, while still forbidding unrelated cleanup elsewhere.

### Concern B - External construction backstop

Decision: the Builder's backstop assumption is valid for direct construction. A consumer cannot import `SessionContext` by name from the package root, but TypeScript can still resolve the internal relative declaration import in `dist/runtime/session.d.ts`, and direct construction with an inline object compiles.

External consumer setup:

```text
$ readlink /private/tmp/llm-workbench-pr10-consumer/node_modules/@llm-workbench/runtime
/Users/roymcfarland/Projects/llm-workbench/packages/runtime
```

```text
$ sed -n '1,80p' /private/tmp/llm-workbench-pr10-consumer/tsconfig.json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "strict": true,
    "declaration": true,
    "emitDeclarationOnly": true,
    "outDir": "dist",
    "skipLibCheck": false
  },
  "include": ["consumer.ts"]
}
```

```text
$ sed -n '1,80p' /private/tmp/llm-workbench-pr10-consumer/consumer.ts
import { WorkbenchSession } from "@llm-workbench/runtime";

const session = new WorkbenchSession({
  protocolVersion: "0.0.0-test",
  state: {} as any,
  appendTrace: () => undefined,
  newEventId: () => "evt_external",
  nowIso: () => "2026-05-08T00:00:00.000Z",
  canStartStep: () => ({ ok: true as const }) as any,
});

export const runId = session.runId;
```

The external consumer compiles and declaration-emits with no diagnostics:

```text
$ /Users/roymcfarland/Projects/llm-workbench/node_modules/.bin/tsc -p /private/tmp/llm-workbench-pr10-consumer/tsconfig.json
(no output)
```

The emitted consumer declaration does not need to name `SessionContext`:

```text
$ sed -n '1,80p' /private/tmp/llm-workbench-pr10-consumer/dist/consumer.d.ts
export declare const runId: string;
```

Even exporting the constructed session value declaration-emits cleanly:

```text
$ /Users/roymcfarland/Projects/llm-workbench/node_modules/.bin/tsc --module NodeNext --moduleResolution NodeNext --target ES2022 --strict --declaration --emitDeclarationOnly --outDir /private/tmp/llm-workbench-pr10-consumer/dist-export /private/tmp/llm-workbench-pr10-consumer/export-session.ts
(no output)
```

```text
$ sed -n '1,80p' /private/tmp/llm-workbench-pr10-consumer/dist-export/export-session.d.ts
import { WorkbenchSession } from "@llm-workbench/runtime";
export declare const session: WorkbenchSession;
```

A consumer can also name the constructor parameter through a type query without importing the internal alias:

```text
$ /Users/roymcfarland/Projects/llm-workbench/node_modules/.bin/tsc --module NodeNext --moduleResolution NodeNext --target ES2022 --strict --declaration --emitDeclarationOnly --outDir /private/tmp/llm-workbench-pr10-consumer/dist-param /private/tmp/llm-workbench-pr10-consumer/constructor-parameter.ts
(no output)
```

```text
$ sed -n '1,80p' /private/tmp/llm-workbench-pr10-consumer/dist-param/constructor-parameter.d.ts
import { WorkbenchSession } from "@llm-workbench/runtime";
export type WorkbenchSessionContext = ConstructorParameters<typeof WorkbenchSession>[0];
```

But importing `SessionContext` from the package root fails, as intended:

```text
$ /Users/roymcfarland/Projects/llm-workbench/node_modules/.bin/tsc --module NodeNext --moduleResolution NodeNext --target ES2022 --strict --noEmit /private/tmp/llm-workbench-pr10-consumer/bad-import.ts
bad-import.ts(1,15): error TS2305: Module '"@llm-workbench/runtime"' has no exported member 'SessionContext'.
```

So the risk described in the audit prompt - a direct-construction failure merely because the constructor parameter is a non-exported imported type - does not reproduce. The package's declaration file refers to `./sessionContext.js` by relative path from another declaration file inside `dist`, and TypeScript resolves that internal relative import for checking.

Layer 2 passes, with a methodology comment on Concern A only.

## Layer 3 - Behavior Preservation

The slice is behavior-preserving. No method body changes, no controller construction order changes, and no constructor argument changes occur beyond replacing the local name `sessionContext` with the original parameter `ctx`.

The six construction calls remain in the same order and pass the same dependency graph:

```text
$ nl -ba packages/runtime/src/runtime/session.ts
    48	  constructor(private readonly ctx: SessionContext) {
    49	    this.lifecycle = new RunLifecycleController(ctx);
    50	    this.gates = new GateController(ctx, this.lifecycle);
    51	    this.steps = new StepController(ctx, this.lifecycle, this.gates);
    52	    this.artifacts = new ArtifactController(ctx, this.lifecycle);
    53	    this.trace = new TraceController(ctx, this.lifecycle);
    54	    this.rules = new RuleController(ctx, this.lifecycle);
    55	  }
```

The session diff contains no hunks inside facade method bodies after `snapshot()`; the only hunk after the constructor context is unchanged context around `get runId()`. I also ran Git's whitespace checker:

```text
$ git diff main...HEAD --check
(no output)
```

No behavior-changing scope violation was found. Layer 3 passes.

## Layer 4 - Spec Compliance And PROJECT.md Alignment

The Builder diff scope was exactly two files before this audit file was added:

```text
$ git diff main...HEAD --name-only
CLOSEOUT.md
packages/runtime/src/runtime/session.ts
```

The public surface file was untouched:

```text
$ git diff main...HEAD -- packages/runtime/src/index.ts
(no output)
```

`workbench.ts`, the only direct in-repository caller of the constructor, was not changed:

```text
$ git diff main...HEAD -- packages/runtime/src/runtime/workbench.ts
(no output)
```

No test files were changed:

```text
$ git diff main...HEAD -- '*test*'
(no output)
```

`CLOSEOUT.md` contains the required architectural-choice and PROJECT.md compliance sections:

```text
$ rg -n "Architectural choices made during this slice|Why Option A|Decisions made beyond|Pre-condition deviation|PROJECT.md compliance checklist|Cross-controller" CLOSEOUT.md
189:## Architectural choices made during this slice
193:**Why Option A and not Option B.** Option A is fewer lines of code, removes the duplication entirely rather than guarding against it with a custom utility type, and has zero behavioral difference for any existing consumer. The static analysis premise in §2 of the Builder prompt — that `WorkbenchHost.session()` is the only direct caller of the constructor — held during implementation. I did not encounter a blocker that would force Option B.
195:**Decisions made beyond the literal text of the prompt.** Three:
203:**Pre-condition deviation noted.** §4 of the prompt directed me to confirm that `git show 3e686c5:packages/runtime/src/runtime/sessionContext.ts | wc -l` reports 19 lines. The actual count is 18 lines (`wc -l` counts trailing newlines and the file has 18 lines of content with one trailing newline). The 19-vs-18 discrepancy does not affect the slice — the structural shape of `SessionContext` is intact at lines 5–18 inclusive of the file as the prompt described. I am noting this here per §4's "any deviation must be flagged" rule rather than treating it as a blocker.
207:## PROJECT.md compliance checklist
215:- **Cross-controller method elevation** (JSDoc must enumerate sibling controllers, state non-public-surface status, and tag `@internal`). This rule applies when a refactor elevates a previously-private method to support sibling-controller calls. **This slice elevates no method.** The `@internal` tag I added is on the constructor, not on a controller method, and is for a different reason (it documents the constructor as an internal construction site, not a cross-controller call contract). The rule is therefore not triggered. I did read PR #9's JSDoc on `RunLifecycleController.assertRunActive` (which **is** the rule's first application) to make sure my JSDoc style is consistent with the precedent.
```

The `CLOSEOUT.md` architectural choices section does enumerate the three decisions the audit prompt called out: JSDoc placement/verbosity, removal of declarations rendered unused by the constructor refactor, and preservation of `private readonly`. It also explains why Option A was chosen rather than Option B, and flags the 18-vs-19 pre-condition discrepancy.

I agree with the Builder's PROJECT.md classification of the cross-controller method-elevation rule. That convention applies when a previously private controller method becomes a sibling-controller dependency. This slice does not elevate any method, and the `@internal` tag is on the `WorkbenchSession` constructor for construction-surface reasons. The current rule should not be stretched to cover constructor tagging. If constructor-internality becomes a recurring pattern, it deserves a separate convention, not an expansion of the cross-controller rule.

Layer 4 passes.

## Final Verdict

**APPROVE WITH COMMENTS**

The PR meets the mechanical criteria, preserves runtime behavior, keeps `packages/runtime/src/index.ts` unchanged, leaves `workbench.ts` and tests untouched, and implements the intended Option A constructor refactor. I do not see a merge-blocking defect.

Comments for follow-up:

1. Concern A: The dead `TraceEvent`, `ArtifactStore`, and `CanStart` cleanup is acceptable in this PR because those declarations were made dead by the exact constructor edit. Future Builder prompts or PROJECT.md should explicitly allow removing imports and local helper type aliases that are rendered unused by the slice's own edit, while still forbidding unrelated "while here" cleanup.

2. Concern B: The external-construction backstop is valid. Direct external `new WorkbenchSession({ ... })` compiles, declaration emit succeeds, and `ConstructorParameters<typeof WorkbenchSession>[0]` remains usable as a type query. `SessionContext` is not importable by name from `@llm-workbench/runtime`, which is consistent with the intended non-export.

3. Cross-controller rule: The `@internal` constructor tag does not fall under PROJECT.md's cross-controller method-elevation rule. No PROJECT.md change is needed for that rule. If future slices mark constructors or factory-only entry points as internal, add a separate convention for supported construction paths instead of broadening the method-elevation rule.

## Methodology Learnings

The emitted declaration check should stay standard for runtime-package refactors that touch exported classes, constructors, or facade signatures. It caught a meaningful mismatch between the Builder prompt's expectation and TypeScript reality: the prompt predicted that `dist/runtime/session.d.ts` would keep an inlined structural constructor type, while the actual declaration emits `constructor(ctx: SessionContext)` plus a relative internal import.

The explicit "Architectural choices made during this slice" section was useful. It made the dead-import cleanup, JSDoc verbosity, and `private readonly` preservation auditable without having to infer the Builder's intent from the diff alone.

The 18-vs-19 pre-condition discrepancy was low impact but not useless. It proved the Builder was checking the real parent commit instead of reciting the prompt, and it created a clean place to record that the prompt's line count was off without derailing the slice.

The scope-envelope precedent from Concern A should be made explicit: cleanup is acceptable when it is mechanically caused by the authorized edit and limited to the same local code path; cleanup is not acceptable when it merely happens to be nearby. That gives future Builders room to keep code clean without turning narrow slices into opportunistic refactors.
