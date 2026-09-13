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
vi.mock("@llm-workbench/ai-sdk", () => ({ tracedStreamText: vi.fn() }));

import { TenantAuthError, requireTenant } from "@/lib/auth/tenant";
import * as store from "@/lib/supabase/runs-store";
import { WorkbenchRuntime } from "@llm-workbench/runtime";
import { initialRuleSet, jobSearchWorkflow } from "@/lib/workflow/job-search";
import { streamText, generateObject } from "ai";
import { tracedStreamText } from "@llm-workbench/ai-sdk";
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireTenant).mockResolvedValue({ userId: "user_a", tenantId: "tenant-a" });
});

function expectNoStoreCalls() {
  for (const mock of Object.values(store)) expect(mock).not.toHaveBeenCalled();
}

function seedRun() {
  const rt = new WorkbenchRuntime();
  const { runId } = rt.startRun({
    workflow: jobSearchWorkflow,
    ruleSets: [initialRuleSet],
  });
  return { runId, state: rt.getState(runId)! };
}

function request(runId: string) {
  return new Request("https://example.test/api/llm", {
    method: "POST",
    body: JSON.stringify({ prompt: "Summarize this resume", runId, stepId: "parser1" }),
  });
}

describe("POST /api/llm tenant boundary", () => {
  it("rejects a signed-out caller before store or model access", async () => {
    vi.mocked(requireTenant).mockRejectedValue(new TenantAuthError());
    const res = await POST(request(seedRun().runId));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Authentication required" });
    expectNoStoreCalls();
    expect(streamText).not.toHaveBeenCalled();
    expect(tracedStreamText).not.toHaveBeenCalled();
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("loads the traced run in the caller's tenant before model access", async () => {
    const { runId } = seedRun();
    const res = await POST(request(runId));
    expect(res.status).toBe(404);
    expect(store.loadRunForTenant).toHaveBeenCalledExactlyOnceWith("tenant-a", runId);
    expect(tracedStreamText).not.toHaveBeenCalled();
    expect(streamText).not.toHaveBeenCalled();
  });
});
