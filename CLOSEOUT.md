# Closeout: open-source-ify the reference web app (MIT framing + restore GitHub links)

## Summary

Part of the go-live bundle. Purges proprietary framing from the public-facing
reference app and restores the GitHub links #39 removed, so that when the repo
goes public the site is consistent and truthful (MIT, source on GitHub, packages
on npm). **Must merge at go-live, not before** — the restored GitHub links point
at the repo and the copy claims "open source on npm", both of which only become
true when the repo is public and the packages are published.

## Changes (14 files)

- **`apps/web/lib/site.ts`** — `GITHUB_URL` `llmworkbench` → `roymcfarland`;
  `LICENSE_NAME` `Proprietary` → `MIT`; removed `COMMERCIAL_URL`; added `NPM_ORG_URL`.
- **Restored #39's GitHub links** — footer "GitHub" + "Security", landing-page
  "Source", final-CTA "View on GitHub", protocol-docs "Source on GitHub" chip
  (re-added the `GITHUB_URL` imports they dropped).
- **License copy → MIT** — footer licensing paragraph (dropped the commercial
  link), landing JSON-LD "What is the license?" answer, `llms.txt`,
  `llms-full.txt`, `agents.md`, `humans.txt`, OpenAPI `license` object, FAQ
  "Is it open source?" answer, run-completion email footer, `DEPLOY.md` banner.
- **Retired `COMMERCIAL.md`** and removed every reference to it.

## Verification

- `npm run typecheck -w @llm-workbench/web` ✓, `npm run lint -w @llm-workbench/web` ✓.
- `npm test -w @llm-workbench/web` → 84 passed (no snapshot asserted old copy).
- `npm run build:web` → compiled successfully.
- Repo-wide sweep: no `proprietary` / "Authorized Users" / `COMMERCIAL_URL` /
  noncommercial copy remains in `apps/web` (excluding tests/generated).

## Not in scope (separate slices)

- `LicenseRef-Proprietary` SPDX headers across `scripts/*` + the validator
  generator — a small internal-hygiene sweep (follow-up).
- The launch announcement blog post (#2) — go-live content.

## Human review gate (visual / go-live)

Verify on the PR's Vercel preview before merge: footer + landing license copy,
the restored GitHub links resolve to `github.com/roymcfarland/llm-workbench`
(they'll 404 until the repo is public — expected; this PR merges at go-live),
and `/llms.txt` · `/agents.md` · `/api/openapi.json` show MIT.
