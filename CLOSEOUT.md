# Closeout: migrate middleware.ts → proxy.ts (Next 16)

## Summary

Next.js 16 deprecated the `middleware` file convention in favor of `proxy` (the
build printed a deprecation warning). Renamed `apps/web/middleware.ts` →
`apps/web/proxy.ts`. The official codemod no-op'd because our handler is a
**default export** (`export default clerkMiddleware(...)`), not a named
`middleware` function — and the proxy convention explicitly accepts a default
export, so the migration is a pure file rename with byte-identical logic: Clerk
public-route allowlist, per-request nonce + CSP, edge rate limiter, JSON 401 for
`/api` + `/trpc`, and the same `config.matcher`.

**RUNTIME NOTE:** `middleware` defaulted to the Edge runtime; `proxy` runs on the
**Node.js runtime** (the `runtime` option is not configurable in proxy files).
This is Vercel's recommended direction and is functionally equivalent here — the
code uses only cross-runtime APIs (`crypto.getRandomValues`, `btoa`, `atob`,
`@upstash/*`, Clerk, `NextResponse`).

## Files Changed

- `apps/web/middleware.ts` → `apps/web/proxy.ts` (rename; no content change)
- `CHANGELOG.md`
- `CLOSEOUT.md`

## Verification

- `npm run build:web` exits 0; the "middleware deprecated" warning is gone; the
  route table shows `ƒ Proxy (Middleware)`.
- `LLM_WB_E2E_DISABLE_DNS_SHIM=1 npm run test:e2e -w apps/web` — 5/5 passed
  (strict-CSP render on `/` and `/runs/demo` with no script/eval violations;
  public routes; demo→demo hydration). Confirms the proxy behaves identically
  on the Node runtime.
- `npm run typecheck` / `lint -w @llm-workbench/web` exit 0; `npm test -w
  @llm-workbench/web` → 12 files / 84 tests pass.

## Notes

Auth-gated behavior (Clerk sign-in redirect / `/api` 401) is runtime-agnostic
and unchanged; verify on the PR preview (`curl -sI .../playground` → 3xx to
sign-in; `curl .../api/runs` → 401) before merge.
