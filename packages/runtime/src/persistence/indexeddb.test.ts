import { describe, expect, it } from "vitest";
import { IndexedDbRunRepository } from "./indexeddb.js";

describe("IndexedDbRunRepository", () => {
  it("isSupported() reports false in environments without indexedDB", () => {
    expect(typeof (globalThis as { indexedDB?: unknown }).indexedDB).toBe("undefined");
    expect(IndexedDbRunRepository.isSupported()).toBe(false);
  });

  it("save() throws STORAGE_UNAVAILABLE when indexedDB is not present", async () => {
    const repo = new IndexedDbRunRepository();
    await expect(
      repo.save({
        revision: 0,
        run: {
          id: "r1",
          workflowId: "w",
          workflowVersion: 1,
          workflowSnapshot: { id: "w", version: 1, steps: [{ id: "a", gatePolicy: "AUTO" }], edges: [] },
          startedAt: new Date().toISOString(),
          status: "running",
        },
        trace: [],
        artifactsByKey: new Map(),
        ruleSetsById: new Map(),
        stepStatus: new Map([["a", "pending"]]),
        gateState: new Map(),
        idempotency: new Map(),
      }),
    ).rejects.toMatchObject({ code: "STORAGE_UNAVAILABLE" });
  });
});
