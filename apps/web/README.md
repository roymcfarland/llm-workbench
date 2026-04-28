# `@llm-workbench/web`

The hosted reference deployment for [LLM Workbench](../../README.md). It is a
Next.js 16 (App Router) application that proves the
runtime works end-to-end against real infrastructure: Supabase for run
persistence, Clerk for auth, and Vercel AI Gateway for model calls via the AI
SDK v5.

This app is intentionally a **reference**, not a finished product. Expect to
fork it, swap providers, and harden the trade-offs flagged with `// SECURITY:`
comments in the source.

## Stack

- **Next.js 16** (App Router; Cache Components intentionally off for Clerk compatibility — see `next.config.mjs`)
- **Tailwind CSS v4** (CSS-first `@theme` config) + **shadcn/ui** primitives
- **Clerk** (`@clerk/nextjs`) for authentication and tenancy
- **Supabase** (`@supabase/supabase-js`) for the `runs` table
- **AI SDK v5** (`ai`) routed through **Vercel AI Gateway**
- **`@llm-workbench/runtime` / `@llm-workbench/ui`** consumed as workspace deps

## Routes

| Path                          | What it is                                                   |
| ----------------------------- | ------------------------------------------------------------ |
| `/`                           | Marketing landing page with a "Try the playground" CTA.      |
| `/sign-in`, `/sign-up`        | Clerk hosted flows.                                          |
| `/playground`                 | Live job-search workflow demo backed by AI Gateway.          |
| `/runs`                       | Saved runs for the current Clerk org/user.                   |
| `/runs/[runId]`               | Run detail: trace timeline, artifact viewer, gate panel.     |
| `GET /api/runs?limit=N`       | List runs for the caller's tenant (matches `HttpRunRepository.list`). |
| `GET/PUT/DELETE /api/runs/[runId]` | Single-run CRUD using the workbench wire format.        |
| `POST /api/llm`               | AI Gateway streaming proxy (demo).                           |

## Prerequisites

- Node.js **20+** (matches repo `engines` and CI)
- A Clerk application (publishable + secret key)
- A Supabase project (URL + service-role key)
- Vercel AI Gateway access (`AI_GATEWAY_API_KEY`, or OIDC if deployed on Vercel)

## Local setup

```bash
# 1. Install all workspace dependencies (run from the repo root)
npm install

# 2. Copy the env template and fill in real values
cp apps/web/.env.example apps/web/.env.local

# 3. Apply the database migration (see apps/web/supabase/README.md)
cd apps/web && supabase db push && cd -

# 4. Run the dev server
npm run dev:web
```

The app will be available at <http://localhost:3000>.

## Deploying

This app is designed to deploy on Vercel with zero modification.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/roymcfarland/llm-workbench&project-name=llm-workbench-reference&repository-name=llm-workbench-reference&env=NEXT_PUBLIC_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY,AI_GATEWAY_API_KEY,NEXT_PUBLIC_SITE_ORIGIN)

When deployed on Vercel, prefer OIDC-based auth for AI Gateway (`vercel env
pull` will inject `VERCEL_OIDC_TOKEN`) so you do not have to rotate
`AI_GATEWAY_API_KEY` manually.

### Deploy in 10 minutes

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
   via `cd ../..`). Paste env vars from [`.env.example`](./.env.example) into
   Project Settings → Environment Variables; set `NEXT_PUBLIC_SITE_ORIGIN` to
   your production URL. Optional: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`,
   `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CSP_EXTRA_CONNECT_SRC`
   (see root [`docs/HANDOFF.md`](../../docs/HANDOFF.md)).
6. **Deploy.** Push to `main` (or click Deploy). The first build typically
   takes a few minutes; CI on GitHub runs `build`, `test`, web `typecheck`,
   `lint`, and `build:web` (see `.github/workflows/ci.yml`).

> Cost expectation at design-partner volume: ~$0/month. Supabase free tier
> covers 500 MB Postgres + 2 GB egress; Clerk free tier covers 10 000 MAUs;
> Vercel hobby covers 100 GB of bandwidth. AI Gateway charges through to
> the underlying provider; budget for that separately.

## Security trade-offs (read these)

Every shortcut is annotated inline with `// SECURITY:` comments. The big ones:

- **Service-role Supabase key.** The server uses the service role and gates
  access by tenant in `lib/auth/tenant.ts`. RLS is enabled as defense in
  depth but is not the primary boundary. See
  [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)
  for the alternative.
- **Tenant key fallback.** When a Clerk user has no active org, we use
  `user:<userId>` as the tenant. That matches the personal-workspace model
  most demos want; multi-tenant production apps should require an org.
- **Body limit.** API routes cap PUT bodies at 25 MB. Large run states
  should be summarized or chunked before persistence.
