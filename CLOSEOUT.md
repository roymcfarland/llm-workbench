# Closeout: publish via npm OIDC Trusted Publishing (drop NPM_TOKEN)

## Summary

Replaces the long-lived `NPM_TOKEN` secret in the `Release` workflow with npm
**OIDC Trusted Publishing**. GitHub Actions mints a short-lived OIDC token
(`id-token: write`, already granted) that npm exchanges for publish rights, so
there is no secret to rotate and no 90-day expiry to track. Provenance
attestations are generated automatically by trusted publishing, so the explicit
`--provenance` / `NPM_CONFIG_PROVENANCE` is no longer needed.

This is the post-launch swap planned at go-live: the first publish (0.3.0) had
to be token-based because trusted publishing can only be configured for packages
that already exist on npm. They exist now, so the token can be retired.

## Changes

- **`.github/workflows/release.yml`**
  - Removed `NPM_TOKEN`, `NODE_AUTH_TOKEN`, and `NPM_CONFIG_PROVENANCE` from the
    changesets/action env (kept `GITHUB_TOKEN` for the Version PR / tags).
  - Added an `npm install -g npm@latest` step (trusted publishing requires
    `npm >= 11.5.1`; the bundled npm may be older).
  - Documented the one-time per-package Trusted Publisher setup in the header.
  - Kept the `RELEASE_ENABLED` dormancy gate and `id-token: write`.

## Verification

- `release.yml` parses as valid YAML.
- A no-op release run (no pending changesets) does not authenticate — it logs
  "No unpublished projects to publish" and exits 0 — so merging this is safe
  before the Trusted Publishers are configured.

## Follow-up (out of this PR — needs npmjs.com access)

1. Configure Trusted Publisher for all five `@llm-workbench/*` packages
   (org `roymcfarland`, repo `llm-workbench`, workflow `release.yml`).
2. Cut a `0.3.1` validating release through OIDC; confirm 5/5 publish with
   automatic provenance.
3. `gh secret delete NPM_TOKEN` once OIDC publishing is confirmed.
