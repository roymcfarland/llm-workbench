/**
 * Minimal reference server for `HttpRunRepository` (`@llm-workbench/runtime`).
 *
 * Endpoints:
 * - PUT /runs/:runId   body: serialized RunStoreState JSON (same shape MemoryRunRepository uses)
 * - GET /runs/:runId
 * - GET /runs?limit=50
 * - DELETE /runs/:runId
 *
 * This demo store is in-memory. A real deployment must authenticate every route and scope by tenant/user.
 */
import express from "express";

const app = express();
app.use(express.json({ limit: "25mb" }));

/** @type {Map<string, any>} */
const db = new Map();

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
  if (!req.body?.run?.id) return res.status(400).json({ error: "Expected RunStoreState JSON with run.id" });
  if (req.body.run.id !== id) return res.status(400).json({ error: "run.id must match URL param" });
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

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`run-repo-server listening on http://localhost:${port}`);
});
