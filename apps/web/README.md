# `@llm-workbench/web`

The hosted reference deployment for [LLM Workbench](../../README.md). It is a
Next.js 16 (App Router) application that proves the
runtime works end-to-end against real infrastructure: Supabase for run
persistence, Clerk for auth, and Vercel AI Gateway for model calls via the AI
SDK v7.

This app is intentionally a **reference**, not a finished product. Expect to
fork it, swap providers, and review the `SECURITY` notes in TypeScript comments
and the SQL migration, including the trade-offs below.

## Stack

- **Next.js 16 and React 19** (App Router; Cache Components intentionally off for Clerk compatibility — see [`next.config.mjs`](next.config.mjs))
- **Tailwind CSS v4** (CSS-first `@theme` config) + **shadcn/ui** primitives
- **Clerk** (`@clerk/nextjs`) for authentication and tenancy
- **Supabase** (`@supabase/supabase-js`) for the `runs` table
- **AI SDK v7** (`ai`) routed through **Vercel AI Gateway**
- **`@llm-workbench/runtime`**, **`@llm-workbench/ui`**, **`@llm-workbench/adapters-react`**, **`@llm-workbench/ai-sdk`**, **`@llm-workbench/mcp`** — workspace packages (`mcp` powers `/api/mcp`)

## Routes

### Product UI

| Path | What it is |
| --- | --- |
| `/` | Marketing landing page with an “Open the playground” CTA. |
| `/sign-in`, `/sign-up` | Embedded Clerk `<SignIn />` / `<SignUp />` pages (see `app/(auth)`). |
| `/playground` | Live job-search workflow demo backed by AI Gateway (**auth required**). |
| `/runs` | Saved runs for the current Clerk org/user. |
| `/runs/[runId]` | Run detail: trace timeline, artifact viewer, gate panel. |
| `/runs/demo` | **Public** read-only demo run (no sign-in). |
| `/blog` | Blog index (Markdown sources under `content/blog/`). |
| `/blog/[slug]` | Individual article (static paths from `.md` front matter). |
| `/blog/tags/[tag]` | Articles filtered by tag. |
| `/docs/getting-started` | Integration quickstart (**public**). |
| `/docs/architecture` | Package and reference-app architecture (**public**). |
| `/docs/api` | Generated package API reference (**public**). |
| `/docs/protocol` | Protocol overview (**public**). |
| `/faq` | Frequently asked questions (**public**). |

### HTTP APIs

| Path | What it is |
| --- | --- |
| `GET /api/health` | Liveness check (**public**). |
| `GET /api/runs?limit=N` | List runs for the caller’s tenant (`HttpRunRepository.list` shape). |
| `GET/PUT/DELETE /api/runs/[runId]` | Load, upsert, and delete a run in the caller's tenant using the workbench wire format. |
| `POST /api/llm` | Authenticated AI Gateway streaming proxy for the demo. |
| `GET/DELETE /api/mcp` | Stateless MCP transport operations. See the descriptor at `/.well-known/mcp.json` for discovery. |
| `POST /api/mcp` | MCP JSON-RPC (`initialize`, `ping`, `tools/list`, `prompts/list`, `resources/list`, `resources/templates/list`, `completion/complete`, and notifications are public; every `tools/call` requires auth — see handler). |
| `GET /api/openapi.json` | OpenAPI 3.1 for the run REST surface (**public**). |

### Discovery & feeds (machine-readable)

These are intentional entry points for crawlers, assistants, and integrations:

| Path | What it is |
| --- | --- |
| `/llms.txt` | Short LLM-oriented site summary + important links. |
| `/llms-full.txt` | Long-form narrative for model context. |
| `/agents.md` | Agent-oriented capability summary. |
| `/humans.txt` | Team credits and software stack. |
| `/robots.txt`, `/sitemap.xml` | Crawling hints + URL list. |
| `/.well-known/security.txt` | RFC 9116 security contact (GitHub private advisories). |
| `/.well-known/mcp.json` | MCP server descriptor. |
| `/feed.xml` | RSS 2.0 for blog posts. |

### Routing & security notes

- **Clerk + CSP** live in [`proxy.ts`](proxy.ts) (Next.js 16 proxy convention). Public routes that pass through the proxy include `/`, `/blog`, `/docs/*`, `/faq`, and `/runs/demo`; gated surfaces (`/playground`, `/runs`, `/api/runs`, …) require a session. Protected API routes return **401 JSON** when unauthenticated — they never redirect to HTML sign-in.
- **Proxy bypasses.** Paths containing a dot (including `/feed.xml` and `/api/openapi.json`) and `/api/health` skip `proxy.ts` entirely: no Clerk, CSP, or rate limit from the proxy. Unmatched dotted paths render the normal 404 because [`getSessionUserId()`](lib/auth/session.ts) returns `null` when `x-nonce` is absent.

## Prerequisites

- [Supported Node.js and npm setup](../../README.md#local-development)
- A Clerk application (publishable + secret key)
- A Supabase project (URL + service-role key)
- Vercel AI Gateway access (`AI_GATEWAY_API_KEY`, or OIDC if deployed on Vercel)

## Local setup

```bash
# Run from the repo root
npm ci
npm run build
```

Configure the [web app variables](../../README.md#web-app-environment) in
`apps/web/.env.local`, then follow the [Supabase setup](supabase/README.md) to
apply the migration. From the repo root, run `npm run dev:web` to start the
app at <http://localhost:3000>.

### Lighthouse (optional)

After installing and building the libraries from the repo root, run this
from `apps/web`:

```bash
npm run lighthouse:smoke
```

Builds production, serves `next start` briefly, audits `/`, and writes scores under `reports/` (gitignored). Requires Chromium for headless Chrome.

`LIGHTHOUSE_PORT` (default `47821`) and `LIGHTHOUSE_HOST` (default `localhost`) override where the script serves and audits.

## Deploying

This app is designed to deploy on Vercel after configuring the required services
and environment variables. Production requires Upstash for proxy-matched
`/api/*` routes: set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
(or `KV_REST_API_URL` + `KV_REST_API_TOKEN`), or explicitly opt out with
`RATE_LIMIT_ALLOW_UNCONFIGURED=1`. Without either, those routes return **503**;
`/api/health` and dotted paths such as `/api/openapi.json` bypass the proxy.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/roymcfarland/llm-workbench&project-name=llm-workbench-reference&repository-name=llm-workbench-reference&env=NEXT_PUBLIC_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY,AI_GATEWAY_API_KEY,NEXT_PUBLIC_SITE_ORIGIN,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN)

When deployed on Vercel, prefer OIDC-based auth for AI Gateway (`vercel env
pull` will inject `VERCEL_OIDC_TOKEN`) so you do not have to rotate
`AI_GATEWAY_API_KEY` manually.

### Deploy from a fork

The reference deployment is intentionally cheap (~$0/month at design-partner
volume on the Supabase / Clerk / Vercel free tiers). End-to-end:

1. **Fork or clone** this repository to your own GitHub account.
2. **Supabase.** Create a project at <https://supabase.com>. In the SQL
   editor, run the contents of
   [`apps/web/supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)
   (or `supabase db push` if you have the CLI linked). Copy the project URL
   and the `service_role` key from Project Settings → API.
3. **Clerk.** Create an application at <https://clerk.com>. Under Paths,
   set the sign-in path to `/sign-in` and the sign-up path to `/sign-up`.
   Copy the publishable key and secret key.
4. **Vercel AI Gateway.** Enable AI Gateway on the Vercel project (Settings
   → AI Gateway). When the project is deployed on Vercel, OIDC injects the
   gateway token automatically — you do **not** need `AI_GATEWAY_API_KEY`
   in production. Set it locally in `.env.local` only.
5. **Vercel.** Import the repo. Set **Root
   Directory** to `apps/web` so Vercel picks up
   [`vercel.json`](./vercel.json) (install + build run from the monorepo root
   via `cd ../..`). Add the [web app variables](../../README.md#web-app-environment)
   in Project Settings → Environment Variables, and set `NEXT_PUBLIC_SITE_ORIGIN` to
   your production URL. Optionally set `CSP_EXTRA_CONNECT_SRC`.
   Upstash is required in production for rate limiting on proxy-matched `/api/*` routes (excluding `/api/health` and dotted paths such as `/api/openapi.json`), via `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` or Marketplace `KV_REST_API_URL`/`KV_REST_API_TOKEN`, unless `RATE_LIMIT_ALLOW_UNCONFIGURED=1`.
6. **Deploy.** Click Deploy to create the initial deployment. With Git
   connected, open PRs for previews and merge into the configured production
   branch to deploy updates. See the [deployment runbook](DEPLOY.md) for the
   project settings and [CI workflow](../../.github/workflows/ci.yml) for
   the checks run separately by GitHub.

> Cost expectation at design-partner volume: ~$0/month. Supabase free tier
> covers 500 MB Postgres + 2 GB egress; Clerk free tier covers 10 000 MAUs;
> Vercel hobby covers 100 GB of bandwidth. AI Gateway charges through to
> the underlying provider; budget for that separately.

## Security trade-offs (read these)

`SECURITY` notes appear in `lib/supabase/server.ts`, `lib/runtime/server-actions.ts`, `lib/auth/tenant.ts` (JSDoc), and `supabase/migrations/0001_init.sql` (`-- SECURITY TRADE-OFF`). The big ones:

- **Service-role Supabase key.** The server uses the service role and gates
  access by tenant in `lib/auth/tenant.ts`. RLS is enabled as defense in
  depth but is not the primary boundary. See
  [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)
  for the alternative.
- **Tenant key fallback.** When a Clerk user has no active org, we use
  `user:<userId>` as the tenant. That matches the personal-workspace model
  most demos want; multi-tenant production apps should require an org.
- **Body limit.** The single-run PUT route caps the body at 25 MiB. Large run states
  should be summarized or chunked before persistence.
