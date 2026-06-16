# Closeout: flip PROJECT.md license/visibility posture to open source (MIT)

## Summary

Keystone slice of the open-source publishing arc. `PROJECT.md` is the authoritative
spec the Builder/Verifier loop enforces; it previously *forbade* every change the
OSS flip requires (it failed any PR that removed `"private"`, set a permissive
license, published to npm, or made the repo public). This slice inverts the spec so
the loop *enforces* the open-source posture instead — unblocking all downstream
license-file, manifest, public-docs, and publishing slices. **Docs-only: no code,
`LICENSE` files, or `package.json` flags change here.**

## Changes

- **Purpose section** — "proprietary control plane … Commercial posture: proprietary.
  All rights reserved … Authorized Users" → "open-source control plane … License
  posture: open source under the MIT License", noting the `packages/*` publish to npm
  under `@llm-workbench/*` while root/`apps/web`/`examples/*` stay `"private": true`,
  and the repo is public at `github.com/roymcfarland/llm-workbench`.
- **Q1 (license)** — retitled "License shape and enforcement"; answer flipped to MIT.
  Verifier rules inverted: fail non-`MIT` license fields or any reintroduction of
  proprietary/"Authorized Users" language; fail `"private": true` on a publishable
  `packages/*` package (but require it on root/`apps/web`/`examples/*`); new
  `packages/*` must ship an MIT `LICENSE` + `@llm-workbench/*` publish config.
- **Q4 (visibility/publishing)** — retitled; answer flipped to "Public and published".
  Verifier rules inverted: fail attempts to re-privatize the repo; a changesets-based
  release/publish workflow with npm `--provenance` is now *expected* (fail removal of
  it once it exists); the five `packages/*` must be publishable.
- **CHANGELOG** — `### Changed` entry recording the posture flip.

## Out of scope (the slices this unblocks)

- Slice 2 — replace the 6 `LICENSE` files with MIT + set `"license": "MIT"` in every manifest.
- Slice 3 — publish-ready manifests (remove `private` from the 5 packages; add `publishConfig`,
  `repository`, `homepage`, `bugs`, `author`, `keywords`).
- Slices 4–6 — restore GitHub links + OSS-ify the site/README + community docs.
- Slice 7 — changesets + publish workflow.

## Known pre-existing drift (not touched here)

Q2 still forbids a `proxy.ts` middleware, but PR #38 already migrated `middleware.ts`
→ `proxy.ts` on `main`. That contradiction predates this slice and is out of scope;
it should be reconciled in a dedicated docs PR.

## Verification

Docs-only change to `PROJECT.md` + `CHANGELOG.md` + `CLOSEOUT.md`. No build/test impact;
CI must stay green (build, tests, lint, audit gate unaffected).
