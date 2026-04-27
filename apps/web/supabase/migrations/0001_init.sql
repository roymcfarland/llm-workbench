-- ----------------------------------------------------------------------------
-- LLM Workbench reference deployment — initial schema
--
-- SECURITY TRADE-OFF
-- ------------------
-- This reference uses the Supabase service-role key from server-side Next.js
-- code and gates access at the API layer (see `lib/auth/tenant.ts` and
-- `lib/supabase/runs-store.ts`). The service role bypasses Row Level
-- Security, so RLS here is mostly defense in depth: it stops a misconfigured
-- anon key from reading anything, but the real authorization boundary lives
-- in our Clerk-backed API routes.
--
-- For a production deployment you have two options:
--   1. Continue with service role + API-layer scoping (this app's choice).
--      Make sure every query path joins on `tenant_id`.
--   2. Drop the service role and issue Supabase JWTs from your auth provider
--      with a `tenant_id` claim, then keep the strict RLS policy below.
-- ----------------------------------------------------------------------------

create extension if not exists "pgcrypto";

create table if not exists public.runs (
  id            text primary key,
  tenant_id     text not null,
  workflow_id   text,
  status        text,
  started_at    timestamptz,
  ended_at      timestamptz,
  tags          text[],
  state         jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists runs_tenant_started_at_idx
  on public.runs (tenant_id, started_at desc);

-- Keep `updated_at` fresh on UPDATE / UPSERT.
create or replace function public.set_runs_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists runs_set_updated_at on public.runs;
create trigger runs_set_updated_at
  before update on public.runs
  for each row execute function public.set_runs_updated_at();

-- RLS is enabled but the service-role key bypasses it. The policy below is
-- the strict "if you ever switch to anon-key + JWT" version.
alter table public.runs enable row level security;

drop policy if exists "tenant_isolation" on public.runs;
create policy "tenant_isolation" on public.runs
  for all
  using (tenant_id = current_setting('request.jwt.claim.tenant_id', true))
  with check (tenant_id = current_setting('request.jwt.claim.tenant_id', true));
