# Engineering handoff — LLM Workbench

This document orients the **next engineer or coding agent** taking over after
the reference deployment started shipping. It complements the product README
and `apps/web/README.md` with operational detail and a prioritized backlog.

## 1. What you are inheriting

- **OSS core:** `@llm-workbench/runtime`, `adapters-react`, `ai-sdk`, `ui`,
  `mcp` — Apache 2.0, versioned together (e.g. `0.2.0` on npm / workspace).
- **Product surface:** `apps/web` — Next.js 16 App Router, PolyForm
  Noncommercial license. This is the hosted **reference** deployment: Clerk,
  Supabase (service role + API-layer tenancy), Vercel AI Gateway, optional
  Sentry, optional Upstash-backed API rate limits, strict CSP in middleware.
- **CI:** `.github/workflows/ci.yml` runs on `main` and PRs: `npm ci` → package
  `build` → workspace `test` → web `typecheck` → web `lint` → `build:web`
  (Node 20 and 22 matrix).

Local parity with CI:

```bash
npm run ci
```

## 2. Repository map

| Path | Role |
|------|------|
| `packages/runtime` | Headless run state, traces, gates, bundles, persistence ports |
| `packages/adapters-react`, `packages/ui` | React integration and workbench UI primitives |
| `packages/ai-sdk` | AI SDK v5 wrappers + trace events |
| `packages/mcp` | MCP server construction; HTTP handler |
| `apps/web` | Next app: marketing, playground, runs UI, REST + MCP routes |
| `examples/*` | Demos consuming the runtime |
| `scripts/` | Bootstrap and shared test config |

**Dependency direction:** `apps/web` depends on workspace packages via
`transpilePackages` in `next.config.mjs` (TypeScript sources, no pre-publish
build required for local dev).

## 3. `apps/web` — runtime mental model

1. **Auth:** Clerk (`middleware.ts`). Public routes include `/`, docs, discovery
   (`/llms.txt`, `/api/openapi.json`, `/.well-known/*`, `/api/mcp` for JSON-RPC
   entry). Everything else is session-gated; **API** routes return JSON `401`,
   not redirects.
2. **Tenancy:** `lib/auth/tenant.ts` — `requireTenant()` maps Clerk session to
   `tenantId` (`orgId` or `user:<userId>`). **Every** path that reads/writes
   runs must call this first. Supabase uses the **service role**; RLS is
   defense-in-depth, not the primary boundary (see migration + `SECURITY:`
   comments in `lib/supabase/runs-store.ts`).
3. **Persistence:** Supabase `runs` table; wire format matches runtime
   serialization. Migration: `apps/web/supabase/migrations/0001_init.sql`.
4. **LLM traffic:** `POST /api/llm` proxies streaming calls (AI Gateway); body
   size capped; `runId` validated with `lib/validation/run-id.ts` when tracing
   into a run.
5. **MCP:** `apps/web/app/api/mcp/route.ts` — discovery methods are public;
   mutating RPC requires auth. POST body capped (DoS guard). Reference tools
   include job-search workflow wiring.
6. **Errors:** `lib/server/internal-error.ts` — production responses avoid
   leaking internal messages; `Sentry.captureException` when DSN is set.

## 4. Deploying (Vercel)

1. **Root Directory:** `apps/web` (so `apps/web/vercel.json` applies).
2. `vercel.json` runs `cd ../.. && npm install …` and
   `npm run build && npm run build:web` from the monorepo root.
3. Set env vars from `apps/web/.env.example`. Minimum: Supabase URL + service
   role, Clerk keys, `NEXT_PUBLIC_SITE_ORIGIN`, AI Gateway (OIDC on Vercel or
   `AI_GATEWAY_API_KEY` locally).
4. Optional ops: **Sentry** (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`),
   **Upstash** (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) for Edge
   rate limits, **`CSP_EXTRA_CONNECT_SRC`** if you add new third-party connect
   targets.

## 5. Security posture (high level)

| Layer | Mechanism |
|--------|-----------|
| Transport | HSTS + baseline headers in `next.config.mjs`; **CSP** on middleware responses (`lib/security/csp.ts`) |
| AuthN/Z | Clerk + `requireTenant()` + middleware route classes |
| Abuse | Optional Upstash sliding windows (`lib/rate-limit/edge.ts`) on `/api/*` |
| Errors | Sanitized JSON errors in prod; Sentry for triage |
| Pointers | Inline `// SECURITY:` where trade-offs are intentional |

**Do not** expose service-role keys to the client or skip tenant checks on new
routes.

## 6. Linting and Next.js 16

`next lint` was **removed** from the Next CLI in v16. The web app uses **ESLint 9**
with `eslint.config.mjs` extending `eslint-config-next/core-web-vitals`. Strict
`eslint-plugin-react-hooks` rules that conflict with **R3F** (`useFrame` camera
mutation) and common **next-themes** mount patterns are turned off in config;
particle RNG in `hero-atmosphere.tsx` uses a **deterministic** hash so
`react-hooks/purity` stays clean.

## 7. Tests

- Packages: Vitest per package (`npm test` at root chains them + web + scripts).
- `apps/web`: minimal Vitest footprint today (`passWithNoTests`). **Gap:**
  add route-level integration tests or Playwright smoke against `/api/health`,
  sign-in flow, and playground when you harden releases.

## 8. Suggested next milestones (prioritized)

Use this as a punch list; reorder based on product bets.

1. **Observability:** Confirm Sentry projects, releases, and source maps on
   Vercel; add uptime check against `/api/health`.
2. **Rate limits:** Enable Upstash in production; tune limits per route; add
   `429` handling in playground client.
3. **Multi-tenant hardening:** Optional org-required mode for production
   tenants; audit MCP tool auth matrix if you expose new tools.
4. **Database:** Migration workflow documented in CI (e.g. `supabase db push`
   in a guarded job); consider read replicas or caching only after measuring.
5. **E2E tests:** Playwright (or `next/experimental-test`) for critical paths;
   keep CI under ~10 minutes.
6. **Product:** Roadmap items from stakeholder context (e.g. Supabase MCP
   auto-provision, billing, org analytics) — capture in GitHub Issues with
   acceptance criteria.

## 9. Conventions for agents and humans

- Prefer small PRs; match existing formatting and `// SECURITY:` annotation
  style when touching auth or persistence.
- Do not commit secrets; use `apps/web/.env.local` (gitignored).
- When adding outbound `fetch` / WebSocket hosts, update **CSP**
   (`lib/security/csp.ts` or `CSP_EXTRA_CONNECT_SRC`).
- After dependency bumps on `apps/web`, run `npm run ci` before merge.

## 10. Quick reference — important files

- `apps/web/middleware.ts` — Clerk, CSP on responses, rate limit hook
- `apps/web/instrumentation.ts` — Sentry registration + `onRequestError`
- `apps/web/lib/auth/tenant.ts` — tenancy guard
- `apps/web/lib/supabase/runs-store.ts` — persistence + Resend hooks
- `apps/web/app/api/mcp/route.ts` — MCP HTTP + auth gating
- `.github/workflows/ci.yml` — build/test/typecheck/lint/web build

---

**Welcome aboard.** Ship in small steps, keep CI green, and extend this file when
you discover undocumented invariants worth preserving.
