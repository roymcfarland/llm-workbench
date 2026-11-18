# Security policy

## Reporting a vulnerability

LLM Workbench is a runtime that handles model inputs/outputs, including
material a host application may consider sensitive (resumes, prompts,
tool outputs). If you find a vulnerability, please report it privately
**before** opening a public issue or PR.

On the repository's [Security Advisories page](https://github.com/roymcfarland/llm-workbench/security/advisories),
select **Report a vulnerability** to submit a private report. Private
vulnerability reporting is enabled for this repository. If that is not available to you, contact the maintainer
directly via the email on their GitHub profile
(<https://github.com/roymcfarland>) with the subject line
`security: llm-workbench`.

## Scope

The five published npm packages and the hosted reference app are in scope.

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
- The code and configuration of `apps/web`, including its deployment at
  [llmworkbench.io](https://llmworkbench.io), the maintainer's reference deployment.

When testing the hosted instance, stop at the minimal proof of concept needed
to demonstrate the issue.

Out of scope:

- Vulnerabilities in `ajv`, `fast-json-patch`, `zod`, `react`, `vite`,
  or `express` themselves. Report these to the relevant project.
- Misconfiguration of host applications that bypass the documented
  persistence-port contract (e.g. shipping `HttpRunRepository` without
  any authentication on the server side — see
  [the persistence and authentication guide](packages/runtime/src/persistence/AUTH.md)).
- Vulnerabilities in third-party platforms themselves, including Vercel, Clerk,
  Supabase, Upstash, Resend, and model providers. Report these directly to the
  relevant vendor.
- Volumetric denial of service.
- Social engineering.
- Automated scanning that degrades the service.
- Issues that require an already-compromised account or device.

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
  advisories**. Unrecognised failures exit 1. The allowlist has one entry dated
  2026-11-18 for GHSA-fc5q-39xc-vjpf (dev-only `picomatch` with no patched
  release). Each accepted exception must carry a dated reason and a runnable
  REVISIT check. The file's header documents the accept/decline policy.
- **Automatic advisory remediation** — `audit-autofix.yml` checks daily (or on
  manual dispatch). An advisory finding triggers `npm audit fix`; verification
  removes `node_modules`, runs `npm ci`, then `npm run audit:check` and
  `npm run ci`, on Node 24 only. The PR's own CI adds Node 22 and 26 jobs, plus
  coverage and Playwright on Node 24. The job opens or updates one
  `chore/audit-autofix` PR and never auto-merges. If the fix changes nothing, it fails for human triage. If the
  registry is unreachable during the gate check, it warns and opens no PR;
  an outage during the raw `audit:check` verification fails the job.
  `npm audit fix` can also change packages the gate did not require, so review
  all version moves. A red gate once froze the default branch for 21 days.
  A separate job fails the run when the autofix PR has been open more than
  48 hours (the daily 06:00 UTC cadence means it first fires on day 3).
- **Static analysis** — CodeQL reports on first-party code
  (`javascript-typescript`) and the GitHub Actions workflows (`actions`).
  Workflow scanning covers issues such as generated strings expanding into
  shell steps. It is not a required check.
- **Secret scanning** — the [Secret scan workflow](.github/workflows/gitleaks.yml)
  uses `gitleaks/gitleaks-action@v3` on PRs and pushes to `main`. The workflow
  references the action by major. [`.gitleaks.toml`](.gitleaks.toml) allowlists
  known-benign test placeholders by exact-string regex.
- **Supply chain** — on pushes to `main`, the enabled release workflow publishes
  packages to npm via OIDC trusted publishing with build provenance and no
  long-lived token. [Dependabot](.github/dependabot.yml) checks npm workspaces
  and GitHub Actions weekly. See the [upgrade policy](ROADMAP.md#standing-policy-dependency-upgrades)
  for how updates are triaged.

If you're integrating LLM Workbench in a product that handles regulated
data and want to discuss hardening, reach out via the maintainer's GitHub
profile (<https://github.com/roymcfarland>).
