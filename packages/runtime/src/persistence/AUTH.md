# Persistence and authentication

The `@llm-workbench/runtime` persistence ports store **opaque snapshots** of run state (trace + artifacts + rules).

## Responsibilities

- **Host authenticates users** and decides which runs a principal may read/write.
- **`HttpRunRepository`** never adds credentials automatically: pass them via `getHeaders()` (Bearer tokens, API keys, signed headers) and/or `fetch` options by supplying a custom `fetchImpl`.
- **`IndexedDbRunRepository`** is per-browser profile. For multi-user machines, prefer server-backed persistence or separate browser profiles.

## Suggested server contract

- Require a session on every `/runs/*` route.
- Scope queries by `tenantId` / `userId`.
- Optionally encrypt large artifact blobs at rest if storing sensitive resumes or API payloads.

## Reference implementation

See the in-repo demo server at `examples/run-repo-server/` (Express, in-memory store) matching the `HttpRunRepository` routes.
