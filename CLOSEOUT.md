# Closeout: MIT license + publish-ready package manifests

## Summary

Slice 2 of the open-source publishing arc (gated on the PROJECT.md posture flip,
#42). Converts the repository's license from proprietary to MIT and makes the five
`packages/*` libraries publish-ready under the `@llm-workbench/*` scope, while
keeping the root, `apps/web`, and `examples/*` private (never published).

## Changes

- **LICENSE × 6** — root + `packages/{runtime,ui,adapters-react,ai-sdk,mcp}/LICENSE`
  replaced with the MIT License, `Copyright (c) 2026 Roy McFarland`.
- **NOTICE removed** — it was a proprietary artifact ("All rights reserved",
  "Authorized Users"); MIT does not use a NOTICE file.
- **`"license": "MIT"`** set on every `package.json` (root, 5 packages, `apps/web`,
  both examples), replacing `"SEE LICENSE IN LICENSE"`.
- **Five packages made publishable** — removed `"private"`; added
  `publishConfig: { "access": "public" }`, `repository` (with per-package
  `directory`), `homepage` (`https://www.llmworkbench.io`), `bugs`, `author`
  (`Roy McFarland`), a one-line `description`, and `keywords`.
- **Non-published manifests** — root, `apps/web`, `examples/*` keep `"private": true`.

## Verification

- `npm run build` ✓ (all 5 packages emit).
- `npm pack --dry-run` on each of the five packages: tarball includes the MIT
  `LICENSE` (1.1 kB) and `dist`; **no `src/` or `*.test.*` leakage** (asserted
  per-package via the `--json` file list).
- `npm run smoke:esm` ✓ (plain-Node import of runtime + ai-sdk + mcp unaffected).
- `npm run ci` exit 0 — full build, all tests (302+), web typecheck/lint/build green.
- `package-lock.json` updated to reflect the workspace metadata changes (9 lines;
  no dependency add/remove).

## Out of scope (next slices)

- Slice 4 — restore the GitHub links #39 removed + fix the stale `GITHUB_URL` +
  OSS-ify the site/README "proprietary" framing.
- Slice 5 — per-package READMEs (4 of 5 packages still lack one) + README badges.
- Slice 6 — community docs (CONTRIBUTING rewrite, CODE_OF_CONDUCT, SECURITY, templates).
- Slice 7 — changesets + npm publish workflow.

Packages are now MIT-licensed and publish-ready, but **not yet published** — the
first publish happens at go-live (Phase 5) after the release workflow lands and the
npm org is created.
