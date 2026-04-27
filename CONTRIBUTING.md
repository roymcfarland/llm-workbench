# Contributing to LLM Workbench

Thanks for your interest in improving LLM Workbench. This document covers
the licensing posture for contributions, the development workflow, and the
bar this codebase tries to hold.

## Licensing posture (read first)

LLM Workbench is **dual-licensed** depending on which part of the
repository a change touches. See [`COMMERCIAL.md`](COMMERCIAL.md) for the
full breakdown. In short:

| Path | Outbound license | Your inbound terms when you contribute |
| --- | --- | --- |
| `packages/runtime`, `packages/adapters-react`, `packages/ai-sdk`, `packages/ui`, `examples/*` | Apache 2.0 | Apache 2.0 (with patent grant) |
| `apps/web` and any other path under `apps/*` or future PolyForm-NC packages (e.g. `packages/eval`, `packages/marketplace`, `packages/cost-reconciliation`) | PolyForm Noncommercial 1.0.0 | PolyForm-NC, plus a relicense grant to the Maintainer |

By submitting a pull request, issue, patch, or other contribution
("Contribution") to this repository, you certify all of the following:

1. **Origin (DCO).** You meet the
   [Developer Certificate of Origin 1.1](https://developercertificate.org/),
   i.e. the work is yours or you have the right to submit it under the
   project's license. Sign your commits with `git commit -s` to record
   `Signed-off-by: Your Name <you@example.com>`. The DCO is the only
   contributor agreement required for the Apache 2.0-licensed packages.
2. **Inbound license = outbound license.** Your Contribution is licensed
   to the project and to all downstream users under the same license that
   the affected file is already shipping under. For Apache 2.0 files that
   means Apache 2.0 (including the explicit patent grant in section 3 of
   that license). For PolyForm-NC files that means PolyForm-NC.
3. **Right to relicense (PolyForm-NC files only).** For Contributions to
   PolyForm-NC areas, you also grant the project maintainer (Roy
   McFarland, "the Maintainer") a perpetual, worldwide, non-exclusive,
   royalty-free, sublicensable license to your Contribution, including
   the right to relicense it under different terms (for example, a paid
   commercial license to a specific customer of the hosted reference
   deployment). You retain copyright in your Contribution. Contributions
   to Apache 2.0 packages do **not** require this extra grant; the
   Apache 2.0 license itself permits dual-licensing-by-sublicense.
4. **Patents.** For Apache 2.0 Contributions, the patent grant in
   section 3 of Apache 2.0 applies automatically. For PolyForm-NC
   Contributions, you grant the Maintainer and downstream recipients a
   non-exclusive, worldwide, royalty-free patent license to make, have
   made, use, sell, offer for sale, import, and otherwise transfer the
   software, on patent claims you control that are necessarily infringed
   by your Contribution.

If you cannot agree to the points relevant to the path you are touching,
please do not submit code; open an issue describing the change and the
Maintainer can implement it independently.

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

- `@llm-workbench/runtime` (Apache 2.0) — protocol types,
  `WorkbenchRuntime` / `WorkbenchSession`, schema registry, persistence
  ports, run-bundle serialization with integrity hashing, structured
  errors, span tracing, OTel mapping, migration framework.
- `@llm-workbench/ui` (Apache 2.0) — `WorkbenchShell` React component,
  `WorkflowGraph`, optional `MonacoArtifactEditor`, themeable scoped CSS.
- `@llm-workbench/adapters-react` (Apache 2.0) — small React hook
  adapters (`useWorkbenchRunRevision` etc.).
- `@llm-workbench/ai-sdk` (Apache 2.0) — Vercel AI SDK v5 wrappers that
  emit correlated `model_io` and `tool_call` trace events.

Examples live under `examples/` (Apache 2.0):

- `examples/job-search-demo` — a Vite app that exercises the runtime,
  UI, persistence, fork, and bundle import/export.
- `examples/run-repo-server` — a reference Express server for
  `HttpRunRepository`.

Hosted reference plane lives under `apps/` (PolyForm Noncommercial 1.0.0):

- `apps/web` — Next.js 16 deployment showing how to run the runtime
  behind a real auth stack with a hosted run repository.

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
- [ ] If the change touches `apps/web` or another PolyForm-NC area, you
      acknowledge the relicense grant in section 3 of "Licensing posture"
      above.

## Reporting bugs

Use the GitHub issue tracker. For security-sensitive reports, see
[`SECURITY.md`](SECURITY.md).
