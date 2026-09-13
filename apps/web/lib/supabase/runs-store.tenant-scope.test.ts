import { beforeEach, describe, expect, it, vi } from "vitest";

const { calls } = vi.hoisted(() => ({ calls: [] as Array<[string, unknown[]]> }));

vi.mock("@/lib/supabase/server", () => {
  const builder: Record<string, unknown> = new Proxy({}, {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (value: unknown) => void) => resolve({ data: [], error: null });
      }
      if (prop === "maybeSingle") {
        return async () => {
          calls.push(["maybeSingle", []]);
          return { data: null, error: null };
        };
      }
      return (...args: unknown[]) => {
        calls.push([String(prop), args]);
        return builder;
      };
    },
  });
  return { getServiceSupabase: () => builder };
});

import { deleteRunForTenant, listRunsForTenant, loadRunForTenant } from "./runs-store";

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
});

function expectTenantFilter() {
  expect(calls).toContainEqual(["from", ["runs"]]);
  expect(calls).toContainEqual(["eq", ["tenant_id", "tenant-a"]]);
}

describe("runs-store tenant scoping", () => {
  it("filters list queries by tenant_id", async () => {
    await listRunsForTenant("tenant-a");
    expectTenantFilter();
  });

  it("filters load queries by tenant_id and run id", async () => {
    await loadRunForTenant("tenant-a", "run-a");
    expectTenantFilter();
    expect(calls).toContainEqual(["eq", ["id", "run-a"]]);
    expect(calls).toContainEqual(["maybeSingle", []]);
  });

  it("filters delete queries by tenant_id and run id", async () => {
    await deleteRunForTenant("tenant-a", "run-a");
    expectTenantFilter();
    expect(calls).toContainEqual(["eq", ["id", "run-a"]]);
    expect(calls).toContainEqual(["delete", []]);
  });
});
