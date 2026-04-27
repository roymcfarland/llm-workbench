/**
 * Minimal *reference* server for `HttpRunRepository` (`@llm-workbench/runtime`).
 *
 * Endpoints:
 * - PUT /runs/:runId   body: serialized RunStoreState JSON (same shape MemoryRunRepository uses)
 * - GET /runs/:runId
 * - GET /runs?limit=50
 * - DELETE /runs/:runId
 *
 * SECURITY (read this before deploying anything that looks like this):
 *   - This demo store is process-local memory. It is wiped on every restart.
 *   - There is NO authentication, NO tenant scoping, NO rate limiting, NO durable storage.
 *   - The body validator below catches malformed RunStoreState payloads but trusts callers
 *     for tenant/user identity. A real deployment MUST:
 *       1. Authenticate every request (Clerk, NextAuth, custom JWT, etc.) and pin the
 *          `RunSubject` it persists to the authenticated principal.
 *       2. Authorise reads/writes against `state.run.subject.tenantId` /
 *          `state.run.subject.userId`.
 *       3. Persist to a durable store (Postgres, S3, Supabase, etc.).
 *       4. Cap concurrent in-flight bodies and apply rate limits.
 *       5. Run the same `assertRunStoreStateStructuralInvariants` check from
 *          `@llm-workbench/runtime` BEFORE persisting (this file does a JSON-only shape
 *          check; the runtime's invariant check is stricter).
 *
 *   See `apps/web/` in this repo for a hosted reference that does the above properly.
 */
import express from "express";

const app = express();

const MAX_BODY_BYTES = 25 * 1024 * 1024;
const MAX_RUNS_IN_MEMORY = 1000;

app.use(
  express.json({
    limit: MAX_BODY_BYTES,
    strict: true,
  }),
);

/** @type {Map<string, any>} */
const db = new Map();

function jsonError(res, status, message, detail) {
  return res.status(status).json({ error: message, ...(detail !== undefined ? { detail } : {}) });
}

/**
 * Surface-level validation of a serialized `RunStoreState` payload.
 * Hosts MUST additionally call `assertRunStoreStateStructuralInvariants` from the runtime.
 *
 * @param {unknown} body
 * @returns {{ ok: true } | { ok: false; reason: string }}
 */
function validateRunStoreShape(body) {
  if (!body || typeof body !== "object") return { ok: false, reason: "body must be a JSON object" };
  const b = /** @type {Record<string, unknown>} */ (body);
  if (typeof b.protocolVersion !== "string") return { ok: false, reason: "protocolVersion must be a string" };
  if (typeof b.revision !== "number" || !Number.isFinite(b.revision)) {
    return { ok: false, reason: "revision must be a finite number" };
  }
  if (!b.run || typeof b.run !== "object") return { ok: false, reason: "run must be an object" };
  const run = /** @type {Record<string, unknown>} */ (b.run);
  if (typeof run.id !== "string" || run.id.length === 0) return { ok: false, reason: "run.id must be a non-empty string" };
  if (typeof run.status !== "string") return { ok: false, reason: "run.status must be a string" };
  if (typeof run.startedAt !== "string") return { ok: false, reason: "run.startedAt must be a string" };
  if (!Array.isArray(b.trace)) return { ok: false, reason: "trace must be an array" };
  if (!Array.isArray(b.artifacts)) return { ok: false, reason: "artifacts must be an array" };
  if (!Array.isArray(b.ruleSets)) return { ok: false, reason: "ruleSets must be an array" };
  if (!Array.isArray(b.stepStatus)) return { ok: false, reason: "stepStatus must be an array" };
  if (!Array.isArray(b.gateState)) return { ok: false, reason: "gateState must be an array" };
  if (!Array.isArray(b.idempotency)) return { ok: false, reason: "idempotency must be an array" };
  return { ok: true };
}

function metaFromRow(row) {
  return {
    id: row.run.id,
    workflowId: row.run.workflowId,
    startedAt: row.run.startedAt,
    endedAt: row.run.endedAt,
    status: row.run.status,
    tags: row.run.tags,
  };
}

app.put("/runs/:runId", (req, res) => {
  const id = req.params.runId;
  const v = validateRunStoreShape(req.body);
  if (!v.ok) return jsonError(res, 400, "Malformed RunStoreState body", v.reason);
  if (req.body.run.id !== id) return jsonError(res, 400, "run.id must match URL param");
  if (db.size >= MAX_RUNS_IN_MEMORY && !db.has(id)) {
    return jsonError(res, 507, `In-memory store full (${MAX_RUNS_IN_MEMORY} rows); restart or wire a durable store`);
  }
  db.set(id, req.body);
  res.status(204).end();
});

app.get("/runs/:runId", (req, res) => {
  const row = db.get(req.params.runId);
  if (!row) return res.status(404).end();
  res.json(row);
});

app.get("/runs", (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100)));
  const metas = [...db.values()]
    .map(metaFromRow)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, limit);
  res.json(metas);
});

app.delete("/runs/:runId", (req, res) => {
  db.delete(req.params.runId);
  res.status(204).end();
});

app.use((err, _req, res, _next) => {
  if (err && err.type === "entity.too.large") {
    return jsonError(res, 413, "Request body too large", `limit=${MAX_BODY_BYTES} bytes`);
  }
  if (err && err.type === "entity.parse.failed") {
    return jsonError(res, 400, "Invalid JSON body");
  }
  // eslint-disable-next-line no-console
  console.error("Unhandled error:", err);
  return jsonError(res, 500, "Internal server error");
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`run-repo-server listening on http://localhost:${port} (max body ${MAX_BODY_BYTES} bytes, ${MAX_RUNS_IN_MEMORY} rows)`);
});
