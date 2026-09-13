import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/tenant", () => {
  class TenantAuthError extends Error {
    constructor(message = "Authentication required") {
      super(message);
      this.name = "TenantAuthError";
    }
  }
  return { TenantAuthError, requireTenant: vi.fn() };
});
vi.mock("@/lib/supabase/runs-store", () => ({
  listRunsForTenant: vi.fn().mockResolvedValue([]),
  loadRunForTenant: vi.fn().mockResolvedValue(null),
  saveRunForTenant: vi.fn().mockResolvedValue(undefined),
  deleteRunForTenant: vi.fn().mockResolvedValue(undefined),
  serializedToState: vi.fn(),
  stateToSerialized: vi.fn(),
}));

import { TenantAuthError, requireTenant } from "@/lib/auth/tenant";
import * as store from "@/lib/supabase/runs-store";
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireTenant).mockResolvedValue({ userId: "user_a", tenantId: "tenant-a" });
});

function expectNoStoreCalls() {
  for (const mock of Object.values(store)) expect(mock).not.toHaveBeenCalled();
}

describe("GET /api/runs tenant boundary", () => {
  it("rejects a signed-out caller before store access", async () => {
    vi.mocked(requireTenant).mockRejectedValue(new TenantAuthError());
    const res = await GET(new Request("https://example.test/api/runs"));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Authentication required" });
    expect(res.headers.get("Link")).toBe('</api/openapi.json>; rel="describedby"');
    expectNoStoreCalls();
  });

  it("lists runs in the caller's tenant with the default limit", async () => {
    const res = await GET(new Request("https://example.test/api/runs"));
    expect(res.status).toBe(200);
    expect(store.listRunsForTenant).toHaveBeenCalledExactlyOnceWith("tenant-a", { limit: 100 });
  });
});
