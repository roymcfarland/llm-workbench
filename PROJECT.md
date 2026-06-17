# PROJECT.md

> This document is the authoritative source of truth for the Builder, Closeout, and Verifier agents operating on this repository. When this document conflicts with other files (README.md, package.json, inline comments, etc.), this document wins and the conflicting file should be corrected in the same PR that surfaces the conflict.

---

## Purpose

**LLM Workbench is an open-source control plane for LLM-powered products, built and maintained by Roy McFarland.** It provides a headless, model-agnostic runtime that records workflow state, artifacts, rules, human-review gates, trace history, model I/O, and cost telemetry, plus a React UI shell and a hosted reference deployment (`apps/web`) wired to Clerk authentication, Supabase persistence, and the Vercel AI Gateway. The host application owns prompts, tools, and model selection; the runtime records what happened and gives humans a clean control surface over it.

**License posture: open source under the MIT License.** The five core libraries under `packages/*` are published to npm under the public `@llm-workbench/*` scope. The hosted reference app (`apps/web`) and the `examples/*` apps are part of the public repository but are **not** published as npm packages (they remain `"private": true`). The repository is public at `github.com/roymcfarland/llm-workbench`.

---

## Stack

- **Monorepo:** npm workspaces (no pnpm/yarn).
- **Runtime:** Node `>=22` (CI matrix: 22 and 24).
- **Core packages (`packages/*`):** TypeScript, Zod, Ajv, fast-json-patch.
- **UI packages:** React 19, Tailwind CSS, `@dnd-kit`, Monaco, React Flow.
- **Hosted reference plane (`apps/web`):** Next.js 16 (App Router), React 19.
- **Auth & Tenancy:** Clerk.
- **Persistence:** Supabase (service-role + API-layer tenancy guard).
- **LLM Gateway:** Vercel AI SDK (`ai`) + AI Gateway.
- **Optional integrations (env-gated):** Sentry, Upstash (Redis rate-limiting), Resend.

---

## Architecture

The repository is structured as an npm workspace with five core packages under `packages/`: `runtime` (headless state, tracing, bundle integrity), `adapters-react` (subscription hooks), `ui` (React shell), `ai-sdk` (Vercel AI SDK wrappers), and `mcp` (Model Context Protocol server factory).

The hosted reference deployment lives at `apps/web`. It exposes public marketing/discovery routes and session-gated application routes. The local **server** entry points for API traffic are the Next.js route handlers under `apps/web/app/api/`. The **browser/React** entry points are the Next.js page components.

Tenancy is enforced at the API layer via `requireTenant()` in `apps/web/lib/auth/tenant.ts`, which derives a stable tenant scope from the Clerk session. This is a hard security boundary because the Supabase persistence layer (`apps/web/lib/supabase/runs-store.ts`) uses a service-role key that bypasses Row Level Security.

---

## Conventions

- **Auth enforcement:** API routes must return structured JSON `401 Unauthorized` responses when unauthenticated, never HTML redirects.
- **Middleware:** Clerk auth, CSP headers, and optional Upstash rate-limiting are enforced via Next.js middleware.
- **MCP discovery:** Protocol discovery routes (`/api/mcp` GET, `/.well-known/mcp.json`) are public; mutating JSON-RPC tools require an authenticated session.
- **Errors:** Internal errors are sanitized in production to avoid leaking stack traces; `WorkbenchError` is used for structured, stable error codes across package boundaries.
- **Cross-controller method elevation:** When a refactor splits a class into multiple controllers and one controller's previously `private` method becomes a cross-controller dependency (i.e., other sibling controllers must call it), the elevated method must (a) carry a JSDoc comment that explicitly enumerates the sibling controllers permitted to call it, (b) state that the method is **not** part of the public surface reachable through any facade, and (c) be tagged `@internal` so it is excluded from generated `.d.ts` documentation. The Verifier should fail any PR that elevates such a method without all three. The first instance of this pattern is `RunLifecycleController.assertRunActive` (see `packages/runtime/src/runtime/runLifecycleController.ts`).
- **Slice scope envelope and incidental cleanup:** A Builder slice's scope envelope is defined by the Builder prompt's authorized edits. Within that scope, the Builder may also remove imports, local helper type aliases, and other declarations that are *mechanically* rendered unused by the slice's exact authorized edit, in the same file as the edit, in the same PR. The Builder may not remove or refactor declarations that merely *happen* to be nearby, dead for unrelated reasons, or stylistically suboptimal. Any such incidental cleanup must be enumerated in the PR description's "Architectural choices" section with a one-sentence justification linking each removal to the authorized edit. The Verifier should fail any PR whose incidental cleanup cannot be justified as mechanically caused by the authorized edit. The first instance of this pattern is the removal of `TraceEvent`, `ArtifactStore`, and `CanStart` declarations in PR #10's `session.ts` constructor refactor (see `docs/process/VERIFIER-AUDIT-PR10.md` Concern A).
- **Declaration-emit comparison for runtime-package public-surface refactors:** Any Builder slice that touches an exported class, exported function signature, or facade type in the `@llm-workbench/runtime` package must include, as an acceptance criterion, a literal-output comparison of the emitted `.d.ts` signature on the parent commit versus the slice commit. The Builder must check out the parent commit, run `npm run build -w @llm-workbench/runtime`, capture the relevant declaration with `sed -n` or equivalent, repeat on the slice commit, and paste both transcripts in the PR description. The Verifier must independently re-run the comparison. This rule does not apply to internal-only changes (changes to non-exported symbols, test files, or packages other than `@llm-workbench/runtime`). The first instance of this pattern is criterion 7 of the Slice 2 Builder prompt (see `docs/process/VERIFIER-AUDIT-PR10.md` Layer 1, Criterion 7).

---

## Non-goals

The following are explicitly **out of scope** for this product. Agents should reject or flag work that moves the codebase in any of these directions unless this document is updated first.

- **Not a model provider.** The `@llm-workbench/runtime` control plane does not call OpenAI, Anthropic, local models, or any other LLM provider directly — the host application owns prompts, tools, and model selection. This non-goal scopes the *runtime / control-plane*; it does **not** restrict the reference deployment (`apps/web`) or repository site-ops tooling from calling the Vercel AI Gateway, which they already do (e.g. the playground resume-compile action and the automated blog publisher — see Q5).
- **Not a chat UI.** No general-purpose conversational interface, no chat-message threading, no role-played personas. The UI is a control surface for runs, not for chat.
- **Not a vendor-locked telemetry product.** Telemetry stays as structured trace events with optional OTel mapping. No proprietary ingest endpoint, no required SaaS sink.
- **Not a model-routing or model-selection product.** No routing logic, model A/B comparison harness, prompt-A/B testing, or model-quality scoring.
- **Not an evaluation or eval-harness platform.** No automated regression scoring, no LLM-as-judge wiring, no benchmark suite. (Eval may become a separate `packages/eval` product but is not in scope for `runtime` or `apps/web`).
- **Not a marketplace.** No third-party tool registry, no plugin store, no shared-prompts directory.
- **Not a billing / cost-reconciliation product.** Cost telemetry is recorded; reconciliation, invoicing, and seat-management are out of scope.
- **Not a multi-tenant admin platform / B2B product.** `apps/web` is per-user with optional Clerk org scoping, but it is not a workspace, SSO, RBAC, or org-admin product. *(Deferred — possible future release; if pursued, must be added as scoped roadmap item and this PROJECT.md updated before implementation begins).*
- **Not a hosted multi-tenant SaaS for outside users.** `apps/web` is the reference deployment, intended for the maintainer or paid licensees to self-host. *(Deferred — possible future release; if pursued, must be added as scoped roadmap item and this PROJECT.md updated before implementation begins).*
- **Not a native mobile app.** Surface is web.
- **Not a realtime collaboration tool.** No websockets, no presence, no shared editing of in-progress runs.
- **Not a data-warehouse or analytics product.** Trace events are the canonical artifact; building a warehouse-shaped query layer, dashboards-as-product, or BI integration is out of scope.

---

## Open questions (resolved)

The following questions were raised by static analysis of the repository and have been answered here. Agents should treat these answers as durable unless this document is updated.

### Q1. License shape and enforcement

**Answer: Open source under the MIT License.**

The repository and its `packages/*` libraries are licensed under the MIT License (see the root `LICENSE` and each `packages/*/LICENSE`). The five core packages are published to npm under the public `@llm-workbench/*` scope. This posture supersedes the prior proprietary, named-grant license; any residual proprietary/"all rights reserved"/"Authorized Users" language is obsolete and must be corrected wherever it appears.

**Verifier behavior:**
- Fail any PR that sets a package's `"license"` field to anything other than `"MIT"`, or that modifies a `LICENSE` file in a direction that removes or narrows the MIT grant (e.g., reintroduces proprietary, "all rights reserved", or "Authorized Users" language, or swaps in a non-MIT license).
- Fail any PR that adds `"private": true` to a publishable `packages/*` package — the five core packages must remain publishable. The root `package.json`, `apps/web`, and every `examples/*` package are **not** published and must keep `"private": true`; fail any PR that removes `private` from those.
- Fail any PR that adds a new `packages/*` directory without (a) an MIT `LICENSE` file and (b) publish configuration consistent with the `@llm-workbench/*` scope (`"publishConfig": { "access": "public" }`, a `repository` field, and no `"private": true`).

### Q2. Next.js middleware (proxy) naming convention

**Answer: `apps/web/proxy.ts` is the canonical location (Next.js 16 convention).**

Next.js 16 renamed the middleware file to `proxy.ts`; this project migrated from
`middleware.ts` accordingly (PR #38). The proxy (Clerk auth, CSP, rate-limiting,
and the `isPublicRoute`/SEO matcher) lives at `apps/web/proxy.ts`; there is no
`middleware.ts`.

**Verifier behavior:**
- Fail any PR that reintroduces `apps/web/middleware.ts` or renames `proxy.ts`
  back to `middleware.ts`.
- Extensionless image routes generated by `next/og` (`/opengraph-image`,
  `/twitter-image`, `/apple-icon`) must be listed in `isPublicRoute` so crawlers
  and link unfurlers reach them un-authenticated; do not gate them behind Clerk.

### Q3. File-size and structure rules

**Answer: Warn-only at 500 lines; hard-fail at 800 lines.**

Large files degrade agent context windows and increase merge conflicts. A 500-line soft cap is established to encourage modularity.

**Verifier behavior:**
- Warn on any PR that adds to a `.ts` or `.tsx` file (excluding `*.test.ts`/`*.test.tsx` and generated files) pushing it over 500 lines.
- Hard-fail any PR that pushes a non-generated `.ts` or `.tsx` source file over 800 lines. This hard cap is now active: both named split PRs have landed, with `packages/runtime/src/runtime/session.ts` at 185 lines and `packages/ui/src/WorkbenchShell.tsx` split under the 500-line soft cap.

### Q4. Repository visibility and publishing

**Answer: Public and published.**

The repository is public at `github.com/roymcfarland/llm-workbench`. The five `packages/*` libraries are published to npm under the public `@llm-workbench/*` scope, coordinated by a release workflow (changesets-based). This supersedes the prior private, non-publishing lock.

**Verifier behavior:**
- Fail any PR that attempts to make the repository private again (e.g., via a GitHub Actions script or settings change).
- A release/publish workflow (changesets `version` + `publish`, npm `--provenance`) is **expected**. Do not fail PRs that add or modify npm-publish automation; instead fail any PR that *removes* the publish pipeline once it exists.
- The five `packages/*` must be publishable (no `"private": true`; `"publishConfig": { "access": "public" }`). The root, `apps/web`, and `examples/*` are never published and keep `"private": true`.
- `npm publish` / `changeset publish` invocations in release automation are permitted and expected.

### Q5. Automated blog / content generation

**Answer: In scope as site-ops tooling for `apps/web`, via the Vercel AI Gateway.**

A scheduled GitHub Actions workflow may generate `apps/web` blog posts by grounding a Vercel AI Gateway model call in real, freshly fetched sources, validating the result against the blog front-matter schema (`apps/web/lib/blog/schema.ts`) and the project's CI gates, and publishing only when valid (otherwise skipping that run). This is website operations for the reference deployment — not a runtime / control-plane capability — and does not make LLM Workbench a model provider, an eval / LLM-as-judge harness, or a model-routing product (it performs none of those).

**Verifier behavior:**
- Do not fail a PR that adds or modifies the automated blog publisher (its workflow, generator script, RSS/source config, or tests) on the grounds of the "not a model provider" non-goal — that non-goal scopes `@llm-workbench/runtime`, not `apps/web` site-ops tooling.
- The publisher workflow must stay dormant by default (gated behind a repo variable) and must not commit a post that fails the blog front-matter schema or the CI gates.

---

## Authority and precedence

When agents encounter conflicts between this document and other files in the repository, the order of authority is:

1. **This PROJECT.md** (authoritative for intent, scope, non-goals, and the resolved open questions above).
2. **`README.md`** (authoritative for contributor conventions not covered here).
3. **`package.json`, schema files, CI config** (authoritative for the technical facts they encode, subject to corrections required by this document).
4. **Inline code comments** (lowest authority; must be corrected when they contradict the above).

Any PR that surfaces a conflict between these sources must resolve the conflict in the same PR, not defer it.
