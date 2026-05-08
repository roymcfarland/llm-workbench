# Deploying `@llm-workbench/web`

A focused, copy-pasteable runbook for getting the hosted reference plane
into production on Vercel + Supabase + Clerk + Vercel AI Gateway.

> **TL;DR — one command instead of this checklist.** From the repo root,
> run `npm run bootstrap`. With `MCP=1` (or `--mcp`) it emits a plan file
> for a Cursor agent that has the Vercel + Supabase + Clerk MCP plugins
> available; otherwise it drives the public REST APIs using
> `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`, and `CLERK_API_KEY` from the
> environment. See `scripts/bootstrap.mjs` for flags. The manual
> checklist below remains authoritative for users without Node access or
> who want to understand what the script does.

> **License reminder.** This entire repository is **proprietary** software
> owned by Roy McFarland and Brightline Ltd. Use, modification, deployment,
> and operation are limited to Authorized Users (Roy McFarland personally
> and entities controlled by Roy McFarland) except by separate written
> agreement. See [`LICENSE`](../../LICENSE) and
> [`COMMERCIAL.md`](../../COMMERCIAL.md).

---

## 0. Prerequisites

| Tool                 | Why                                                  |
| -------------------- | ---------------------------------------------------- |
| Node **22+** (CI uses 22 & 24) | Build + runtime                               |
| `npm` 10+            | Workspace install                                    |
| `gh` CLI (optional)  | Linking the repo to Vercel via CLI                   |
| `vercel` CLI         | `npm i -g vercel`                                    |
| `supabase` CLI       | `brew install supabase/tap/supabase` (or equivalent) |
| A GitHub fork/branch | Vercel deploys from a Git remote                     |

Five accounts: GitHub, Vercel, Supabase, Clerk, and an org with Vercel
AI Gateway enabled (it's part of the standard Vercel offering as of 2026
— no extra signup beyond `vercel link`).

---

## 1. Supabase

1. Create a new project at <https://supabase.com/dashboard>.
   - **Region**: pick the same region you intend to deploy on Vercel.
   - **Database password**: store it in a password manager; you only
     need it for `supabase db push` from your laptop.
2. From **Project Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY`
3. Apply the schema. From the repo root:
   ```bash
   cd apps/web
   supabase link --project-ref <ref-from-dashboard-url>
   supabase db push
   ```
   This creates the `runs` table, the `tenant_id` index, and RLS policies
   defined in `supabase/migrations/0001_init.sql`.

> The reference app uses the `service_role` key on the server and
> enforces tenancy in application code (`lib/auth/tenant.ts`). RLS is
> enabled as defense in depth. If you'd prefer to authenticate Supabase
> calls as the end user, swap `lib/supabase/server.ts` to use the Clerk
> JWT template — see `supabase/README.md`.

---

## 2. Clerk

1. Create an application at <https://clerk.com/dashboard>.
2. Under **API Keys**, copy:
   - Publishable key → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - Secret key → `CLERK_SECRET_KEY`
3. Under **Paths**, set the reference app's expected paths so the hosted
   sign-in/up pages and post-auth redirects line up:
   - Sign-in path: `/sign-in`
   - Sign-up path: `/sign-up`
   - After-sign-in URL: `/playground`
   - After-sign-up URL: `/playground`
4. (Optional) Enable **Organizations** if you want true multi-tenant
   accounts. The reference app falls back to `user:<userId>` as the
   tenant when no organization is active.

---

## 3. Vercel AI Gateway

The Gateway proxies model calls from your deployment to OpenAI, Anthropic,
Google, etc., and gives you per-tenant usage tracking out of the box.

- **Local dev**: copy an `AI_GATEWAY_API_KEY` from
  <https://vercel.com/dashboard/ai/api-keys>. Put it in
  `apps/web/.env.local` as `AI_GATEWAY_API_KEY=vck_…`.
- **On Vercel**: prefer OIDC-based auth — the platform injects
  `VERCEL_OIDC_TOKEN` automatically and the Gateway honors it. You do
  *not* need to set `AI_GATEWAY_API_KEY` as a project env var when
  deployed.

---

## 4. Vercel project

```bash
# From the repo root, with the Vercel CLI installed and logged in:
vercel link                # choose the team/personal scope
vercel env pull apps/web/.env.local   # optional, after envs are set
```

In the Vercel dashboard:

1. **Build & Development Settings** — these MUST match exactly, or
   Vercel's framework detector will fail with `No Next.js version detected`:
   - Framework Preset: **Next.js**
   - Root Directory: **`apps/web`** (do **not** check "Include source
     files outside of the Root Directory" — `apps/web/vercel.json`
     already runs `npm install` from the repo root, which is what wires
     the workspaces).
   - Install Command: **leave blank** (defer to `apps/web/vercel.json`,
     which runs `cd ../.. && npm install --include-workspace-root --workspaces`).
   - Build Command: **leave blank** (defer to `apps/web/vercel.json`,
     which runs `cd ../.. && npm run build && npm run build:web`. The
     first half builds the five workspace packages — `runtime`, `ui`,
     `adapters-react`, `ai-sdk`, `mcp` — into their `dist/` directories;
     the second half runs `next build`. The workspace `dist/` outputs
     are gitignored, so this two-phase build is required even though
     `apps/web/package.json` declares the workspace packages as
     dependencies — npm symlinks them but never builds them on
     `install`.).
   - Output Directory: **leave blank** — Next.js default (`.next`)
     resolved relative to Root Directory works.
2. **Environment Variables** (Production + Preview):
   - `NEXT_PUBLIC_SITE_ORIGIN` — e.g. `https://workbench.your-domain.com`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/playground`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/playground`
   - `AI_GATEWAY_API_KEY` *(omit if using OIDC)*
   - **`GOOGLE_SITE_VERIFICATION`** / **`BING_SITE_VERIFICATION`** / **`YANDEX_SITE_VERIFICATION`** *(optional HTML-tag verification via `lib/site-verification.ts` — omit until you paste tokens from Search Console / Bing / Yandex)*
3. **Domains**: attach a real domain (or use the preview URL) and set
   `NEXT_PUBLIC_SITE_ORIGIN` to it before redeploying — sitemap.xml,
   robots.txt, llms.txt, and the OpenAPI `servers` block all derive
   absolute URLs from this var.
4. Click **Deploy**.

The first build will compile `@llm-workbench/runtime`, `…/ui`,
`…/adapters-react`, `…/ai-sdk`, `…/mcp`, then `apps/web`.

---

## 5. Smoke test the agentic surface

After deploy, the following should all return **HTTP 200** and be
discoverable without auth:

| URL                                         | What it is                              |
| ------------------------------------------- | --------------------------------------- |
| `/`                                         | Landing page                            |
| `/blog`                                     | Blog index                              |
| `/feed.xml`                                 | RSS feed for blog posts                 |
| `/docs/protocol`                            | Protocol overview                       |
| `/llms.txt`                                 | LLM-friendly site map                   |
| `/llms-full.txt`                            | Long-form description                   |
| `/agents.md`                                | Machine-readable agent surface          |
| `/robots.txt`                               | Crawler policy                          |
| `/sitemap.xml`                              | XML sitemap                             |
| `/.well-known/security.txt`                 | RFC 9116 security contact               |
| `/.well-known/mcp.json`                     | MCP server discovery                    |
| `/api/openapi.json`                         | OpenAPI 3.1 description of the run API  |
| `/runs/demo`                                | Public read-only demo run               |

Authenticated routes (`/playground`, `/runs`, `/api/runs`, `/api/llm`)
should redirect unauthenticated visitors to `/sign-in`. Public routes (`/blog`, `/feed.xml`, `/docs/protocol`, discovery URLs above) must stay **200** without auth.

### Local Lighthouse (optional)

From `apps/web` after `npm install`:

```bash
npm run lighthouse:smoke
```

This builds production, briefly runs `next start`, audits `/`, and writes `reports/LIGHTHOUSE.md` plus JSON (artifacts are gitignored by default). Requires a Chromium install compatible with Lighthouse.

---

## 6. Auto-provisioning via the Vercel Marketplace MCP plugins

> Optional — useful if you want the whole bootstrap driven by an agent.

The `vercel`, `supabase`, and `clerk` Vercel Marketplace integrations
expose MCP servers that an agent (Cursor, Claude Code, etc.) can call
to provision resources without you clicking through dashboards. After
running `vercel link`, the agent can:

- Create a Supabase project and inject its connection strings as project
  env vars.
- Create a Clerk application and provision its publishable/secret keys
  via the Marketplace.
- Add `AI_GATEWAY_API_KEY` (or rely on OIDC).

We document this so your bootstrap can be reduced to a single agent
prompt; the manual steps above remain authoritative.

---

## Optional: run-completion emails (Resend)

When you want users to receive an email each time one of their runs hits a
terminal status (`completed`, `failed`, `cancelled`), wire up Resend:

1. Sign in to <https://resend.com>, then **Domains → Add Domain** and add
   the domain you intend to send from (e.g. `your-domain.com`). Copy the
   DKIM/SPF/Return-Path records into your DNS provider and wait for the
   "Verified" badge — usually a few minutes. Resend rejects sends from
   unverified domains with HTTP 403.
2. **API Keys → Create API Key** with the **Sending access** scope and a
   restriction to the verified domain. Copy the `re_…` value.
3. In your Vercel project, add two environment variables for **Production
   and Preview** scopes:
   - `RESEND_API_KEY=re_…`
   - `RESEND_FROM=agent@your-domain.com` *(must be on the verified domain)*
4. Redeploy. The next run that transitions into a terminal status will
   trigger an email. You can confirm by tailing **Logs → Functions** for
   `[notifyRunCompletion]` events or by inspecting **Resend Dashboard →
   Logs**.

How it behaves:

- The send is fire-and-forget from the Supabase runs-store hot path, so a
  Resend outage cannot block a `PUT /api/runs/:id`.
- Each `(runId, status)` pair carries an idempotency key, so retried
  writes never deliver duplicate emails (Resend dedupes for 24 h).
- Tenant scoping uses the `user:<clerkUserId>` form. Org tenants are
  silently skipped at v0 — see the follow-up issue for org admin fan-out.

To disable the feature, **unset both env vars**. The runs-store logs an
`info`-level "skipping email send" line and proceeds. There is no warning
because un-configuration is the supported opt-out, not an error.

---

## 7. Operational tips

- **Body limits.** API routes cap PUT bodies at 25 MB. Large
  `RunStoreState` payloads should externalize artifacts before
  persistence — see `ArtifactStore` in `@llm-workbench/runtime`.
- **Custom artifact storage.** Wire any S3-compatible bucket (or Vercel
  Blob, Cloudflare R2, Supabase Storage) into a `ArtifactStore`
  implementation and pass it to `new WorkbenchRuntime({ artifactStore })`.
- **Observability.** Convert traces to OTLP via
  `traceEventsToOtelSpans()` and ship to Datadog / Honeycomb / Tempo.
- **Cost guardrails.** AI SDK calls go through the Gateway, which gives
  you per-tenant spend caps in the Vercel dashboard. Use them.

---

If this runbook is ever wrong, that's a bug — open an issue at
<https://github.com/roymcfarland/llm-workbench/issues>.
