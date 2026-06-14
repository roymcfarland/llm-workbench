# Closeout: four blog posts

## Summary

Added four Markdown blog posts under `apps/web/content/blog`, dated across the
gap since the previous post (2026-05-12 → 2026-06-13) for a steady publishing
cadence:

- `anatomy-of-a-run-bundle.md` (2026-05-12) — protocol / run-bundle deep dive.
- `why-our-demo-runs-a-delorean.md` (2026-05-21) — why the public demo runs
  beloved-story scenarios on the real engine.
- `hunting-unsafe-eval.md` (2026-06-02) — removing `'unsafe-eval'` from the
  production CSP via precompiled Ajv validators.
- `shipping-log-june-2026.md` (2026-06-13) — a what's-new recap; links
  internally to `/blog/hunting-unsafe-eval`.

No application code changed. Slugs derive from filenames, so the recap's
internal `/blog/hunting-unsafe-eval` link resolves to the unsafe-eval post.

## Files Changed

- `apps/web/content/blog/anatomy-of-a-run-bundle.md` (new)
- `apps/web/content/blog/why-our-demo-runs-a-delorean.md` (new)
- `apps/web/content/blog/hunting-unsafe-eval.md` (new)
- `apps/web/content/blog/shipping-log-june-2026.md` (new)
- `CHANGELOG.md`
- `CLOSEOUT.md`

## Verification

- `npm test -w @llm-workbench/web` exits 0: 12 files, 81 tests. The blog index
  tests validate every post's front matter (zod), headings (h2–h4), and
  rendered HTML across all 13 posts.
- `npm run build:web` compiles successfully; static generation runs 64/64
  (includes each new post's OG/Twitter image routes via `generateStaticParams`,
  so the build exercises every new post's front matter).
- `npm run ci` exits 0 (root build, all workspace tests, typecheck, lint,
  build:web).
- `apps/web/content/blog` now holds 13 `.md` files (9 prior + 4 new). `/blog`
  is server-rendered and lists posts newest-first, so the four interleave by
  date; `/blog/[slug]` resolves each, including `hunting-unsafe-eval`.

## Notes

Markdown-only content slice. No middleware/allowlist change needed — `/blog`
and `/blog/(.*)` are already public routes. Publication dates are intentionally
spread across the May–June window rather than all stamped "today".
