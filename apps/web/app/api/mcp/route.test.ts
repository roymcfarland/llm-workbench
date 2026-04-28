import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `requireTenant()` is the single auth gate the MCP route consults. We mock
// it here so the route can be exercised without a Clerk session.
vi.mock("@/lib/auth/tenant", () => {
  class TenantAuthError extends Error {
    constructor(message = "Authentication required") {
      super(message);
      this.name = "TenantAuthError";
    }
  }
  return {
    TenantAuthError,
    requireTenant: vi.fn(),
  };
});

// `runs-store` reaches into Supabase via the service-role key. The route
// only calls these when an authenticated tenant invokes a tool, but we mock
// them to keep the tests hermetic — Supabase env vars aren't available in
// test contexts.
vi.mock("@/lib/supabase/runs-store", () => ({
  listRunsForTenant: vi.fn().mockResolvedValue([]),
  loadRunForTenant: vi.fn().mockResolvedValue(null),
  saveRunForTenant: vi.fn().mockResolvedValue(undefined),
  deleteRunForTenant: vi.fn().mockResolvedValue(undefined),
  serializedToState: vi.fn(),
}));

import { TenantAuthError, requireTenant } from "@/lib/auth/tenant";
import { POST } from "./route";

const mockRequireTenant = vi.mocked(requireTenant);

function postBody(body: unknown): Request {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mcp — auth gating", () => {
  beforeEach(() => {
    mockRequireTenant.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows unauthenticated `initialize` (MCP discovery is public)", async () => {
    mockRequireTenant.mockRejectedValue(new TenantAuthError());

    const res = await POST(
      postBody({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "smoke", version: "0.0.0" },
        },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { serverInfo: { name: string } };
    };
    expect(body.result.serverInfo.name).toBe("llm-workbench");
  });

  it("allows unauthenticated `tools/list` (clients enumerate capabilities before auth)", async () => {
    mockRequireTenant.mockRejectedValue(new TenantAuthError());

    const res = await POST(
      postBody({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { tools: Array<{ name: string }> };
    };
    const names = body.result.tools.map((t) => t.name);
    expect(names).toContain("list_runs");
    expect(names).toContain("start_run");
  });

  it("returns a JSON-RPC `Unauthorized` envelope for unauthenticated `tools/call`", async () => {
    mockRequireTenant.mockRejectedValue(new TenantAuthError());

    const res = await POST(
      postBody({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "list_runs", arguments: {} },
      }),
    );

    // HTTP 401 carries the JSON-RPC error body so HTTP-aware clients (curl,
    // load balancers, dashboards) see the auth requirement at the transport
    // layer; MCP clients still see the protocol-shaped error in the body.
    expect(res.status).toBe(401);
    const body = (await res.json()) as {
      jsonrpc: string;
      id: number | null;
      error: { code: number; message: string };
    };
    expect(body.jsonrpc).toBe("2.0");
    expect(body.id).toBe(3);
    expect(body.error.code).toBe(-32001);
    expect(body.error.message).toBe("Unauthorized");
  });

  it("dispatches `tools/call` to the tenant repository when authenticated", async () => {
    mockRequireTenant.mockResolvedValue({
      userId: "user_test",
      tenantId: "user:user_test",
    });

    const res = await POST(
      postBody({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "list_runs", arguments: {} },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { content: Array<{ type: string; text: string }> };
    };
    // The mocked `listRunsForTenant` resolves to []; the tool serializes it.
    const text = body.result.content[0]?.text ?? "";
    expect(JSON.parse(text)).toEqual([]);
  });
});
