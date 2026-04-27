# Contributing to LLM Workbench

Thanks for your interest in improving LLM Workbench. This document covers
the licensing posture for contributions, the development workflow, and
the bar this codebase tries to hold.

## Licensing posture (read first)

LLM Workbench ships under the
[PolyForm Noncommercial 1.0.0](LICENSE) license. To keep dual-licensing
viable (so the maintainer can offer commercial licenses to companies
that want commercial rights — see [`COMMERCIAL.md`](COMMERCIAL.md)),
contributions must come in under terms compatible with that model.

By submitting a pull request, issue, patch, or other contribution
("Contribution") to this repository you certify that:

1. **Origin (DCO).** You meet the
   [Developer Certificate of Origin 1.1](https://developercertificate.org/),
   i.e. the work is yours or you have the right to submit it under the
   project's license. Sign your commits with `git commit -s` to record
   `Signed-off-by: Your Name <you@example.com>`.
2. **Inbound license = outbound license.** Your Contribution is licensed
   to the project and to all downstream users under the same PolyForm
   Noncommercial 1.0.0 terms as the rest of the codebase.
3. **Right to relicense.** You also grant the project maintainer
   (Roy McFarland, "the Maintainer") a **perpetual, worldwide,
   non-exclusive, royalty-free, sublicensable license** to your
   Contribution, including the right to relicense it under different
   terms (for example, a paid commercial license, or a more permissive
   open-source license should the project change posture in the future).
   You retain copyright in your Contribution.
4. **Patents.** You grant the Maintainer and downstream recipients a
   non-exclusive, worldwide, royalty-free patent license to make, have
   made, use, sell, offer for sale, import, and otherwise transfer the
   software, on patent claims you control that are necessarily infringed
   by your Contribution.

If you cannot agree to all four points, please do not submit code; open
an issue describing the change and the Maintainer can implement it
independently.

## Development workflow

Prerequisites:

- Node.js >= 18.18 (CI runs on 18 and 20)
- npm >= 9

```bash
npm install
npm run build
npm test
```

Each package lives under `packages/`:

- `@llm-workbench/runtime` — protocol types, `WorkbenchRuntime` /
  `WorkbenchSession`, schema registry, persistence ports, run bundle
  serialization with integrity hashing, structured errors.
- `@llm-workbench/ui` — `WorkbenchShell` React component (themeable
  CSS).
- `@llm-workbench/adapters-react` — small React hook adapters.

Examples live under `examples/`:

- `examples/job-search-demo` — a Vite app that exercises the runtime,
  UI, persistence, fork, and bundle import/export.
- `examples/run-repo-server` — a reference Express server for
  `HttpRunRepository`.

### Code style

- TypeScript strict mode is on (`tsconfig.json`).
- Public APIs (anything exported from a package's `index.ts`) need a
  short JSDoc comment explaining intent. Internal helpers don't.
- Errors thrown from the runtime should be `WorkbenchError` instances
  with a stable `code` (see `src/errors.ts`). Don't surface raw `ZodError`
  or `Error` objects across package boundaries.
- Persistence adapters and the schema registry are the **only** runtime
  components allowed to do I/O or import Node-only / DOM-only APIs.
  Everything else is environment-agnostic.

### Tests

- Vitest is the test runner. Co-locate tests next to the file they cover
  (`foo.ts` ↔ `foo.test.ts`).
- For React adapters use `@testing-library/react` with the `jsdom`
  environment (already configured).
- New behaviors must come with at least one test. Bug fixes should land
  with a regression test.

### Commit hygiene

- One logical change per commit, with `git commit -s`.
- Commit subject ≤ 72 chars, imperative mood
  ("Add abort support to HttpRunRepository", not "Added support…").
- Reference an issue number when one exists.

### Pull request checklist

- [ ] `npm run build` is green
- [ ] `npm test` is green
- [ ] Public API changes are reflected in the package README, and in
      `CHANGELOG.md` under "Unreleased".
- [ ] DCO sign-off present on all commits.

## Reporting bugs

Use the GitHub issue tracker. For security-sensitive reports, see
[`SECURITY.md`](SECURITY.md).
