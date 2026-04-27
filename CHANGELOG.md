# Changelog

All notable changes to LLM Workbench are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **License.** Re-licensed under PolyForm Noncommercial 1.0.0
  (source-available, noncommercial use is free, commercial use requires
  a separate paid license — see `COMMERCIAL.md`). The previous fully
  proprietary `LICENSE` and the `package.json` `license` field have been
  updated to match.
- **Errors.** `WorkbenchError` now uses native `cause`, exposes
  `toJSON()`, and preserves `Error.captureStackTrace` when available.
- **Runtime.** `WorkbenchRuntime.startRun` rejects duplicate run ids if
  the runtime ever ends up handing one out twice (extremely unlikely,
  but cheap to guard).
- **Runtime invariants.** Workflows now reject cyclic DAGs, imported run
  bundles are checked for structural mismatches beyond JSON-schema shape,
  and imported/persisted run state is validated before use.
- **Runtime lifecycle.** `WorkbenchSession` can now mark runs completed,
  failed, or cancelled with `endedAt` and a trace event, and terminal
  runs reject later mutations.
- **Telemetry.** Runs now support structured `subject` attribution and
  JSON metadata, while `model_io` trace events accept provider, model,
  token usage, cost, and duration metadata for future quota and billing
  analysis.
- **HttpRunRepository.** Now supports `signal` (AbortSignal),
  `timeoutMs`, and configurable `retry` (max attempts, base delay) for
  network errors and 5xx responses. `load()` validates the response shape
  defensively before returning.
- **IndexedDbRunRepository.** Adds `static isSupported()` and closes the
  database connection in `finally` blocks to avoid leaks under errors.
- **UI build.** Theme CSS is now copied with a portable Node script
  rather than the Unix `cp` command, so the package builds on Windows
  and other shells.

### Added

- `CONTRIBUTING.md` (DCO sign-off, inbound license = outbound, grant of
  relicensing rights to the maintainer to support dual-licensing).
- `SECURITY.md` and `NOTICE`.
- GitHub Actions CI workflow that builds and tests on Node 18 and 20.

### Fixed

- `HttpRunRepository.list()` no longer returns `null`/`undefined` — it
  always resolves to an array (empty when the body is empty).

## 0.1.0 — 2026-04-27

Initial monorepo: runtime (protocol, runtime, schema registry,
persistence ports, bundle import/export with integrity), UI shell, and
React adapters. Job-search demo and reference HTTP run repo server.
