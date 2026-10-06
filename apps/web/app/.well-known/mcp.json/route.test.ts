import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/site", () => ({
  siteOrigin: vi.fn().mockResolvedValue("http://localhost"),
}));

vi.mock("@/lib/auth/tenant", () => {
  class TenantAuthError extends Error {}
  return {
    TenantAuthError,
    requireTenant: vi.fn().mockRejectedValue(new TenantAuthError()),
  };
});

vi.mock("@/lib/supabase/runs-store", () => ({
  listRunsForTenant: vi.fn(),
  loadRunForTenant: vi.fn(),
  saveRunForTenant: vi.fn(),
  deleteRunForTenant: vi.fn(),
  serializedToState: vi.fn(),
}));

import { POST } from "@/app/api/mcp/route";
import { listRunsForTenant } from "@/lib/supabase/runs-store";
import { GET } from "./route";

describe("MCP descriptor", () => {
  it("lists exactly the same tools as live MCP discovery", async () => {
    const descriptorResponse = await GET();
    const discoveryResponse = await POST(new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }));

    expect(descriptorResponse.status).toBe(200);
    expect(discoveryResponse.status).toBe(200);
    const descriptor = await descriptorResponse.json();
    const discovery = await discoveryResponse.json();
    const names = (tools: Array<{ name: string }>) => tools.map(({ name }) => name).sort();
    expect(names(descriptor.tools)).toEqual(names(discovery.result.tools));
    expect(descriptor.tools).toHaveLength(8);
    expect(listRunsForTenant).not.toHaveBeenCalled();
  });
});
