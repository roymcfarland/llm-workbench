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

If you're integrating LLM Workbench in a product that handles regulated
data and want to discuss hardening, reach out via the maintainer's GitHub
profile (<https://github.com/roymcfarland>).
