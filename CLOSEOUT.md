# Closeout: allow Clerk custom Frontend API domain in the CSP

## Summary

Production sign-in could not render the GitHub/Google buttons. Root cause: the
production Clerk instance uses a **custom Frontend API domain**
(`clerk.llmworkbench.io`), but the CSP only allowed `*.clerk.com` /
`*.clerk.accounts.dev`. The strict production CSP therefore blocked the
browser's fetch to `clerk.llmworkbench.io/v1/environment` (the request that
lists enabled social providers), so the social buttons never appeared.

Fix: `csp.ts` now derives the Clerk Frontend API host from the publishable key
(`pk_(test|live)_<base64("<host>$")>`) and allows it in `connect-src` (https +
wss), `script-src`, and `frame-src`. This covers both dev instances
(`*.clerk.accounts.dev`, already wildcarded) and the prod custom domain. The
host is validated against a strict hostname regex; absent/invalid keys add
nothing (existing behavior unchanged).

## Files Changed

- `apps/web/lib/security/csp.ts`
- `apps/web/lib/security/csp.test.ts`
- `CHANGELOG.md`
- `CLOSEOUT.md`

## Verification

- `npm test -w @llm-workbench/web` (csp.test.ts) — new tests assert the derived
  `https://clerk.llmworkbench.io` + `wss://...` appear in connect/script/frame
  when a `pk_live` key is set, and that nothing is added when the key is absent.
  `loadCsp` now stubs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""` by default so the
  exact-string script-src assertions stay deterministic.
- `npm run ci` exits 0 (build, all workspace tests, typecheck, lint, build:web).
- Diagnosis evidence: prod `/v1/environment` shows `oauth_github` + `oauth_google`
  ENABLED; prod `connect-src` lacked `clerk.llmworkbench.io` (the pk_live FAPI).

## Notes

Preview deploys use the dev Clerk instance (`*.clerk.accounts.dev`, already
covered), so the prod custom-domain behavior is verified on production after
merge: `curl -s -D- https://www.llmworkbench.io/sign-in` should show
`clerk.llmworkbench.io` in `connect-src`, and social sign-in should render.
