# Closeout: footer copy and Brightline Labs rename

## Summary

Updated the web footer attribution copy and renamed the Brightline brand display
from `Brightline Ltd` to `Brightline Labs` across the shared constant and the
remaining hardcoded email-footer literal.

## Changes

- **`apps/web/lib/site.ts`** — changed `BRIGHTLINE_LABS_NAME` from
  `Brightline Ltd` to `Brightline Labs`; consumers such as the footer,
  `humans.txt`, and both OG image routes pick up the new display name through
  the shared constant.
- **`apps/web/components/landing/site-footer.tsx`** — changed the open-source
  attribution wording from "under" to "at" and the bottom attribution prefix
  from "Attribution:" to "From".
- **`apps/web/emails/run-completion.tsx`** — updated the hardcoded email-footer
  brand literal from `Brightline Ltd` to `Brightline Labs`.
- **`CHANGELOG.md`** — documented the footer copy and Brightline Labs rename
  under Unreleased.

## Verification

- `npm run typecheck -w @llm-workbench/web`
- `npm run lint -w @llm-workbench/web`
- `npm run build:web`
- `grep -rn "Brightline Ltd" apps/web --include="*.ts" --include="*.tsx"`
- `curl -s localhost:3000/robots.txt | grep -i sitemap`

## Not in scope

- No change to `app/robots.txt/route.ts`; it already serves the complete
  `robots.txt`.
- No `sitemap.ts` changes.
- No changes to OG-markup or `humans.txt`; their output updates via the
  `BRIGHTLINE_LABS_NAME` constant.
