# Closeout: keep package-lock.json in sync during changeset versioning

## Summary

Prevents the lockfile drift that PR #58 had to resync by hand. The changesets
"Version Packages" step bumps every workspace `package.json` but never ran an
install, so `package-lock.json` fell out of sync each release and later surfaced
as unrelated churn in feature PRs. This fixes it at the source: `changeset
version` is now followed by `npm install --package-lock-only`, so the version PR
includes the synced lockfile.

## Changes

- **`package.json`** — `changeset:version` script is now
  `changeset version && npm install --package-lock-only` (was `changeset
  version`). The `Release` workflow runs this command via `changesets/action`,
  so the lockfile is committed into the Version Packages PR alongside the bumped
  manifests.
- **`CHANGELOG.md` / `CLOSEOUT.md`** — ledger.

## Verification

- `package.json` parses as valid JSON; `changeset:version` resolves to the new
  command.
- No dependency or version change in this PR — it only edits the script string.
- CI (`build & test` node 22/24) runs `npm ci` and the full build, proving the
  manifest edit is well-formed. The behavior change itself is exercised by the
  next real release (the next Version Packages PR will carry a synced lockfile).

## Not in scope

- No dependency changes, no `release.yml` changes (the workflow already invokes
  `npm run changeset:version`), no source changes.
