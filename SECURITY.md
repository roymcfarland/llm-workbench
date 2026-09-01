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

These run in CI on every pull request and on `main`:

- **Dependency advisories** — `npm run audit:check` (`audit-ci`, configured in
  [`audit-ci.jsonc`](audit-ci.jsonc)) fails the build on any **high or critical**
  advisory across the full dependency graph. The allowlist is currently empty;
  each accepted exception, if any, must carry a dated reason and a runnable
  REVISIT check. The file's header documents the accept/decline policy.
- **Automatic advisory remediation** — `audit-autofix.yml` checks the gate daily.
  If it is red, it runs `npm audit fix`, verifies the result from a clean install
  against both the audit gate and the full CI pipeline, and only then opens a PR.
  It never opens an unverified PR, and it does not auto-merge. This exists because
  the gate blocks the very PRs that would fix it — a red gate once froze the
  default branch for 21 days.
- **Static analysis** — CodeQL scans first-party code (`javascript-typescript`)
  and the GitHub Actions workflows themselves (`actions`). The workflow scanning
  is deliberate: a past incident was an Actions expression-injection bug where a
  generated string expanded into a shell step.
- **Secret scanning** — `gitleaks` runs on every PR. Known-benign test
  placeholders are allowlisted by fingerprint in `.gitleaks.toml`.
- **Supply chain** — packages publish to npm via OIDC trusted publishing with
  build provenance and no long-lived token. Dependabot proposes updates, which
  are triaged deliberately rather than merged for currency alone.

If you're integrating LLM Workbench in a product that handles regulated
data and want to discuss hardening, reach out via the maintainer's GitHub
profile (<https://github.com/roymcfarland>).
