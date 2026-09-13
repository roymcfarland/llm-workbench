# Security policy

## Reporting a vulnerability

LLM Workbench is a runtime that handles model inputs/outputs, including
material a host application may consider sensitive (resumes, prompts,
tool outputs). If you find a vulnerability, please report it privately
**before** opening a public issue or PR.

Preferred channel: open a
[private security advisory](https://github.com/roymcfarland/llm-workbench/security/advisories/new)
on GitHub. If that is not available to you, contact the maintainer
directly via the email on their GitHub profile
(<https://github.com/roymcfarland>) with the subject line
`security: llm-workbench`.

We aim to acknowledge reports within 5 business days and to publish a
fix or mitigation within 30 days for high-severity issues.

## Scope

In scope:

- `@llm-workbench/runtime` — bundle parsing, integrity verification,
  JSON Patch handling, schema validation, persistence adapter logic,
  error surfaces.
- `@llm-workbench/ui` — `WorkbenchShell` import/export flows, JSON
  parsing of run bundles loaded from disk.
- `@llm-workbench/adapters-react` — React hooks and store subscription
  semantics.
- `@llm-workbench/ai-sdk` — model-I/O, tool-call, and cost trace-event handling
  in the Vercel AI SDK wrappers.
- `@llm-workbench/mcp` — MCP server factory and HTTP handler exposing the
  runtime over Model Context Protocol.

Out of scope (reportable to the relevant project, not here):

- Vulnerabilities in `ajv`, `fast-json-patch`, `zod`, `react`, `vite`,
  or `express` themselves.
- Misconfiguration of host applications that bypass the documented
  persistence-port contract (e.g. shipping `HttpRunRepository` without
  any authentication on the server side — see
  `packages/runtime/src/persistence/AUTH.md`).

## Hardening expectations

- The runtime is designed so untrusted run bundles are **rejected**
  before they touch in-memory state: parsing flows go through Zod schemas
  and SHA-256 integrity verification when `verifyIntegrity` is true
  (default).
- Persistence adapters never silently mutate state on failed responses;
  partial failures throw `WorkbenchError` with stable codes.
- Sensitive trace fields can be redacted via `profile: "user"` exports
  and per-artifact JSON Pointer paths registered on the schema registry.

## Automated security gates

Branch protection on `main` requires only `build & test (node 22)` and
`build & test (node 24)`. CI runs on PRs and on pushes to `main` and `autopublish/**`; CodeQL and
gitleaks report findings but are not required checks and do not block merging.
The scheduled remediation/blog workflows and push-triggered release workflow
are automation, not PR gates.

- **Dependency advisories** — CI runs `node scripts/audit-gate.mjs --mode=gate`,
  which wraps `audit-ci` and [`audit-ci.jsonc`](audit-ci.jsonc). Real **high or
  critical** advisories across the full dependency graph exit 1. If the npm
  advisory registry is unreachable, it makes two attempts 30 seconds apart,
  then emits `Audit gate not evaluated` and **passes (exit 0) without evaluating
  advisories**. Unrecognised failures exit 1. The allowlist is currently empty;
  each accepted exception, if any, must carry a dated reason and a runnable
  REVISIT check. The file's header documents the accept/decline policy.
- **Automatic advisory remediation** — `audit-autofix.yml` checks daily (or on
  manual dispatch). An advisory finding triggers `npm audit fix`; verification
  removes `node_modules`, runs `npm ci`, then `npm run audit:check` and
  `npm run ci`, on Node 24 only. The PR's own CI adds Node 22, coverage and
  Playwright. The job opens or updates one `chore/audit-autofix` PR and never
  auto-merges. If the fix changes nothing, it fails for human triage. If the
  registry is unreachable during the gate check, it warns and opens no PR;
  an outage during the raw `audit:check` verification fails the job.
  `npm audit fix` can also change packages the gate did not require, so review
  all version moves. A red gate once froze the default branch for 21 days.
- **Static analysis** — CodeQL reports on first-party code
  (`javascript-typescript`) and the GitHub Actions workflows (`actions`).
  Workflow scanning covers issues such as generated strings expanding into
  shell steps. It is not a required check.
- **Secret scanning** — `gitleaks` runs on PRs and pushes to `main`, and is not
  a required check. Known-benign test placeholders are allowlisted by
  exact-string regex in `.gitleaks.toml`.
- **Supply chain** — on pushes to `main`, the enabled release workflow publishes
  packages to npm via OIDC trusted publishing with build provenance and no
  long-lived token. Dependabot proposes updates, which are triaged deliberately
  rather than merged for currency alone.

If you're integrating LLM Workbench in a product that handles regulated
data and want to discuss hardening, reach out via the maintainer's GitHub
profile (<https://github.com/roymcfarland>).
