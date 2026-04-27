# Supabase schema for the LLM Workbench reference app

The migration in `migrations/0001_init.sql` creates the single `runs` table
the reference app reads and writes through `HttpRunRepository`.

## One-time setup

```bash
# 1. Install the Supabase CLI: https://supabase.com/docs/guides/cli
# 2. Log in
supabase login

# 3. Link your local repo to a project (run from this directory)
supabase link --project-ref <your-project-ref>

# 4. Apply the migration to the linked project
supabase db push
```

Re-running `supabase db push` is safe — the migration uses `create … if not
exists` and `create or replace` patterns.

## Local development

If you prefer a local Postgres while you iterate, `supabase start` will give
you a local stack. Point the app at it by setting `NEXT_PUBLIC_SUPABASE_URL`
and `SUPABASE_SERVICE_ROLE_KEY` to the values printed by `supabase status`.

## Why the policy is mostly informational

This reference uses the Supabase service-role key from the Next.js server.
That key bypasses RLS, so the policy in the migration is defense in depth
rather than the primary access boundary — the real check lives in the
Clerk-backed API routes (`app/api/runs/**`). See the comment block at the
top of the migration for the alternative architecture (anon key + JWT
claim).
