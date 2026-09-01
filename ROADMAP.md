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

### Signed-in end-to-end test coverage
[Issue #160](https://github.com/roymcfarland/llm-workbench/issues/160).
There is no automated way to exercise a **signed-in** session. Everything
requiring a session is verified by hand, which is how a Clerk provider change
shipped with its signed-in path checked only manually. This matters because
`requireTenant()` in `apps/web/lib/auth/tenant.ts` fronts a service-role Supabase
key that bypasses RLS — the auth boundary is a hard security control with no
signed-in regression net.

Blocked on a Clerk **development** instance and a test user being provisioned as
repository secrets. The test code is designed to skip cleanly when those are
absent, so it can land before they exist.

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

Declined majors are closed **without** `@dependabot ignore` directives, so they
resurface if the blocking condition lifts.

## Parked

Not scheduled, but recorded so the reasoning is not lost:

- **CDN-cacheable marketing responses.** Every marketing page currently returns
  `cache-control: private, no-store` because Clerk middleware and a per-request
  CSP nonce run on every route. Measured cost is small (~200ms), and the change
  touches a security control.
- **Override cleanup.** Root `overrides` pin `postcss` and `sharp` to versions
  Next.js now declares natively. They are retained deliberately as a security
  *floor* that survives an upstream regression; removing them is a real decision,
  not a tidy-up.
- **ESLint compatibility pins.** A `minimatch` override and two
  `apps/web/eslint.config.mjs` settings exist only because `eslint-config-next`'s
  plugins do not yet support ESLint 10 natively. Revisit all three together when
  they do.
- Larger file-size splits, Upstash rate-limiting, and Ajv precompiled-validator
  wiring.
