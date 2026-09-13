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
  RunIdConflictError: class RunIdConflictError extends Error {
    name = "RunIdConflictError";
  },
  listRunsForTenant: vi.fn().mockResolvedValue([]),
  loadRunForTenant: vi.fn().mockResolvedValue(null),
  saveRunForTenant: vi.fn().mockResolvedValue(undefined),
  deleteRunForTenant: vi.fn().mockResolvedValue(undefined),
  serializedToState: vi.fn(),
  stateToSerialized: vi.fn(),
}));

import { TenantAuthError, requireTenant } from "@/lib/auth/tenant";
import * as store from "@/lib/supabase/runs-store";
import { WorkbenchRuntime } from "@llm-workbench/runtime";
import { initialRuleSet, jobSearchWorkflow } from "@/lib/workflow/job-search";
import { DELETE, GET, PUT } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireTenant).mockResolvedValue({ userId: "user_a", tenantId: "tenant-a" });
});

function expectNoStoreCalls() {
  for (const mock of Object.values(store)) {
    if (vi.isMockFunction(mock)) expect(mock).not.toHaveBeenCalled();
  }
}

function seedRun() {
  const rt = new WorkbenchRuntime();
  const { runId } = rt.startRun({
    workflow: jobSearchWorkflow,
    ruleSets: [initialRuleSet],
  });
  return { runId, state: rt.getState(runId)! };
}

function request(method: string, runId: string) {
  return new Request(`https://example.test/api/runs/${runId}`, {
    method,
    ...(method === "PUT" ? { body: "{}" } : {}),
  });
}

describe("/api/runs/[runId] tenant boundary", () => {
  it.each([
    ["GET", GET],
    ["PUT", PUT],
    ["DELETE", DELETE],
  ] as const)("rejects signed-out %s before store access or deserialization", async (method, handler) => {
    vi.mocked(requireTenant).mockRejectedValue(new TenantAuthError());
    const { runId } = seedRun();
    const res = await handler(request(method, runId), { params: Promise.resolve({ runId }) });
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Authentication required" });
    expect(res.headers.get("Link")).toBe('</api/openapi.json>; rel="describedby"');
    expectNoStoreCalls();
  });

  it("loads a run in the caller's tenant and returns 404 when absent", async () => {
    const { runId } = seedRun();
    const res = await GET(request("GET", runId), { params: Promise.resolve({ runId }) });
    expect(res.status).toBe(404);
    expect(store.loadRunForTenant).toHaveBeenCalledExactlyOnceWith("tenant-a", runId);
  });

  it("deletes a run in the caller's tenant", async () => {
    const { runId } = seedRun();
    const res = await DELETE(request("DELETE", runId), { params: Promise.resolve({ runId }) });
    expect(res.status).toBe(204);
    expect(store.deleteRunForTenant).toHaveBeenCalledExactlyOnceWith("tenant-a", runId);
  });

  it("saves a structurally valid run in the caller's tenant", async () => {
    const { runId, state } = seedRun();
    vi.mocked(store.serializedToState).mockReturnValueOnce(state);
    const res = await PUT(request("PUT", runId), { params: Promise.resolve({ runId }) });
    expect(res.status).toBe(204);
    expect(store.saveRunForTenant).toHaveBeenCalledExactlyOnceWith("tenant-a", state);
  });

  it("returns 409 with the Link header when a run id is unavailable", async () => {
    const { runId, state } = seedRun();
    vi.mocked(store.serializedToState).mockReturnValueOnce(state);
    vi.mocked(store.saveRunForTenant).mockRejectedValueOnce(new store.RunIdConflictError());
    const res = await PUT(request("PUT", runId), { params: Promise.resolve({ runId }) });
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "Run id is not available" });
    expect(res.headers.get("Link")).toBe('</api/openapi.json>; rel="describedby"');
    expect(store.saveRunForTenant).toHaveBeenCalledExactlyOnceWith("tenant-a", state);
  });
});
