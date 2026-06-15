# Closeout: refresh the dependency audit baseline

## Summary

A batch of newly-published npm advisories turned the `audit:check` gate red on
`main`, blocking every PR. Patched what had non-breaking fixes and allowlisted
the one remaining no-fix advisory with rationale.

- **Patched via `npm audit fix`** (lockfile-only, no major bumps): `@babel/core`
  arbitrary file read (GHSA-4x5r-pxfx-6jf8), `form-data` CRLF injection
  (GHSA-hmw2-7cc7-3qxx), `ws` DoS (GHSA-96hv-2xvq-fx4p).
- **Newly allowlisted** in `audit-ci.jsonc`: `js-yaml` GHSA-h67p-54hq-rp68
  (quadratic-complexity DoS in merge-key handling, transitive via `gray-matter`
  blog front-matter parsing — only ever parses our own authored content at BUILD
  time, never untrusted/runtime input; fix needs the breaking `gray-matter@2`).
- **Unchanged allowlist entries:** the 8 DOMPurify advisories (Monaco vendors its
  own copy — the npm package is declared-but-unimported; `npm audit fix` cannot
  move it), `@ai-sdk/provider-utils` (needs ai@6), and `postcss` (Next.js
  transitive). These were already allowlisted with revisit triggers.

## Files Changed

- `package-lock.json` (the three `npm audit fix` patches)
- `audit-ci.jsonc` (allowlist the one new no-fix advisory)
- `CHANGELOG.md`
- `CLOSEOUT.md`

## Verification

- `npm run audit:check` exits 0 — "Passed npm security audit." The three patched
  advisories no longer appear; the allowlisted set is acknowledged.
- `npm ci` exits 0 — the updated lockfile installs cleanly from scratch
  (platform-complete; no single-OS regenerate, per the lockfile lesson).
- `npm run ci` exits 0 — build, all workspace tests, typecheck, lint, build:web.

## Notes

This unblocks the whole PR pipeline (the gate was failing on `main`, not on any
one branch). Open PRs branched before this need `main` merged in to pick up the
patched lockfile + allowlist before their CI goes green.
