# Supabase schema for the LLM Workbench reference app

The [initial migration](migrations/0001_init.sql) creates the `runs` table.
The web app's server-side Supabase store reads and writes it. Clients using
`HttpRunRepository` connect through the [web app's HTTP API](../README.md#http-apis).

## One-time setup

```bash
# 1. Install the Supabase CLI: https://supabase.com/docs/guides/cli
# 2. Log in
supabase login

# 3. Initialize the CLI config once, then link your project
cd apps/web
supabase init
supabase link --project-ref <ref-from-dashboard-url>

# 4. Apply the migration to the linked project
supabase db push
```

`supabase db push` tracks applied migrations and applies pending ones. The
repository tracks the SQL migration; `supabase init` generates the CLI config.

## Local development

For local Postgres, run `supabase init` once from `apps/web`, then run
`supabase start` with a Docker-compatible container runtime running.
See the [Supabase CLI setup](https://supabase.com/docs/guides/local-development/cli/getting-started). Point the app at it by setting `NEXT_PUBLIC_SUPABASE_URL`
and `SUPABASE_SERVICE_ROLE_KEY` to the values printed by `supabase status`.

## Why the policy is mostly informational

This reference uses the Supabase service-role key from the Next.js server.
That key bypasses RLS, so the policy in the migration is defense in depth
rather than the primary access boundary — the real check lives in the
Clerk-backed API routes (`app/api/runs/**`). See the comment block at the
top of the migration for the alternative architecture (anon key + JWT
claim).
