# Deploying `@llm-workbench/web`

A focused, copy-pasteable runbook for getting the hosted reference plane
into production on Vercel + Supabase + Clerk + Vercel AI Gateway.

> From the repo root, run `npm run bootstrap -- --mcp` to generate a plan
> for an agent with the Vercel, Supabase, and Clerk MCP plugins. The `MCP`
> environment switch also selects plan mode. In REST mode, `npm run bootstrap`
> provisions the services for which you supply `VERCEL_TOKEN`,
> `SUPABASE_ACCESS_TOKEN`, or `CLERK_API_KEY` in your local shell. Supply at
> least one. Run `npm run bootstrap -- --help` to list flags, or see
> [`scripts/bootstrap.mjs`](../../scripts/bootstrap.mjs). The manual checklist
> below covers the corresponding dashboard setup.

> **License.** This repository is open source under the **MIT License** — free
> to use, modify, and distribute, including commercially. See [`LICENSE`](../../LICENSE).

---

## 0. Prerequisites

| Tool                 | Why                                                  |
| -------------------- | ---------------------------------------------------- |
| [Supported Node.js and bundled npm](../../README.md#local-development) | Build, runtime, and workspace install |
| `vercel` CLI         | `npm i -g vercel`                                    |
| `supabase` CLI       | `brew install supabase/tap/supabase` (or equivalent) |
| A GitHub fork/branch | Vercel deploys from a Git remote                     |

Use GitHub, Vercel, Supabase, and Clerk accounts. AI Gateway access is
available to Vercel teams. For model calls from your local machine, see
[AI Gateway authentication](#3-vercel-ai-gateway).

### Plans and costs

Plan details as of 2026-11 are available from the providers. Check eligible
models, quotas, and any paid usage before choosing a plan.

- Hosting and model calls ([Vercel pricing](https://vercel.com/pricing),
  [AI Gateway pricing](https://vercel.com/docs/ai-gateway/pricing)).
- Database ([Supabase pricing](https://supabase.com/pricing)).
- Authentication ([Clerk pricing](https://clerk.com/pricing)).
- Redis rate limiting ([Upstash Redis pricing](https://upstash.com/pricing/redis)).
- Optional run-completion email ([Resend pricing](https://resend.com/pricing)).

---

## 1. Supabase

1. Create a new project at <https://supabase.com/dashboard>.
   - **Region**: pick the same region you intend to deploy on Vercel.
   - **Database password**: store it in a password manager; you only
     need it for `supabase db push` from your laptop.
2. From the project’s [API settings](https://supabase.com/docs/guides/getting-started/api-keys), copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - Legacy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
3. Apply the schema. From the repo root:
   ```bash
   cd apps/web
   supabase init
   supabase link --project-ref <ref-from-dashboard-url>
   supabase db push
   ```
   This creates the `runs` table, the `tenant_id` index, and RLS policies
   defined in `supabase/migrations/0001_init.sql`.

> The reference app uses the `service_role` key on the server and
> enforces tenancy in application code (`lib/auth/tenant.ts`). RLS is
> enabled as defense in depth. If you'd prefer to authenticate Supabase
> calls as the end user, use Supabase's
> [Clerk third-party auth integration](https://supabase.com/docs/guides/auth/third-party/clerk)
> with an end-user client and tenant-aware RLS policies. See the
> [schema guide](supabase/README.md) for the reference app's tenancy model.

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

### Sign-in methods: GitHub, Vercel, and email code

The hosted sign-in/up pages render Clerk's prebuilt `<SignIn />` / `<SignUp />`
components, which surface the sign-in methods configured in the Clerk Dashboard. On a **production** Clerk instance, social connections require your own
OAuth credentials (Clerk's shared development credentials are dev-only).

**GitHub (social sign-in).**

1. Clerk Dashboard → **SSO Connections** → **Add connection** → **For all users** → **GitHub**.
2. Enable **Use custom credentials** and **Enable for sign-up and sign-in**.
   Select the app type and copy Clerk's **Authorization Callback URL**.
3. Set up the matching GitHub OAuth App or GitHub App, using that URL as the
   callback. Add the Client ID and Client Secret to the Clerk connection and
   save. Follow [Clerk's GitHub setup guide](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/github)
   for the fields required by each app type.

**Vercel (social sign-in).** "Sign in with Vercel" is a first-class Clerk social
connection.

1. Clerk Dashboard → **SSO Connections** → **Add connection** → **For all users** → **Vercel**.
2. Enable **Use custom credentials** and copy Clerk's **Authorization Callback URL**.
3. Create a Vercel App, add the callback URL, and enable the `openid`, `email`,
   `profile`, and `offline_access` scopes. Configure client authentication
   and generate a client secret. See
   [Clerk's Vercel setup guide](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/vercel)
   and [Vercel's app settings guide](https://vercel.com/docs/sign-in-with-vercel/manage-from-dashboard).
4. Copy Vercel's **Client ID** and **Client Secret** into Clerk's Vercel connection.
   Ensure **Enable for sign-up and sign-in** is on, then save.

**Email verification code.**

1. Clerk Dashboard → **User & Authentication → Email, Phone, Username**.
2. Enable **Email address** as an identifier and select
   [**Email verification code**](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options#email)
   as the verification method.
3. For a passwordless flow, you may also disable **Password** in the same section.

No `apps/web` code changes and no new environment variables are needed — the
prebuilt Clerk components surface these methods as soon as they are enabled in the
dashboard.

---

## 3. Vercel AI Gateway

The Gateway proxies model calls from your deployment to providers such as
OpenAI, Anthropic, and Google. To attribute Gateway usage to a tenant, the
host can pass an identifier through `providerOptions.gateway.user` or
`providerOptions.gateway.tags`. The reference app leaves those options
unset. See [AI Gateway custom reporting](https://vercel.com/docs/ai-gateway/observability-and-spend/custom-reporting).

- **Local dev**: copy an `AI_GATEWAY_API_KEY` from
  <https://vercel.com/dashboard/ai/api-keys>. Set `AI_GATEWAY_API_KEY` in
  `apps/web/.env.local`.
- **On Vercel**: prefer OIDC-based auth — the platform injects
  `VERCEL_OIDC_TOKEN` automatically and the Gateway honors it. You do
  *not* need to set `AI_GATEWAY_API_KEY` as a project env var when
  deployed with OIDC enabled. See
  [AI Gateway authentication](https://vercel.com/docs/ai-gateway/authentication-and-byok).

---

## 4. Vercel project

```bash
# From the repo root, with the Vercel CLI installed and logged in:
vercel link                # choose the team/personal scope
vercel env pull apps/web/.env.local   # optional, after envs are set
```

In the Vercel dashboard:

1. In **Build & Development Settings**, use these settings.
   - Framework Preset: **Next.js**
   - Root Directory: **`apps/web`**. Enable **Include source files outside
     of the Root Directory in the Build Step** to make the root lockfile and
     sibling workspaces available to [`vercel.json`](vercel.json).
     See the [Vercel monorepo guide](https://vercel.com/docs/monorepos/monorepo-faq).
   - Install Command: **leave blank** (defer to `apps/web/vercel.json`,
     which runs `cd ../.. && npm install --include-workspace-root --workspaces`).
   - Build Command: **leave blank** (defer to `apps/web/vercel.json`,
     which runs `cd ../.. && npm run build && npm run build:web`. The
     first half builds the five workspace packages — `runtime`, `ui`,
     `adapters-react`, `ai-sdk`, `mcp` — into their `dist/` directories;
     the second half generates the API reference and runs `next build`. The workspace `dist/` outputs
     are gitignored, so this two-phase build is required even though
     `apps/web/package.json` declares the workspace packages as
     dependencies — npm symlinks them but never builds them on
     installation).
   - Output Directory: **leave blank** — Next.js default (`.next`)
     resolved relative to Root Directory works.
2. Set the [web app environment variables](../../README.md#web-app-environment)
   for **Production** and **Preview** as appropriate. Production builds
   require configured Redis for proxy-matched API requests unless
   `RATE_LIMIT_ALLOW_UNCONFIGURED` explicitly permits requests without it.
3. **Domains**: attach a real domain (or use the preview URL) and set
   `NEXT_PUBLIC_SITE_ORIGIN` to it before redeploying. This sets `metadataBase`
   and the fallback origin for `siteOrigin()`. For sitemap.xml, robots.txt,
   llms.txt, and the OpenAPI `servers` block, `siteOrigin()` prefers the
   request's `x-forwarded-host` (then `host`) and `x-forwarded-proto` (defaulting
   to HTTP in development and HTTPS otherwise); only without a request host
   does it use the env var, then `DEFAULT_ORIGIN`.
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

Authenticated page routes (`/playground`, `/runs`) redirect unauthenticated visitors to `/sign-in`; protected API routes (`/api/runs`, `/api/llm`) return JSON **401**.
Public routes (`/blog`, `/feed.xml`, `/docs/protocol`, discovery URLs above) must stay **200** without auth. `/api/mcp` is public for discovery, with authentication enforced on each tool call.

### Local Lighthouse (optional)

From `apps/web` after installing and building the workspace libraries:

```bash
npm run lighthouse:smoke
```

This builds production, briefly runs `next start`, audits `/`, and writes `reports/LIGHTHOUSE.md` plus JSON (artifacts are gitignored by default). Requires a Chromium install compatible with Lighthouse.

`LIGHTHOUSE_PORT` (default `47821`) and `LIGHTHOUSE_HOST` (default `localhost`) override where the script serves and audits.

---

## 6. Provisioning with vendor MCP servers

> Optional — useful if you want the whole bootstrap driven by an agent.

The [Vercel](https://vercel.com/docs/agent-resources/vercel-mcp),
[Supabase](https://supabase.com/docs/guides/ai-tools/mcp), and
[Clerk](https://clerk.com/docs/guides/ai/mcp/clerk-mcp-server) MCP servers
can assist with the bootstrap plan. Supabase and Clerk document tools for
creating projects and applications, respectively, subject to the connection's
permissions. Clerk's MCP server does not return instance secret keys. Follow
the manual steps above for application keys and any configuration your MCP
client cannot complete.

---

## Optional: run-completion emails (Resend)

When you want users to receive an email each time one of their runs hits a
terminal status (`completed`, `failed`, `cancelled`), wire up Resend:

1. Sign in to <https://resend.com>, then **Domains → Add Domain** and add
   the domain you intend to send from (e.g. `your-domain.com`). Copy the
   DKIM/SPF/Return-Path records into your DNS provider and wait for the
   "Verified" badge. Resend rejects sends from unverified domains with
   HTTP 403. See [verified domains](https://resend.com/docs/dashboard/domains/introduction)
   and [API errors](https://resend.com/docs/api-reference/errors).
2. **API Keys → Create API Key** with the **Sending access** scope and a
   restriction to the verified domain. Copy the resulting key.
3. In your Vercel project, add two environment variables for **Production
   and Preview** scopes:
   - `RESEND_API_KEY`
   - `RESEND_FROM` *(a sender address on the verified domain)*
4. Redeploy. The next run that transitions into a terminal status will
   trigger an email. You can confirm by tailing **Logs → Functions** for
   `[notifyRunCompletion]` events or by inspecting **Resend Dashboard →
   Logs**.

How it behaves:

- The send is fire-and-forget from the Supabase runs-store hot path, so a
  Resend outage cannot block a `PUT /api/runs/:id`.
- Each `(runId, status)` pair carries an idempotency key. Resend deduplicates
  send requests using the same key within its
  [24-hour window](https://resend.com/docs/dashboard/emails/idempotency-keys).
- Tenant scoping uses the `user:<clerkUserId>` form. Org tenants are skipped at v0
  (`skipped-org-tenant`); fanning out to org admins is not yet tracked.

To disable the feature, **unset both env vars**. The runs-store logs an
`info`-level "skipping email send" line and proceeds. There is no warning
because un-configuration is the supported opt-out, not an error.

---

## 7. Operational tips

- **Body limits.** The single-run PUT handler checks the declared body size
  against 25 MiB and also checks the decoded text length against the same
  numeric threshold. On the hosted deployment, Vercel Functions enforce
  their own [request-body limit](https://vercel.com/docs/functions/limitations#request-body-size)
  of 4.5 MB before the handler can accept larger uploads. Externalize
  artifacts before persisting large `RunStoreState` payloads. See
  `ArtifactStore` in `@llm-workbench/runtime`.
- **Custom artifact storage.** Wire any S3-compatible bucket (or Vercel
  Blob, Cloudflare R2, Supabase Storage) into a `ArtifactStore`
  implementation and pass it to `new WorkbenchRuntime({ artifactStore })`.
- **Observability.** Use `traceEventsToOtelSpans()` to map trace events to
  OpenTelemetry span records for export through your own telemetry pipeline.
- **Cost guardrails.** AI SDK calls go through the Gateway. In the Vercel
  dashboard, team budgets cover the team and project budgets cover calls made
  with the project's OIDC tokens or project-scoped API keys. Those scopes
  apply independently of the app's Clerk tenants.
  See [AI Gateway budgets](https://vercel.com/docs/ai-gateway/observability-and-spend/budgets).

---

If this runbook is ever wrong, that's a bug — open an issue at
<https://github.com/roymcfarland/llm-workbench/issues>.
