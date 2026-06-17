# Closeout: seed genuine demo runs for the public run counter

## Summary

Added a maintainer-only script that can seed Supabase `runs` with genuine demo
run bundles built by the runtime from the existing public landing scenarios.
The default path is a credential-free dry-run so the bundle generation and
summary can be verified locally before any production write.

## Changes

- **`apps/web/scripts/seed-demo-runs.mts`** — exports `buildSeedRows({ count,
  now })`, rotates through the five public scenarios, builds each bundle through
  `WorkbenchRuntime`, serializes the runtime state inline, and exposes a CLI
  with dry-run summary, `--apply` upsert, and `--clean`.
- **`apps/web/scripts/seed-demo-runs.test.ts`** — validates the pure planner
  shape, stable IDs, tenant/status, descending timestamps, and serialized run
  shape without snapshotting non-deterministic runtime content.
- **`apps/web/package.json`** — adds `npm run seed:demo-runs -w
  @llm-workbench/web`.
- **`CHANGELOG.md` / `CLOSEOUT.md`** — ledger.

## Verification

- `npm run typecheck -w @llm-workbench/web`
- `npm run lint -w @llm-workbench/web`
- `npm test -w @llm-workbench/web`
- `npm run seed:demo-runs -w @llm-workbench/web`

## Not-in-scope / safety

- Dry-run is the default and does not require Supabase credentials or query the
  network.
- Production writes require `--apply` plus `NEXT_PUBLIC_SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY`.
- Seeding is idempotent: rows use stable `seed-demo-*` IDs and upsert on `id`.
- Cleanup is targeted and reversible via `--clean`, scoped to
  `tenant_id = "seed-demo"`.
- The actual production write is a manual maintainer step, expected to be
  preceded by a dry-run check.
