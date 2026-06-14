# Closeout: mobile nav and FAQ page

## Summary

Added a small client-side mobile hamburger menu while keeping `SiteHeader` as a
server component. Added a public `/faq` route whose visible Q&A list and
`FAQPage` JSON-LD are generated from one shared FAQ array, then linked it from
the desktop nav and footer.

## Files Changed

- `apps/web/components/site-header.tsx`
- `apps/web/components/site-nav-mobile.tsx`
- `apps/web/app/faq/page.tsx`
- `apps/web/components/landing/site-footer.tsx`
- `CHANGELOG.md`
- `CLOSEOUT.md`

## Verification

- `git checkout main`, `git fetch --prune`, and `git pull --ff-only origin main`
  completed with `main` already up to date; branch created:
  `feat/mobile-nav-and-faq`.
- `npm run build` exits 0.
- `npm run typecheck -w @llm-workbench/web` exits 0.
- `npm run lint -w @llm-workbench/web` exits 0.
- `npm test -w @llm-workbench/web` exits 0: 12 files, 81 tests.
- `npm run ci` exits 0. The Next build route table includes `/faq`.
- `LLM_WB_E2E_DISABLE_DNS_SHIM=1 npm run test:e2e -w apps/web` first hit a
  sandbox-only `listen EPERM 0.0.0.0:3399`; rerunning the same command with
  escalation exits 0: 5 Chromium e2e tests passed.
- `npm run dev:web` starts on `http://localhost:3000`.
- Live dev-server `/faq` fetch validates:
  - H1 present.
  - 10 visible Q&A items.
  - Parsed `FAQPage` JSON-LD with 10 `mainEntity` questions.
  - First question: `What is LLM Workbench?`
  - Last question: `How do I try it?`
  - Final answer contains real `/runs/demo` and `/playground` links.
- Live dev-server home/header fetch validates:
  - mobile menu button is rendered with `aria-label="Open menu"`.
  - `aria-expanded="false"` on initial render.
  - Blog, Demo, Protocol, and FAQ links are present in the rendered chrome.

## Manual Browser Note

The Codex in-app Browser refused to open `http://localhost:3000` under its URL
policy, so a visual click-through at mobile width was not possible in this
session. I did not attempt to work around that browser policy with another
browser surface. The mobile menu implementation is still covered by typecheck,
lint, production build, static rendered-header checks, and code inspection for
the required handlers: link click, `Escape`, outside pointer, and
`aria-expanded`.
