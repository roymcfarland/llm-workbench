import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getServiceSupabase: vi.fn() }));

import { getServiceSupabase } from "@/lib/supabase/server";
import { getTotalRunsCount } from "./runs-count";
import { SEED_TENANT_ID } from "./seed-tenant";

const neq = vi.fn();
const select = vi.fn();
const from = vi.fn();

describe("landing run count", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    vi.mocked(getServiceSupabase).mockReset();
    from.mockReset().mockReturnValue({ select });
    select.mockReset().mockReturnValue({ neq });
    neq.mockReset().mockResolvedValue({ count: 7, error: null });
    vi.mocked(getServiceSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof getServiceSupabase>);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("counts saved runs while excluding the shared seed tenant", async () => {
    expect(await getTotalRunsCount()).toBe(7);
    expect(from).toHaveBeenCalledWith("runs");
    expect(select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(SEED_TENANT_ID).toBe("seed-demo");
    expect(neq).toHaveBeenCalledWith("tenant_id", SEED_TENANT_ID);
  });

  it.each(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])(
    "returns null without %s and never creates a client", async (key) => {
      vi.stubEnv(key, "");
      expect(await getTotalRunsCount()).toBeNull();
      expect(getServiceSupabase).not.toHaveBeenCalled();
    },
  );

  it("returns null on a Supabase query error", async () => {
    neq.mockResolvedValue({ count: null, error: { message: "unavailable" } });
    expect(await getTotalRunsCount()).toBeNull();
  });

  it("returns null when the query throws", async () => {
    neq.mockRejectedValue(new Error("connection failed"));
    expect(await getTotalRunsCount()).toBeNull();
  });

  it("returns null when client creation throws", async () => {
    vi.mocked(getServiceSupabase).mockImplementation(() => { throw new Error("unavailable"); });
    expect(await getTotalRunsCount()).toBeNull();
  });

  it.each([0, null])("preserves the zero fallback for count %s", async (count) => {
    neq.mockResolvedValue({ count, error: null });
    expect(await getTotalRunsCount()).toBe(0);
  });
});
