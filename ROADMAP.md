# `llm-workbench` Roadmap

> Audience: contributors and engineering leaders evaluating the project.
> Style: dated milestones, concrete deliverables, owner tags. Anything
> aspirational lives in [Strategic decisions log](#strategic-decisions-log).
> Dates are relative ("Week N") so the schedule stays valid as we slip.

The 0.2.0 release shipped four Apache 2.0 packages (`@llm-workbench/runtime`,
`@llm-workbench/adapters-react`, `@llm-workbench/ai-sdk`, `@llm-workbench/ui`),
a fifth package extracted right after release (`@llm-workbench/mcp`), and a
PolyForm-Noncommercial hosted reference plane at `apps/web/`.

This document covers the **eight weeks** following 0.2.0, organized into
four fortnightly milestones (0.3.0 → 0.6.0).

---

## Owner tags

- `(core)` — one of the four published OSS packages or `@llm-workbench/mcp`.
- `(apps)` — `apps/web` hosted reference plane (PolyForm-NC).
- `(docs)` — README, DEPLOY.md, public docs site, llms.txt content, etc.
- `(infra)` — CI, release tooling, Vercel/Supabase wiring, MCP plugins.

---

## Weeks 1–2 — `0.3.0` "Adoption"

**Theme.** Make it trivial to consume the four OSS packages and stand up
the hosted reference plane. Stop hand-rolling things that should be
agent-or-CLI driven.

### Tasks

1. `(infra)` Tag and publish `0.2.0` of the four OSS packages plus
   `@llm-workbench/mcp` via `.github/workflows/release.yml` (already
   wired for tag-driven publish with Sigstore provenance and an
   `NPM_TOKEN` secret). Confirm provenance attestation surfaces on
   <https://www.npmjs.com/package/@llm-workbench/runtime>.
2. `(docs)` Public docs site at `apps/web/docs/` (we already have
   `apps/web/app/docs/protocol/page.tsx` as a beachhead). Sections:
   _Concepts_, _Getting started_, _AI SDK adapter_, _MCP server_,
   _Hosted reference plane_, _Self-hosting_. Source the long-form
   prose from `lib/landing/protocol-prose.ts` so the landing page and
   docs share one canonical text.
3. `(infra)` Bootstrap script at `scripts/bootstrap.mjs` that drives
   the Vercel + Supabase MCP plugins to provision the hosted plane:
   creates a Supabase project, applies `apps/web/supabase/migrations/0001_init.sql`,
   provisions Clerk via Marketplace, sets all env vars on a freshly
   imported Vercel project. Goal: one `npm run bootstrap` command
   replaces the manual checklist in `apps/web/DEPLOY.md`.
4. `(core)` Polish the OTel exporter (`packages/runtime/src/telemetry/otel.ts`
   added in 0.2.0). Ship recipes for Datadog, Honeycomb, and Tempo as
   `examples/telemetry-*` apps. Add an OTLP HTTP shipper helper.
5. `(apps)` Replace the Vercel project name `llm-workbench-job-search-demo`
   with two project shapes: `llm-workbench-web` (Next.js, Root Directory
   = `apps/web`) and `llm-workbench-job-search-demo` (Vite, Root Directory
   = `examples/job-search-demo`). Document both in DEPLOY.md.
6. `(docs)` Two short blog posts: "Why `llm-workbench` is headless" and
   "How tamper-evident run bundles work". Cross-post to `/blog/` on
   the docs site.

### Risk register

- **Risk:** the bootstrap script gates on the Vercel + Supabase MCP
  plugins being available in the user's environment.
- **Mitigation:** ship a fallback path that uses the published
  `@vercel/sdk` and `@supabase/supabase-js` against bearer tokens.
  Document both paths.

### Exit criteria

- [ ] Five packages tagged + published to npm with provenance.
- [ ] `apps/web/docs/` reachable at `https://llmworkbench.io/docs/`.
- [ ] `npm run bootstrap` end-to-end provisions Supabase + Clerk +
      Vercel project + env vars in under 5 minutes on a fresh laptop.
- [ ] Two blog posts indexed on the docs site.
- [ ] OTel recipes + one CI smoke that asserts a `model_io` event
      surfaces in Honeycomb's free tier.

---

## Weeks 3–4 — `0.4.0` "Eval & Replay"

**Theme.** Moving from "you can run an agent" to "you can prove that the
agent regressed." First-class eval, semantic JSON diffing, and the
replay scrubber UI.

### Tasks

1. `(core)` New package `@llm-workbench/eval` (Apache 2.0). Public
   surface:
   - `defineSuite({ name, fixtures: AsyncIterable<Fixture> })`.
   - Assertion DSL: `expectEqual`, `expectMatchesSchema`,
     `expectCostUnder`, `expectLatencyUnder`,
     `expectToolCalled(name, n?)`, `expectArtifactDigestStable`.
   - `runSuite({ runtime, suite, parallelism? })` returns an
     `EvalReport` with per-fixture pass/fail, cost regression deltas
     vs baseline, and a tamper-evident `bundleHash` for the report.
   - CLI shim `llm-eval run path/to/suite.ts`.
2. `(core)` Semantic JSON diff in `@llm-workbench/runtime`. New helper
   `semanticDiff(a, b, { ignoreOrder?, ignorePaths? })` returning an
   array of `JsonPatchOp` with stable ordering. Used by the replay
   scrubber and the eval baseline comparator.
3. `(core/ui)` Replay scrubber in `WorkbenchShell` — virtualized trace
   already lands events in order; the scrubber lets you scrub backward
   to any `step_started` boundary, replay forward at 1×/2×/4×, and
   diff each step's `RunStoreState` against the prior using the new
   semantic diff. Lazy-loaded, no impact on the existing API.
4. `(apps)` Eval mode in `apps/web/playground` — pick a suite, run it
   against the active runtime, surface pass/fail + cost delta inline.
5. `(docs)` "Detecting regressions" tutorial walking through writing
   a suite, running it locally, then wiring it into GitHub Actions on
   the same `release.yml` gate.

### Risk register

- **Risk:** Eval is a crowded space (OpenAI Evals, Promptfoo, Braintrust,
  Inspect AI) — re-inventing the wheel.
- **Mitigation:** Treat the eval format as **deferred decision (a)**
  in the [Strategic decisions log](#strategic-decisions-log). Ship a
  thin proprietary surface in 0.4 with a small adapter layer; commit
  to interop with one external format by 0.5.

### Exit criteria

- [ ] `@llm-workbench/eval` published to npm at `0.4.0`.
- [ ] Replay scrubber lands behind a `WorkbenchShell` prop flag and
      ships a Storybook fixture.
- [ ] GitHub Actions workflow `eval.yml` in this repo runs the
      runtime's own eval suite on every PR and posts the cost delta
      to the PR comment.
- [ ] At least one third-party eval fixture imported (e.g. an
      OpenAI Evals YAML) and runnable through the adapter.

---

## Weeks 5–6 — `0.5.0` "Marketplace seeds"

**Theme.** A clear answer to "I want to use this in production but my
org needs guardrails." Policies as a registry, signed bundles, and a
one-click hosted-plane deploy template.

### Tasks

1. `(core)` New package `@llm-workbench/policies` (Apache 2.0). Public
   surface:
   - `defineStepGate({ id, version, evaluate(ctx) })`.
   - Built-in policies: `redact-pii`, `cost-cap-per-tenant`,
     `output-must-match-schema`, `tool-allowlist`,
     `rate-limit-by-tenant`.
   - Registry pattern: a policy publishes its own JSON manifest at
     `dist/manifest.json` so other registries (npm, internal artifact
     stores) can crawl it.
2. `(core)` Signed run bundles. Optional `bundleSignature` field on
   `RunBundle`, signed with a project-scoped private key (default:
   ed25519 via WebCrypto). `verifyRunBundleSignature(bundle, publicKey)`
   helper. Backwards-compatible — unsigned bundles continue to work.
3. `(infra)` "Deploy to Vercel" button on the README that uses the
   bootstrap script as a Vercel Marketplace integration. Result: anyone
   can stand up a private hosted plane from the GitHub README in <2 min.
4. `(apps)` Policies UI in `apps/web/playground` — pick policies from a
   curated registry, attach to a workflow, dry-run before activating.
5. `(docs)` "Bring your own policy" cookbook — write a custom policy,
   publish it to npm, install it in the hosted plane.

### Risk register

- **Risk:** Distribution model for policies (npm vs. a custom registry)
  affects discoverability and trust.
- **Mitigation:** **Deferred decision (b)** — see strategic log. Ship
  via npm in 0.5 with a stable manifest format; if a custom registry
  emerges from user demand, the manifest carries forward.

### Exit criteria

- [ ] `@llm-workbench/policies` published with five built-in policies.
- [ ] Signed bundles round-trip through `RunRepository` with signature
      preserved; `verifyRunBundleSignature` lands in `runtime`.
- [ ] One-click deploy works from the README on a fresh GitHub account.
- [ ] Policies UI ships in the hosted plane with a `policies.lwb-*`
      CSS scope.

---

## Weeks 7–8 — `0.6.0` "Hosted plane GA"

**Theme.** Take `apps/web` from "scaffold" to "thing you'd hand a paying
customer." Multi-tenant, audited, billed.

### Tasks

1. `(apps)` Multi-tenant org model in Supabase. Migration `0002_orgs.sql`:
   `organizations`, `organization_members`, plus `tenant_id` on `runs`
   keyed to org id (not user id). Backfill existing rows under a
   `tenant_id = user:<uid>` namespace so old runs stay reachable.
   Clerk Organizations becomes the first-party provider.
2. `(apps)` Audit log table `audit_events` + middleware that records
   every authed write (`runs.put`, `runs.delete`, policy edit, member
   change). Surfaced at `/admin/audit` for org admins.
3. `(apps)` Billing reconciliation. Daily job that joins
   `model_usage` (from trace events) with the AI Gateway
   per-tenant spend export, writes a per-tenant invoice line item.
   Hook into Stripe (decision (c) below) for actual collection.
4. `(infra)` Status page powered by Vercel's deployment events feed.
   Public read at `/status`.
5. `(docs)` Public preview at `https://llmworkbench.io` with the four
   OSS packages, the hosted plane, and a "Try it" button on the
   landing page that boots a sandboxed run.
6. `(docs)` Tier upgrade page documenting the PolyForm-NC commercial
   license — what counts as commercial use, how to request a key,
   pricing rails.

### Risk register

- **Risk:** Billing collection is a regulated rabbit hole.
- **Mitigation:** **Deferred decision (c)** — Stripe direct vs. Vercel
  Marketplace billing. Both work; Vercel Marketplace shortens
  time-to-revenue by a few weeks if we ship via the Marketplace
  channel. Pick by start of week 7.

### Exit criteria

- [ ] `0002_orgs.sql` applied to the production Supabase project; old
      runs visible under their migrated tenant_id.
- [ ] Audit log records 100% of authed writes; UI shows the last 100
      events filtered by tenant.
- [ ] First test invoice generated against a live AI Gateway export.
- [ ] `/status` reports green during a scheduled deploy.
- [ ] `https://llmworkbench.io` is reachable and not behind auth.

---

## Strategic decisions log

### Decisions already made (0.2.0)

These are settled and the repo encodes them; documented here for
contributors so we don't re-litigate them every quarter.

1. **License — dual.** Apache 2.0 for the four OSS packages plus
   `@llm-workbench/mcp`; PolyForm Noncommercial 1.0.0 for `apps/web`
   and any future hosted-plane-only feature (eval marketplace,
   cost-reconciliation, billing). DCO sign-off enforced on every PR
   via `.github/workflows/dco.yml`.
2. **Artifact storage — threshold-based.** `RunRepository.artifactStore`
   accepts an `ArtifactStore` implementation; payloads ≥256 KB
   externalize to it, smaller stay inline. `ArtifactPointer.payloadHash`
   carries SHA-256 in either case for tamper detection.
3. **MCP transport — Streamable HTTP first.** `apps/web/api/mcp` and
   `@llm-workbench/mcp/http` ship a Web-standard `Request → Response`
   adapter. A stdio relay is deferred until there's a concrete
   consumer asking for it.
4. **Agent supervision — hierarchical.** `RunContextRef` accepts
   `parentRunIds` (plural) so a run can be a child of multiple
   parents. `WorkbenchRuntime.runChildrenOf` and `cancelRunCascade`
   make supervision usable without external orchestration.

### Decisions deferred to weeks 3–4

These need adjudication before the corresponding milestone starts.

(a) **Eval format.** Proprietary `@llm-workbench/eval` schema vs.
interop with one external format (OpenAI Evals, Promptfoo, Inspect
AI). Recommendation: ship proprietary in 0.4 + add an OpenAI Evals
adapter in 0.5. _Adjudicate by start of week 3._

(b) **Policy distribution.** npm vs. a dedicated registry. npm gives
us free discovery and Sigstore provenance; a dedicated registry
gives us trust scoring and revocation. Recommendation: npm with a
stable `manifest.json` schema, defer registry until 0.7.
_Adjudicate by start of week 5._

(c) **Hosted billing.** Stripe direct vs. Vercel Marketplace billing.
Stripe gives us full control; Marketplace gives us procurement
parity with the Vercel ecosystem. Recommendation: ship Marketplace
first if we can get listed in time, fall back to Stripe direct.
_Adjudicate by start of week 7._

---

## Out of scope for the next 8 weeks

Documented so we say "no" without re-thinking it:

- A bespoke runtime UI for non-React frameworks (Vue, Svelte). The
  protocol is framework-agnostic; bindings can come post-0.6 if there
  is demand.
- An on-prem self-hosted operator (Helm chart). The hosted plane is
  Apache 2.0 / PolyForm-NC and self-runnable; a Kubernetes operator
  is an order of magnitude more work and only makes sense once
  multi-tenancy is real.
- A model-training story. `llm-workbench` is a control plane, not a
  trainer. Eval ≠ training.

---

## Cadence

- **Weekly status note** every Friday on `/blog/` summarizing what
  shipped, what slipped, what's next.
- **Fortnightly milestone post** on the milestone's exit Friday with
  a checkbox-style status against the criteria above.
- **Open issues** tagged `roadmap:wN-N` so external contributors
  know what's claim-able vs. core-owned.

If a milestone slips by more than one week, post a roadmap revision
that re-dates the affected milestones and surfaces it on the docs
homepage. Roadmap drift is a feature; silent roadmap drift is a bug.
