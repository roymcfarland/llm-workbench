# Closeout: Clean audit gate via audit-ci (allowlisted, fail-closed)

`npm audit` reports 9 packages (3 low, 6 moderate) flagged by 10 source advisories, none
with an available fix. This slice makes the project's audit gate read clean by allowlisting
exactly those 10 advisories by GHSA id through `audit-ci`, while keeping the gate fail-closed
for anything new. No application source changes.

## Outcome

- `npm run audit:check` (and the CI audit step, now `npm run audit:check`) exits 0:
  "Passed npm security audit."
- The 10 no-fix advisories are allowlisted by GHSA id in `audit-ci.jsonc`, each with a
  written revisit trigger (ai@6 / monaco > 0.55.1 / next upgrade).
- The gate stays fail-closed: removing any one allowlisted id makes the gate exit non-zero,
  and a new advisory at any severity (low+) fails CI.
- Honest scope: bare `npm audit` is UNCHANGED (still 9 — npm has no native ignore). Only the
  project gate reads clean.

## Files Changed

- `package.json` (audit-ci dev dep + `audit:check` script)
- `package-lock.json` (audit-ci added; incremental install — cross-platform optionals intact)
- `audit-ci.jsonc` (new — the allowlist)
- `.github/workflows/ci.yml` (audit step → `npm run audit:check`)
- `CHANGELOG.md`
- `CLOSEOUT.md`

## Architectural choices

- **Allowlist by GHSA id, never by severity or package.** `"low": true` makes the gate fail
  on everything low+; only the 10 named GHSA ids pass. A blanket severity-skip or
  package/path allowlist would hide future advisories — rejected.
- **Replaced, not supplemented, the old `npm audit --omit=dev --audit-level=high` step.** The
  audit-ci gate is strictly broader (dev-inclusive, all severities), so it subsumes the old
  prod-high check while adding low/moderate coverage.
- **No native `npm audit` suppression attempted** — npm has none; faking it was not the goal.

## Evidence

### Clean gate

```text
npm run audit:check
<… "Passed npm security audit." …>   exit 0
```

### Fail-closed proof (remove one id → gate fails)

```text
<temp config with GHSA-qx2v-qp2m-jg93 removed>
npx audit-ci --config <temp>   ->   exit 1 (non-zero)
```

### Lockfile clean-install valid + platform-complete

```text
npm ci                                  exit 0
grep -c '@rollup/rollup-linux\|@esbuild/linux' package-lock.json   -> <non-zero>
```

### Bare audit unchanged (honest)

```text
npm audit   ->   9 vulnerabilities (3 low, 6 moderate)
```

### Build/test

```text
npm run ci   ->   <292 tests passed; web build ok>
```
