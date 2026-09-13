# `llm-workbench` Roadmap

This is an open-source project (MIT-licensed, public since 2026-06-16). For
current scope, non-goals, and the authoritative spec, see
[`PROJECT.md`](PROJECT.md#non-goals).

**How work is tracked.** Shipped work lives in [`CHANGELOG.md`](CHANGELOG.md) and
[GitHub Releases](https://github.com/roymcfarland/llm-workbench/releases).
Individual actionable items are
[GitHub Issues](https://github.com/roymcfarland/llm-workbench/issues).
This file records the *standing priorities and policies* that outlive any single
issue — the context a new contributor (or agent) needs before picking something up.
Feature requests and bug reports are welcome; see
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## Current priorities

### Marketing-page performance
Largest Contentful Paint on `/` is ~6.3s against Google's 2.5s "good" threshold.
Two changes already landed (Clerk no longer loads for anonymous visitors;
reduced-motion visitors skip the three.js hero), taking LCP from 9.4s.

The remaining opportunity is measured but not scoped: stubbing the marketing
client islands entirely is worth **−2.80s LCP / −507KB**, so the ceiling is real.
The two candidates are React Flow (~277KB, rendered non-interactively in the hero)
and the three.js post-processing pass (~58KB transferred).

**Do not scope another lazy-load or deferral slice.** Three separate experiments
established that deferring moves zero bytes and roughly zero LCP; only *removing*
bytes helps. Both remaining levers trade visual quality for speed, so they need a
product decision, not just an implementation.

### Search indexing
Sitemap hygiene shipped; the sitemap has been resubmitted to Google Search
Console and is awaiting a re-read. If `/blog` remains unindexed, the next step is
`noindex` on single-post tag pages.

## Standing policy: dependency upgrades

Patch and minor updates are routine — merge them once CI is green.

**A major upgrade must justify itself.** Acceptable drivers are a security
advisory, an end-of-life or unsupported upstream, or unblocking another upgrade.
Currency alone is not a reason: a major with no driver trades a cosmetic version
number for real regression risk.

Majors that have been evaluated and declined keep their reasoning here so the
decision is not re-litigated each time Dependabot reopens them:

- **`@types/node` beyond the engine floor.** These types should track the
  *lowest* supported runtime. `engines.node` is `>=22`, so `^22.x` is correct;
  a newer major would type APIs that do not exist on a runtime CI actually tests
  against. Revisit when the engine floor moves.
- **TypeScript 7.** Blocked upstream — `typedoc` and `typescript-eslint` both cap
  below it. It is also a compiler port, which is a migration project rather than
  a dependency bump.
- **Express 5.** No advisory; confined to a private example workspace with no
  tests and no CI coverage, so there would be nothing to verify the upgrade
  against.

- **Changesets v3 (`@changesets/cli` 3 with `changesets/action` v2).** No advisory; CLI 2.x (`maintenance-v2`)
  and action v1 are maintained. The two must move together — action v2 targets Changesets v3, renames the
  `version`/`publish` inputs `release.yml` passes, and v3 stops versioning private packages and exits non-zero
  when there are no changesets. CI never runs `release.yml`, so this needs one PR verified by a real release run.
  Declined 2026-09-12 (#178, #189).

Declined majors are closed **without** `@dependabot ignore` directives, so they
resurface if the blocking condition lifts.

## Parked

Not scheduled, but recorded so the reasoning is not lost:

- **Signed-in end-to-end tests against a real Clerk runtime.**
  [Issue #160](https://github.com/roymcfarland/llm-workbench/issues/160), closed as not planned. #212 added unit
  coverage of the tenant boundary — `requireTenant`, signed-out 401s on the runs and llm APIs, and `tenant_id`
  filtering. The `/runs` page's inline query and live Clerk sessions stay uncovered; they would need a Clerk
  development instance and a test user provisioned as CI and Dependabot secrets. Revisit with a future
  `@clerk/nextjs` major or an auth-flow change.
- **CDN-cacheable marketing responses.** Every marketing page currently returns
  `cache-control: private, no-store` because Clerk in `proxy.ts` and a per-request
  CSP nonce run on the page routes matched by the proxy (excluding `_next`, dotted paths and `/api/health`). Measured cost is small (~200ms), and the change
  touches a security control.
- **Override cleanup.** Root `overrides` retain security floors: `postcss@^8.5.23`
  floors at Next.js 16.3.4's exact `8.5.23` pin but resolves the tree to `postcss@8.5.28`, while `sharp@^0.35.3` now trails
  Next.js's `^0.35.4` requirement. Whether to retain or remove these overrides
  remains an open decision, not a tidy-up.
- **ESLint compatibility pins.** The `minimatch@^10.2.5` override keeps
  `eslint-config-next`'s import, jsx-a11y and react plugin chains off `minimatch@3`
  (`GHSA-mh99-v99m-4gvg`). The parser and React-version settings in
  `apps/web/eslint.config.mjs` work around missing ESLint 10 support; revisit when the plugins update.
- Larger file-size splits.
