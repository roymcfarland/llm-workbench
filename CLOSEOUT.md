# Closeout: Beloved-story `/runs/demo` scenario rotation

This slice replaces the single public job-search demo with five seeded,
read-only agent traces from beloved books and movies. The route remains
`force-dynamic`, picks a random scenario by default, and supports
`/runs/demo?s=<id>` for pinned verification/share links.

## Outcome

- Added the five scenarios under `apps/web/lib/landing/scenarios/`:
  `ring`, `hogwarts`, `delorean`, `deepThought`, and `wonka`.
- Added client-safe scenario artifact/rule schemas and registered them in
  `RunDetailClient` alongside the existing demo schemas.
- Changed `buildDemoRunSerialized(scenarioId?)` to select a pinned scenario
  or a random one, then return `title` and `blurb` for the demo page subtitle.
- Exposed in-character human approval notes in trace rows so the approval gate
  is visible in the read-only demo.
- No `packages/runtime` changes, no `apps/web/lib/workflow/job-search.ts`
  changes, and no dependency/package-lock changes.

## Files changed

- `apps/web/lib/landing/scenarios/*`
- `apps/web/lib/landing/demo-run.ts`
- `apps/web/app/runs/demo/page.tsx`
- `apps/web/components/run-detail-client.tsx`
- `CHANGELOG.md`
- `CLOSEOUT.md`

## Verification

```text
npm run build                                      pass
npm run typecheck -w @llm-workbench/web           pass
npm run lint -w @llm-workbench/web                pass
npm test -w @llm-workbench/web                    pass, 79 tests
npm run build:web                                 pass
LLM_WB_E2E_DISABLE_DNS_SHIM=1 npm run test:e2e -w apps/web
                                                    pass, 4 tests
npm run ci                                        pass
npm run audit:check                               pass
```

## Manual render check

`npm run dev:web` served the app at `http://localhost:3000`. The pinned routes
below each rendered the scenario title/blurb, completed workflow stats,
model/tool/gate trace events, visible in-character gate notes, clean artifact
tabs, and approved gate state:

```text
/runs/demo?s=ring
/runs/demo?s=hogwarts
/runs/demo?s=delorean
/runs/demo?s=deepThought
/runs/demo?s=wonka
```

Refreshing `/runs/demo` 15 times returned all five scenarios at least once:
`ring`, `hogwarts`, `delorean`, `deepThought`, and `wonka`.

The only dev-browser console noise observed during the manual pass was the
existing dummy Clerk script timeout; there were no hydration, schema, CSP, or
eval failures from this slice. The e2e CSP smoke remained green.
