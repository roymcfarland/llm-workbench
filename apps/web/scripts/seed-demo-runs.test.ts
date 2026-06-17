// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";

import { buildSeedRows } from "./seed-demo-runs.mjs";

describe("buildSeedRows", () => {
  it("builds genuine, stable seed rows for the public run counter", () => {
    const now = Date.UTC(2026, 5, 17, 18, 0, 0);
    const rows = buildSeedRows({ count: 12, now });

    expect(rows).toHaveLength(12);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);

    const startedAtMs = rows.map((row) => Date.parse(row.started_at ?? ""));
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]!;
      expect(row.id).toMatch(/^seed-demo-/);
      expect(row.tenant_id).toBe("seed-demo");
      expect(row.status).toBe("completed");
      expect(Number.isNaN(startedAtMs[i])).toBe(false);
      expect(startedAtMs[i]).toBeGreaterThanOrEqual(now - 90 * 24 * 60 * 60 * 1000);
      expect(startedAtMs[i]).toBeLessThanOrEqual(now);
      expect(row.state.run).toBeTruthy();
      expect(Array.isArray(row.state.trace)).toBe(true);

      if (i > 0) {
        expect(startedAtMs[i]).toBeLessThan(startedAtMs[i - 1]!);
      }
    }
  });
});
