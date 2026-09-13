import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { TenantAuthError, requireTenant } from "@/lib/auth/tenant";

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireTenant", () => {
  it.each([null, "org_a"])("rejects a signed-out caller with orgId %s", async (orgId) => {
    mockAuth.mockResolvedValue({ userId: null, orgId });
    const result = requireTenant();
    await expect(result).rejects.toBeInstanceOf(TenantAuthError);
    await expect(result).rejects.toThrow("Authentication required");
  });

  it("prefers the organization scope over the user scope", async () => {
    mockAuth.mockResolvedValue({ userId: "user_a", orgId: "org_a" });
    await expect(requireTenant()).resolves.toEqual({ userId: "user_a", tenantId: "org_a" });
  });

  it("falls back to the user scope when no organization is selected", async () => {
    mockAuth.mockResolvedValue({ userId: "user_a", orgId: null });
    await expect(requireTenant()).resolves.toEqual({ userId: "user_a", tenantId: "user:user_a" });
  });
});
