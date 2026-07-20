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

import { WorkbenchRuntime } from "@llm-workbench/runtime";

import { TenantAuthError, requireTenant } from "@/lib/auth/tenant";
import {
  loadRunForTenant,
  saveRunForTenant,
  serializedToState,
} from "@/lib/supabase/runs-store";
import { initialRuleSet, jobSearchWorkflow } from "@/lib/workflow/job-search";
import { DELETE, GET, POST } from "./route";

const MAX_MCP_BODY_BYTES = 2 * 1024 * 1024;

const mockRequireTenant = vi.mocked(requireTenant);
const mockLoadRunForTenant = vi.mocked(loadRunForTenant);
const mockSaveRunForTenant = vi.mocked(saveRunForTenant);
const mockSerializedToState = vi.mocked(serializedToState);

type ToolCallResponse = {
  result: {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  };
};

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

function rawPostBody(
  body: string,
  extraHeaders: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...extraHeaders,
    },
    body,
  });
}

function nonPostRequest(method: "GET" | "DELETE"): Request {
  return new Request("http://localhost/api/mcp", {
    method,
    headers: { accept: "application/json, text/event-stream" },
  });
}

function toolCallBody(name: string, args: Record<string, unknown>): Request {
  return postBody({
    jsonrpc: "2.0",
    id: 100,
    method: "tools/call",
    params: { name, arguments: args },
  });
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolCallResponse> {
  const res = await POST(toolCallBody(name, args));
  expect(res.status).toBe(200);
  return (await res.json()) as ToolCallResponse;
}

function seedRun() {
  const rt = new WorkbenchRuntime();
  const { runId } = rt.startRun({
    workflow: jobSearchWorkflow,
    ruleSets: [initialRuleSet],
  });
  return { runId, state: rt.getState(runId)! };
}

function mockRunLoad(seeded: ReturnType<typeof seedRun>): void {
  mockLoadRunForTenant.mockResolvedValueOnce({
    state: "opaque-marker",
  } as unknown as NonNullable<Awaited<ReturnType<typeof loadRunForTenant>>>);
  mockSerializedToState.mockReturnValueOnce(seeded.state);
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

describe("POST /api/mcp — tool handlers", () => {
  beforeEach(() => {
    mockRequireTenant.mockReset();
    mockRequireTenant.mockResolvedValue({
      userId: "user_test",
      tenantId: "user:user_test",
    });
    mockLoadRunForTenant.mockClear();
    mockSaveRunForTenant.mockClear();
    mockSerializedToState.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("start_run", () => {
    it("starts and saves the reference workflow", async () => {
      const body = await callTool("start_run", {
        workflowId: "jobSearchWorkflow",
      });

      const result = JSON.parse(body.result.content[0]?.text ?? "") as {
        runId: string;
        workflowId: string;
        status: string;
      };
      expect(result).toMatchObject({
        workflowId: "jobSearchWorkflow",
        status: "running",
      });
      expect(result.runId).toEqual(expect.any(String));
      expect(result.runId).not.toHaveLength(0);
      expect(mockSaveRunForTenant).toHaveBeenCalledOnce();
    });

    it("rejects unknown workflows at SDK input validation", async () => {
      const body = await callTool("start_run", { workflowId: "unknown" });

      expect(body.result.isError).toBe(true);
      expect(body.result.content[0]?.text).toContain(
        "Input validation error: Invalid arguments for tool start_run",
      );
      expect(mockSaveRunForTenant).not.toHaveBeenCalled();
    });

    it("returns a tool error when saving fails", async () => {
      mockSaveRunForTenant.mockRejectedValueOnce(new Error("start save failed"));

      const body = await callTool("start_run", {
        workflowId: "jobSearchWorkflow",
      });

      expect(body.result.isError).toBe(true);
      expect(body.result.content[0]?.text).toContain("start save failed");
    });
  });

  describe("resolve_gate", () => {
    it("returns a tool error when the run is not found", async () => {
      const body = await callTool("resolve_gate", {
        runId: "missing-run",
        stepId: "parser1",
        gate: "PAUSE_BEFORE",
        decision: "approved",
      });

      expect(body.result.isError).toBe(true);
      expect(body.result.content[0]?.text).toBe("No run named missing-run");
    });

    it("resolves a gate and saves the run", async () => {
      const seeded = seedRun();
      mockRunLoad(seeded);

      const body = await callTool("resolve_gate", {
        runId: seeded.runId,
        stepId: "parser1",
        gate: "PAUSE_BEFORE",
        decision: "approved",
      });

      expect(JSON.parse(body.result.content[0]?.text ?? "")).toEqual({
        ok: true,
        runId: seeded.runId,
        stepId: "parser1",
        decision: "approved",
      });
      expect(mockSaveRunForTenant).toHaveBeenCalledOnce();
    });

    it("returns a tool error when saving the resolved gate fails", async () => {
      const seeded = seedRun();
      mockRunLoad(seeded);
      mockSaveRunForTenant.mockRejectedValueOnce(new Error("gate save failed"));

      const body = await callTool("resolve_gate", {
        runId: seeded.runId,
        stepId: "parser1",
        gate: "PAUSE_BEFORE",
        decision: "approved",
      });

      expect(body.result.isError).toBe(true);
      expect(body.result.content[0]?.text).toContain("gate save failed");
    });
  });

  describe("write_artifact", () => {
    it("returns a tool error when the run is not found", async () => {
      const body = await callTool("write_artifact", {
        runId: "missing-run",
        artifactKey: "parserInputs",
        typeId: "compiledProfile",
        data: { anything: true },
      });

      expect(body.result.isError).toBe(true);
      expect(body.result.content[0]?.text).toBe("No run named missing-run");
    });

    it("writes an artifact and saves the run", async () => {
      const seeded = seedRun();
      mockRunLoad(seeded);

      const body = await callTool("write_artifact", {
        runId: seeded.runId,
        artifactKey: "parserInputs",
        typeId: "compiledProfile",
        data: { anything: true },
      });

      expect(JSON.parse(body.result.content[0]?.text ?? "")).toEqual({
        ok: true,
        runId: seeded.runId,
        artifactKey: "parserInputs",
        version: 1,
      });
      expect(mockSaveRunForTenant).toHaveBeenCalledOnce();
    });

    it("returns a tool error when saving the artifact fails", async () => {
      const seeded = seedRun();
      mockRunLoad(seeded);
      mockSaveRunForTenant.mockRejectedValueOnce(new Error("artifact save failed"));

      const body = await callTool("write_artifact", {
        runId: seeded.runId,
        artifactKey: "parserInputs",
        typeId: "compiledProfile",
        data: { anything: true },
      });

      expect(body.result.isError).toBe(true);
      expect(body.result.content[0]?.text).toContain("artifact save failed");
    });
  });

  describe("export_bundle", () => {
    it("returns a tool error when the run is not found", async () => {
      const body = await callTool("export_bundle", { runId: "missing-run" });

      expect(body.result.isError).toBe(true);
      expect(body.result.content[0]?.text).toBe("No run named missing-run");
    });

    it("exports the seeded run as a bundle", async () => {
      const seeded = seedRun();
      mockRunLoad(seeded);

      const body = await callTool("export_bundle", { runId: seeded.runId });
      const bundle = JSON.parse(body.result.content[0]?.text ?? "") as {
        run?: { id?: string };
      };

      expect(bundle).toEqual(expect.any(Object));
      expect(bundle.run?.id).toBe(seeded.runId);
    });

    it("returns a tool error when loading the run fails", async () => {
      mockLoadRunForTenant.mockRejectedValueOnce(new Error("bundle load failed"));

      const body = await callTool("export_bundle", { runId: "run-1" });

      expect(body.result.isError).toBe(true);
      expect(body.result.content[0]?.text).toContain("bundle load failed");
    });
  });
});

describe("/api/mcp — transport verbs and error paths", () => {
  beforeEach(() => {
    mockRequireTenant.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes authenticated GET requests through the stateless transport", async () => {
    mockRequireTenant.mockResolvedValueOnce({
      userId: "user_test",
      tenantId: "user:user_test",
    });

    const res = await GET(nonPostRequest("GET"));

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
  });

  it("routes unauthenticated GET requests through the stateless transport", async () => {
    mockRequireTenant.mockRejectedValueOnce(new TenantAuthError());

    const res = await GET(nonPostRequest("GET"));

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
  });

  it("routes authenticated DELETE requests through the stateless transport", async () => {
    mockRequireTenant.mockResolvedValueOnce({
      userId: "user_test",
      tenantId: "user:user_test",
    });

    const res = await DELETE(nonPostRequest("DELETE"));

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
  });

  it("routes unauthenticated DELETE requests through the stateless transport", async () => {
    mockRequireTenant.mockRejectedValueOnce(new TenantAuthError());

    const res = await DELETE(nonPostRequest("DELETE"));

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
  });

  it("returns 500 when GET encounters an unexpected auth error", async () => {
    mockRequireTenant.mockRejectedValueOnce(
      new Error("auth backend unreachable"),
    );

    const res = await GET(nonPostRequest("GET"));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining("auth backend unreachable"),
    });
  });

  it("returns 500 when POST encounters an unexpected auth error", async () => {
    mockRequireTenant.mockRejectedValueOnce(
      new Error("auth backend unreachable"),
    );

    const res = await POST(toolCallBody("list_runs", {}));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining("auth backend unreachable"),
    });
  });

  it("returns 500 when DELETE encounters an unexpected auth error", async () => {
    mockRequireTenant.mockRejectedValueOnce(
      new Error("auth backend unreachable"),
    );

    const res = await DELETE(nonPostRequest("DELETE"));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining("auth backend unreachable"),
    });
  });

  it("rejects an oversized content-length before auth resolution", async () => {
    const res = await POST(
      rawPostBody("{}", {
        "content-length": String(MAX_MCP_BODY_BYTES + 1),
      }),
    );

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ error: "Payload too large" });
    expect(mockRequireTenant).not.toHaveBeenCalled();
  });

  it("rejects an oversized body when content-length is absent", async () => {
    const req = rawPostBody("x".repeat(MAX_MCP_BODY_BYTES + 1));
    expect(req.headers.get("content-length")).toBeNull();

    const res = await POST(req);

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ error: "Payload too large" });
  });

  it("resolves auth for a non-array, non-object JSON-RPC body", async () => {
    mockRequireTenant.mockResolvedValueOnce({
      userId: "user_test",
      tenantId: "user:user_test",
    });

    const res = await POST(postBody(42));

    expect(res).toBeInstanceOf(Response);
    expect(mockRequireTenant).toHaveBeenCalledOnce();
  });
});
