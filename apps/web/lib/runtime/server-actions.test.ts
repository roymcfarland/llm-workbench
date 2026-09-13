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
vi.mock("ai", () => ({ streamText: vi.fn(), generateObject: vi.fn() }));

import { TenantAuthError, requireTenant } from "@/lib/auth/tenant";
import * as store from "@/lib/supabase/runs-store";
import { generateObject, streamText } from "ai";
import { compileProfileAction } from "./server-actions";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireTenant).mockResolvedValue({ userId: "user_a", tenantId: "tenant-a" });
});

function expectNoStoreCalls() {
  for (const mock of Object.values(store)) expect(mock).not.toHaveBeenCalled();
}

describe("compileProfileAction tenant boundary", () => {
  it("rejects a signed-out caller before resume validation or downstream access", async () => {
    vi.mocked(requireTenant).mockRejectedValue(new TenantAuthError());
    const result = compileProfileAction({ resumeText: "short" });
    await expect(result).rejects.toBeInstanceOf(TenantAuthError);
    await expect(result).rejects.toThrow("Authentication required");
    expect(generateObject).not.toHaveBeenCalled();
    expect(streamText).not.toHaveBeenCalled();
    expectNoStoreCalls();
  });
});
