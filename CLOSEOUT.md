# Closeout: remove dead GitHub links from the UI (private repo)

## Summary

The repository is private, so every clickable link to it 404s. Removed the five
user-facing GitHub links and the imports that became unused as a result:

- `site-footer.tsx` — the "GitHub" link and the "Security" link
  (`${GITHUB_URL}/blob/main/SECURITY.md`); dropped the `GITHUB_URL` import.
- `landing-final-cta.tsx` — the ghost "View on GitHub" button; dropped the import.
- `app/page.tsx` — the "Source" link in the hero meta line. **Import kept** — the
  JSON-LD `codeRepository` still uses `GITHUB_URL`.
- `app/docs/protocol/page.tsx` — the "Source on GitHub" chip; dropped the import.

The adjacent **Proprietary/LICENSE** link on the landing page and the footer
licensing links are licensing links, not GitHub links, and were left as-is per
the chosen scope ("all clickable GitHub links"). Non-clickable machine/SEO
references (`sameAs`, `codeRepository`, the `Source repository` lines in
`llms.txt` / `llms-full.txt` / `humans.txt` / `agents.md`) and the
`/.well-known/security.txt` contact are also intentionally left for a separate
pass (some need a replacement target, not just deletion).

## Files Changed

- `apps/web/components/landing/site-footer.tsx`
- `apps/web/components/landing/landing-final-cta.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/docs/protocol/page.tsx`
- `CHANGELOG.md`
- `CLOSEOUT.md`

## Verification

- `grep -rn "href=" apps/web --include="*.tsx" | grep GITHUB_URL` → no matches
  (no clickable GitHub links remain).
- `npm run typecheck -w @llm-workbench/web` exits 0; `npm run lint -w
  @llm-workbench/web` exits 0 (no unused imports — dropped exactly where
  `GITHUB_URL` went unused, kept in `page.tsx` where the JSON-LD still uses it).
- `npm run build:web` compiles successfully; all pages (`/`, `/docs/protocol`)
  still render.

## Notes

Markup-only removal; no logic touched. Follow-up candidates (not in this PR):
neutralize the machine/SEO `GITHUB_URL` refs, give `security.txt` a reachable
contact, and decide on the licensing/`COMMERCIAL.md` links — `GITHUB_URL` itself
is `github.com/llmworkbench/llm-workbench`, a different org than the real
`roymcfarland/llm-workbench`, so it reads like a placeholder.
