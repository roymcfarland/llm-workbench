# Closeout: publish automation + secret scanning (final staging slice)

## Summary

Last slice of the OSS staging bucket. Wires up coordinated npm publishing
(changesets + a provenance release workflow) and a gitleaks secret-scan gate —
both staged **dormant** so nothing publishes or changes until the explicit
go-live. After this, every remaining task is the coordinated launch.

## Changes

- **Changesets** — `@changesets/cli` devDep; `.changeset/config.json`
  (`access: "public"`, `baseBranch: "main"`); root scripts `changeset`,
  `changeset:version`, and `release` (`npm run build && changeset publish`).
  Changesets targets exactly the five non-private `packages/*`; root, `apps/web`,
  and `examples/*` are auto-ignored (private).
- **`.github/workflows/release.yml`** — on push to main, opens a "Version
  Packages" PR for pending changesets, and publishes with `NPM_CONFIG_PROVENANCE`
  + `id-token: write`. **Gated `if: vars.RELEASE_ENABLED == 'true'`** so the job
  is skipped (neutral, never red, never publishes) until go-live.
- **`.gitleaks.toml`** — extends the default ruleset and allowlists the three
  known-benign CI/e2e placeholders (public Clerk example publishable key, a fake
  `sk_test` stub decoding to "test secret key for e2e", and a constant name).
- **`.github/workflows/gitleaks.yml`** — runs gitleaks on PRs + main (free for
  this non-org repo).

## Verification

- `gitleaks detect --config .gitleaks.toml` over full history → **no leaks found**
  (the allowlist clears all prior benign findings; the CI gate will pass).
- `npx changeset status` → wired; no pending changesets (expected).
- Both workflow YAMLs parse clean; `npm run build` green after the devDep.
- Release job is inert until `RELEASE_ENABLED=true` + `NPM_TOKEN` are set.

## Go-live activation (Phase 5, user)

1. `npm login` locally, or create an npm granular automation token → add as the
   `NPM_TOKEN` repo secret.
2. `gh variable set RELEASE_ENABLED --body true`.
3. Add a changeset (`npm run changeset`) describing the initial public release,
   merge it; the Release workflow opens the Version PR, then publishes on merge.

## Remaining (go-live bundle — needs explicit go-ahead)

Restore the site's GitHub links + OSS site copy + retire `COMMERCIAL.md` + fix
`apps/web/lib/site.ts` (GITHUB_URL org, drop COMMERCIAL_URL) · announcement blog
post · flip repo public · first `npm publish` · personal profile README.
