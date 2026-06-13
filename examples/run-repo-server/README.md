# Run Repository Server

This is a minimal reference HTTP store for the runtime's `RunRepository`
contract. It exists so `HttpRunRepository` can be exercised against a tiny
Express service that stores serialized `RunStoreState` payloads in process
memory.

## Run It

From the repository root:

```bash
npm run demo:http-server
```

Or from this directory:

```bash
npm start
```

The server listens on `http://localhost:8787` by default. Set `PORT` to use a
different port.

## Endpoints

- `PUT /runs/:runId` stores a serialized `RunStoreState` JSON body. The body
  must contain a matching `run.id`.
- `GET /runs/:runId` returns one stored run, or `404` when it is missing.
- `GET /runs?limit=50` lists run metadata, newest first. The server caps
  `limit` at `500`.
- `DELETE /runs/:runId` removes a stored run and returns `204`.

The server also enforces a 25 MiB JSON body limit, caps the process-local store
at 1,000 runs, and returns consistent JSON errors for malformed payloads.

## Reference Only

This is a demo store, not a production server. It has no authentication, tenant
scoping, rate limiting, durable storage, or full runtime invariant enforcement.
It trusts callers for user and tenant identity and forgets all data on restart.

Use it to understand the `HttpRunRepository` contract. For the hardened
reference deployment with real auth, tenant boundaries, durable persistence,
and route-level controls, see [`apps/web`](../../apps/web).
