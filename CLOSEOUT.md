# Closeout: resync package-lock.json to released workspace versions

## Summary

Lockfile-only hygiene fix. The changesets "Version Packages" PR (#53) bumped
every workspace `package.json` to its released version but did not run an
install, so `package-lock.json` on `main` still recorded the pre-release
versions (`@llm-workbench/* 0.2.0`, `apps/web 0.1.0`, `examples/* 0.0.0`). Any
subsequent `npm install` resyncs those versions, which is why an unrelated
feature PR (the blog publisher, #57) surfaced the resync as incidental lockfile
churn. Regenerating the lockfile here, in its own correctly-scoped PR, fixes the
drift at the source and keeps future feature diffs clean.

## Changes

- **`package-lock.json`** — regenerated with npm 11 from the current
  `package.json` set. Workspace self-versions now match (`0.3.0` / `0.1.1` /
  `0.0.1`); stale `peer` metadata normalized. **No** dependency added, removed,
  or version-bumped (0 new `resolved`/`integrity` entries).
- **`CHANGELOG.md` / `CLOSEOUT.md`** — ledger.

## Verification

- `git diff main -- package-lock.json`: 0 new/removed `resolved`/`integrity`
  lines — pure version + `peer`-metadata resync.
- `npm run audit:check`: green (high 0, critical 0).
- CI (`build & test` node 22/24) runs `npm ci`, which requires
  `package.json` ↔ `package-lock.json` agreement — the gate proves the resync.

## Not in scope

No `package.json`, source, workflow, or dependency changes — lockfile only.
