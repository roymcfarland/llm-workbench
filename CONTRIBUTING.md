# Contributing to LLM Workbench

Thanks for your interest! LLM Workbench is open source under the
[MIT License](LICENSE), and contributions — bug reports, fixes, features, and
docs — are welcome.

## Ways to contribute

- **Report a bug or request a feature** through
  [GitHub Issues](https://github.com/roymcfarland/llm-workbench/issues) using the
  issue templates.
- **Open a pull request.** For anything non-trivial, please open an issue first
  so we can agree on the approach before you invest time.
- **Improve the docs** — the root README, per-package READMEs, and inline docs
  are all fair game.

## Development setup

Prerequisites: Node.js **>= 22** (CI runs on 22 and 24), npm **>= 9**.

```bash
git clone https://github.com/roymcfarland/llm-workbench
cd llm-workbench
npm install
npm run build
npm test
```

## Repository layout

- `packages/*` — the published libraries (`runtime`, `ui`, `adapters-react`,
  `ai-sdk`, `mcp`).
- `apps/web` — the hosted reference deployment (not published).
- `examples/*` — runnable example apps.

## Conventions

- TypeScript strict mode is on.
- Vitest is the test runner; co-locate tests next to the file they cover
  (`foo.ts` ↔ `foo.test.ts`).
- Errors thrown from the runtime should be `WorkbenchError` instances with a
  stable `code`.
- One logical change per commit; commit subjects in imperative mood, ≤ 72 chars.
  Conventional-commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`, `test:`,
  `refactor:`) are appreciated.
- File-size discipline: a 500-line soft cap, an 800-line hard cap (see
  [`PROJECT.md`](PROJECT.md)).
- The packages have a stable public surface — if you change an exported signature
  in `@llm-workbench/runtime`, call it out in the PR description.

## Pull request checklist

- [ ] `npm run build` and `npm test` pass.
- [ ] `npm run smoke:esm` passes (the packages still import under plain Node ESM).
- [ ] New behavior is covered by tests.
- [ ] `CHANGELOG.md` updated under `## [Unreleased]` if the change is user-facing.

## How changes are reviewed

Most changes ship as deliberately small, scoped PRs that are checked against
[`PROJECT.md`](PROJECT.md) — the authoritative spec for purpose, scope,
non-goals, and the conventions automated reviewers enforce. When `PROJECT.md`
conflicts with this file, `PROJECT.md` wins.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By
participating, you agree to uphold it.

## Security

Please report security issues privately via the process in
[`SECURITY.md`](SECURITY.md), not through public issues.
