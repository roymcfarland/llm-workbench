# Closeout: make `@llm-workbench/runtime` importable under plain Node ESM

## Summary

The runtime package was bundler-only: its public API worked under Next.js, Vite,
and vitest (all of which bundle CommonJS deps), but a real consumer importing the
published package under Node's own ESM loader crashed immediately. This is the
first concrete step toward the package actually being a usable SDK.

Root cause: `fast-json-patch` is a CommonJS module whose named exports are not
statically detectable by Node's ESM `cjs-module-lexer`. Two source files used
`import { applyPatch, type Operation } from "fast-json-patch"`. Under a bundler
that resolves fine; under plain `node` it throws
`SyntaxError: Named export 'applyPatch' not found`.

## Changes

- `packages/runtime/src/runtime/artifactController.ts` — default-import
  `fast-json-patch` and destructure `applyPatch`; `Operation` kept as a pure
  `import type` (erased at runtime).
- `packages/runtime/src/schema/registry.ts` — same fix. (The adjacent
  `import { Ajv } from "ajv"` is **left as-is**: ajv's named export *is*
  statically detectable, verified importable under plain Node — no change needed.)
- `scripts/esm-smoke.mjs` (NEW) — regression guard. Imports
  `@llm-workbench/runtime` + `ai-sdk` + `mcp` under plain Node and drives a run
  (including `patchArtifact`, which exercises `fast-json-patch`). Fails CI if any
  becomes un-importable. The bundled vitest suite *structurally cannot* catch
  this class of regression, which is exactly how the bug shipped.
- `package.json` — `smoke:esm` script; wired into `ci` (runs after `build`).
- `.github/workflows/ci.yml` — `ESM smoke` step after "Build all packages".

## Scope notes

- Only `fast-json-patch` named-value imports were affected; `ajv` imports cleanly
  under plain Node, and `ai-sdk` + `mcp` already imported cleanly (verified). The
  React packages (`ui`, `adapters-react`) are bundler/browser targets by nature
  and are out of scope for plain-Node import.
- This addresses the *interop* half of "usable as an SDK." The *distribution*
  half (the package is `private: true` / unpublished) is a separate, deliberate
  decision (PROJECT.md Q4) and not touched here.

## Evidence

- Before: a from-scratch `node` script importing the package threw
  `SyntaxError: Named export 'applyPatch' not found ... 'fast-json-patch' is a
  CommonJS module`.
- After — plain-Node consumer (workspace symlink): imported the package, gated a
  step (blocked → approved), wrote + JSON-patched an artifact, logged model I/O,
  completed the step, summarized telemetry, and exported a SHA-256-signed bundle.
- After — **external install**: `npm pack` → installed the tarball into a clean
  project *outside the monorepo* (`type: module`, no bundler) → imported and drove
  a run producing a signed bundle. Runtime deps are self-contained
  (`ajv`, `fast-json-patch`, `zod`; zero workspace deps), so it packs standalone.
- `npm run smoke:esm` → green. `npm run ci` → exit 0 (302 vitest tests, web build
  compiled). Runtime suite: 148 passed (bundler consumers unbroken).
