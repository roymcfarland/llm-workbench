# Closeout: weekly source-grounded blog auto-publisher

## Summary

Added dormant-by-default site-ops tooling for a weekly, source-grounded blog
publisher. The workflow fetches curated RSS sources, generates structured output
through the Vercel AI Gateway, validates the generated post against the existing
blog contract, and publishes only through a CI-gated auto-merged PR.

## Changes

- **`scripts/blog-sources.json`** — curated RSS feed list and tuning knobs.
- **`scripts/lib/blog-autopublish-core.mjs`** — pure slug, source selection,
  prompt, markdown assembly, and generated-post validation helpers.
- **`scripts/blog-autopublish.test.mjs`** — Vitest coverage for the pure core
  plus a schema tie-in to `apps/web/lib/blog/schema.ts`.
- **`scripts/blog-autopublish.mjs`** — fetch/generate/validate/write
  orchestrator with `publish`, `dry-run`, and `fetch-only` modes.
- **`.github/workflows/blog-autopublish.yml`** — weekly cron and manual dispatch,
  dormant behind `BLOG_AUTOPUBLISH_ENABLED`, with dry-run artifact support.
- **`.github/workflows/ci.yml`** — added `autopublish/**` push CI so bot PR
  required checks attach to the generated branch commit.
- **`docs/blog-autopublish.md`** — operator guide covering sources, grounding,
  validation, enablement, safe testing, schedule, publishing, and safety gates.
- **`package.json` / `package-lock.json`** — added `rss-parser` and
  `npm run blog:autopublish`.
- **`.gitignore`** — ignored the dry-run preview artifact.
- **`CHANGELOG.md`** — documented the weekly auto-publisher under Unreleased.
- **`CLOSEOUT.md`** — this slice closeout.

## Verification

- `npm install`
- `npm run test:scripts`
- `npm run audit:check`
- `node --check scripts/blog-autopublish.mjs`
- `node --check scripts/lib/blog-autopublish-core.mjs`
- `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/blog-autopublish.yml')); yaml.safe_load(open('.github/workflows/ci.yml')); print('workflows: valid YAML')"`
- `BLOG_MODE=fetch-only npm run blog:autopublish` when outbound network is
  available.

## Not in scope

No blog schema, blog loader, existing post, `packages/*`, release workflow, or
`PROJECT.md` changes.

## Post-merge live check

Before setting `BLOG_AUTOPUBLISH_ENABLED=true`, run the first real post through
`workflow_dispatch` in `dry-run` mode and eyeball the `blog-preview` artifact.
