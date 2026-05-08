# Contributing to LLM Workbench

LLM Workbench is **proprietary** software. All rights reserved.

Use, modification, deployment, and operation are limited to Authorized Users
(Roy McFarland personally and any entity controlled by Roy McFarland, including
Brightline Ltd) except by separate written agreement. See
[`LICENSE`](LICENSE) for the full grant.

## Outside contributions

Outside contributions are **not currently accepted**. Pull requests opened by
parties who are not Authorized Users will be closed without merge unless a
separate written agreement is in place between the contributor and the
copyright holder.

If you are interested in contributing under such an agreement, contact Roy
McFarland directly to discuss inbound license terms before opening a pull
request.

## Issue reports

Issue reports, feature suggestions, and bug reports are welcome through
[GitHub Issues](https://github.com/roymcfarland/llm-workbench/issues).
Reporting an issue does not create any license, assignment, or contribution
obligation on your part.

## Authoritative spec

[`PROJECT.md`](PROJECT.md) is the authoritative source of truth for purpose,
scope, non-goals, and the rules that automated reviewers enforce on every PR.
When `PROJECT.md` conflicts with this file, `PROJECT.md` wins.

## Development workflow (for Authorized Users)

Prerequisites: Node.js **>= 22** (matches root `engines`; CI runs **22** and **24**), npm **>= 9**.

```bash
npm install
npm run build
npm test
```

- TypeScript strict mode is on.
- Vitest is the test runner; co-locate tests next to the file they cover (`foo.ts` ↔ `foo.test.ts`).
- Errors thrown from the runtime should be `WorkbenchError` instances with a stable `code`.
- One logical change per commit; commit subjects ≤ 72 chars, imperative mood.
- File-size discipline: warn-only at 500 lines (per `PROJECT.md`); do not push existing files past 800 lines.

## Security

Please report security issues through the process in
[`SECURITY.md`](SECURITY.md), not through public GitHub Issues.
