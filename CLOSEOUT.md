# Closeout: Ajv Slice B production CSP hardening

Drops `'unsafe-eval'` from the production nonce CSP now that the browser path
uses build-time Ajv standalone validators instead of runtime schema compilation.

## Problem

The production nonce CSP temporarily retained `'unsafe-eval'` because the
client-side `SchemaRegistry` registered demo/scenario schemas without validators,
forcing Ajv to compile them in the browser via dynamic code generation. Removing
the directive before changing that path caused `/runs/demo` to fail with an eval
CSP error.

## Fix

- Added `buildPrecompiledRegistry()` for the client run viewer. It registers every
  demo and scenario artifact/rule schema with the generated validator and throws
  before registration if any schema id is missing coverage.
- Switched `RunDetailClient` to the precompiled registry helper.
- Removed `'unsafe-eval'` from the production nonce `script-src` only. Development
  and no-nonce policies still allow it.
- Pinned the CSP behavior in unit tests and tightened the `/runs/demo` smoke e2e
  to assert the header omits `'unsafe-eval'` and to fail on eval/page CSP errors.

## Files Changed

- `apps/web/lib/security/precompiled-registry.ts`
- `apps/web/lib/security/precompiled-registry.test.ts`
- `apps/web/lib/security/precompiled-validators.generated-module.d.ts`
- `apps/web/components/run-detail-client.tsx`
- `apps/web/lib/security/csp.ts`
- `apps/web/lib/security/csp.test.ts`
- `apps/web/e2e/smoke.spec.ts`
- `CHANGELOG.md`
- `CLOSEOUT.md`

## Evidence

- `npm run build` exits 0.
- `npm run typecheck -w @llm-workbench/web` exits 0.
- `npm run lint -w @llm-workbench/web` exits 0.
- `npm test -w @llm-workbench/web` exits 0 (12 files, 81 tests), including
  the new CSP unit pin and precompiled-registry coverage guard tests.
- `npm run ci` exits 0.
- `LLM_WB_E2E_DISABLE_DNS_SHIM=1 npm run test:e2e -w apps/web` exits 0
  (5 passed). The `/runs/demo` smoke test confirms the production nonce CSP has
  `'strict-dynamic'`, omits `'unsafe-eval'`, renders the workbench, and reports
  no script/eval CSP violations.
- `npm run audit:check` exits 0 with only the existing allowlisted advisories.
- Manual browser safety net: `npm run dev:web` started on
  `http://localhost:3000`; the Codex in-app browser refused the localhost visit
  under its URL policy, so no separate manual `/runs/demo` + `/playground`
  browser pass was possible in this session.
