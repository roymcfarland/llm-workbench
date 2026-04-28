import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Supabase service client mock -------------------------------------------
// We model the queries the runs-store actually issues:
//   1) `.from("runs").select("status").eq("tenant_id", t).eq("id", r).maybeSingle()`
//      — only when the incoming status is terminal
//   2) `.from("runs").upsert(row, { onConflict: "id" })`

type Status = "running" | "completed" | "failed" | "cancelled";

const supabaseState = {
  priorStatusByRunId: new Map<string, Status>(),
  upsertResult: { error: null as null | { message: string } },
  selectError: null as null | { message: string },
  upsertCalls: [] as Array<{ id: string; status: string; tenant_id: string }>,
  selectCalls: [] as Array<{ id: string; tenant_id: string }>,
};

vi.mock("./server", () => ({
  getServiceSupabase: () => ({
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (col1: string, val1: string) => ({
          eq: (col2: string, val2: string) => ({
            maybeSingle: async () => {
              const tenantId = col1 === "tenant_id" ? val1 : val2;
              const runId = col1 === "id" ? val1 : val2;
              supabaseState.selectCalls.push({ id: runId, tenant_id: tenantId });
              if (supabaseState.selectError) {
                return { data: null, error: supabaseState.selectError };
              }
              const status = supabaseState.priorStatusByRunId.get(runId);
              return { data: status ? { status } : null, error: null };
            },
          }),
        }),
      }),
      upsert: async (
        row: { id: string; status: string; tenant_id: string },
      ) => {
        supabaseState.upsertCalls.push({
          id: row.id,
          status: row.status,
          tenant_id: row.tenant_id,
        });
        return supabaseState.upsertResult;
      },
    }),
  }),
}));

import {
  type RunCompletionDispatcher,
  saveRunForTenant,
} from "./runs-store";
import type { RunStoreState } from "@llm-workbench/runtime";

function freshState(
  overrides: Partial<RunStoreState["run"]> = {},
): RunStoreState {
  const run: RunStoreState["run"] = {
    id: "run_test",
    workflowId: "wf_test",
    workflowVersion: 0,
    workflowSnapshot: {
      id: "wf_test",
      version: 0,
      steps: [{ id: "s1", name: "S1", kind: "tool" }],
      edges: [],
      gates: [],
    } as unknown as RunStoreState["run"]["workflowSnapshot"],
    startedAt: "2026-04-27T19:55:12.000Z",
    status: "running",
    ...overrides,
  };
  return {
    revision: 0,
    run,
    trace: [],
    artifactsByKey: new Map(),
    ruleSetsById: new Map(),
    stepStatus: new Map([["s1", "pending"]]),
    gateState: new Map([
      ["s1", { before: "approved", after: "approved", checkpoints: {} }],
    ]) as RunStoreState["gateState"],
    idempotency: new Map(),
  };
}

async function flushMicrotasks() {
  // Three turns covers the dispatcher promise + its tail .catch.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
  await Promise.resolve();
}

describe("saveRunForTenant — run-completion email hook", () => {
  beforeEach(() => {
    supabaseState.priorStatusByRunId = new Map();
    supabaseState.upsertResult = { error: null };
    supabaseState.selectError = null;
    supabaseState.upsertCalls = [];
    supabaseState.selectCalls = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches once on a first-write terminal status", async () => {
    const dispatch: RunCompletionDispatcher = vi
      .fn()
      .mockResolvedValue({ ok: true, emailId: "e_1" });
    const state = freshState({
      id: "run_first",
      status: "completed",
      endedAt: "2026-04-27T19:57:48.000Z",
    });
    await saveRunForTenant("user:user_a", state, {
      dispatchCompletion: dispatch,
    });
    await flushMicrotasks();

    expect(supabaseState.selectCalls).toHaveLength(1);
    expect(supabaseState.upsertCalls).toEqual([
      { id: "run_first", status: "completed", tenant_id: "user:user_a" },
    ]);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const call = vi.mocked(dispatch).mock.calls[0]![0];
    expect(call).toMatchObject({
      tenantId: "user:user_a",
      runId: "run_first",
      newStatus: "completed",
      priorStatus: null,
    });
  });

  it("dispatches with the prior status when one exists", async () => {
    supabaseState.priorStatusByRunId.set("run_known", "running");
    const dispatch: RunCompletionDispatcher = vi
      .fn()
      .mockResolvedValue({ ok: true, emailId: "e_2" });
    const state = freshState({
      id: "run_known",
      status: "completed",
      endedAt: "2026-04-27T19:57:48.000Z",
    });
    await saveRunForTenant("user:user_a", state, {
      dispatchCompletion: dispatch,
    });
    await flushMicrotasks();
    const call = vi.mocked(dispatch).mock.calls[0]![0];
    expect(call.priorStatus).toBe("running");
  });

  it("does not select prior status for non-terminal writes", async () => {
    const dispatch: RunCompletionDispatcher = vi
      .fn()
      .mockResolvedValue({ ok: false, reason: "skipped-non-terminal" });
    const state = freshState({ id: "run_running", status: "running" });
    await saveRunForTenant("user:user_a", state, {
      dispatchCompletion: dispatch,
    });
    await flushMicrotasks();
    expect(supabaseState.selectCalls).toHaveLength(0);
    expect(supabaseState.upsertCalls).toHaveLength(1);
    // Dispatcher is still invoked so the hook can record its skip reason
    // — keeps the runs-store free of hard-coded terminal-status policy.
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("does not propagate dispatcher rejections to the put caller", async () => {
    const dispatch: RunCompletionDispatcher = vi
      .fn()
      .mockRejectedValue(new Error("clerk down"));
    const state = freshState({
      id: "run_unsafe",
      status: "completed",
      endedAt: "2026-04-27T19:57:48.000Z",
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      saveRunForTenant("user:user_a", state, { dispatchCompletion: dispatch }),
    ).resolves.toBeUndefined();
    await flushMicrotasks();
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining("notification dispatch rejected"),
      expect.objectContaining({ runId: "run_unsafe" }),
    );
  });

  it("does not propagate synchronous dispatcher throws to the put caller", async () => {
    const dispatch: RunCompletionDispatcher = vi.fn(() => {
      throw new Error("sync boom");
    });
    const state = freshState({
      id: "run_throws",
      status: "failed",
      endedAt: "2026-04-27T19:57:48.000Z",
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      saveRunForTenant("user:user_a", state, { dispatchCompletion: dispatch }),
    ).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining("notification dispatch threw"),
      expect.objectContaining({ runId: "run_throws" }),
    );
  });

  it("propagates supabase upsert errors", async () => {
    supabaseState.upsertResult = { error: { message: "boom" } };
    const state = freshState({ id: "run_err", status: "running" });
    await expect(saveRunForTenant("user:user_a", state)).rejects.toThrow(
      /Supabase save error: boom/,
    );
  });

  it("dispatches with priorStatus=null when the prior-status select fails (does not throw)", async () => {
    supabaseState.selectError = { message: "rls denied" };
    const dispatch: RunCompletionDispatcher = vi
      .fn()
      .mockResolvedValue({ ok: true, emailId: "e_3" });
    const state = freshState({
      id: "run_select_err",
      status: "completed",
      endedAt: "2026-04-27T19:57:48.000Z",
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await saveRunForTenant("user:user_a", state, {
      dispatchCompletion: dispatch,
    });
    await flushMicrotasks();
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining("prior-status select failed"),
      expect.objectContaining({ runId: "run_select_err" }),
    );
    expect(supabaseState.upsertCalls).toHaveLength(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------------
// Hook decision matrix lives next to the runs-store integration tests so a
// reader can see both layers in one place. The notifier itself is unit-tested
// in `lib/notifications/email.test.ts`.

import {
  isTerminalRunStatus,
  maybeFireRunCompletionNotification,
} from "../notifications/run-completion";

describe("isTerminalRunStatus", () => {
  it("recognizes the three terminal statuses", () => {
    expect(isTerminalRunStatus("completed")).toBe(true);
    expect(isTerminalRunStatus("failed")).toBe(true);
    expect(isTerminalRunStatus("cancelled")).toBe(true);
  });

  it("rejects running/unknown/null", () => {
    expect(isTerminalRunStatus("running")).toBe(false);
    expect(isTerminalRunStatus("unknown")).toBe(false);
    expect(isTerminalRunStatus(null)).toBe(false);
    expect(isTerminalRunStatus(undefined)).toBe(false);
  });
});

describe("maybeFireRunCompletionNotification", () => {
  const baseArgs = {
    tenantId: "user:user_a",
    runId: "run_a",
    workflowId: "wf",
    startedAt: "2026-04-27T19:55:12.000Z",
    endedAt: "2026-04-27T19:57:48.000Z",
  };

  function makeHooks(emailId = "e_ok") {
    const notifier = vi.fn().mockResolvedValue({ ok: true, emailId });
    const resolveRecipient = vi.fn().mockResolvedValue("user@example.com");
    const resolveSiteOrigin = vi
      .fn()
      .mockResolvedValue("https://workbench.example.com");
    return { notifier, resolveRecipient, resolveSiteOrigin };
  }

  it("fires on a first-write terminal status (no prior row)", async () => {
    const hooks = makeHooks();
    const result = await maybeFireRunCompletionNotification({
      ...baseArgs,
      newStatus: "completed",
      priorStatus: null,
      ...hooks,
    });
    expect(result).toEqual({ ok: true, emailId: "e_ok" });
    expect(hooks.notifier).toHaveBeenCalledTimes(1);
    const call = hooks.notifier.mock.calls[0]![0];
    expect(call.recipientEmail).toBe("user@example.com");
    expect(call.run.id).toBe("run_a");
    expect(call.run.status).toBe("completed");
    expect(call.siteOrigin).toBe("https://workbench.example.com");
  });

  it("does NOT fire when prior status equals new status (idempotent re-write)", async () => {
    const hooks = makeHooks();
    const result = await maybeFireRunCompletionNotification({
      ...baseArgs,
      newStatus: "completed",
      priorStatus: "completed",
      ...hooks,
    });
    expect(result).toEqual({ ok: false, reason: "skipped-already-terminal" });
    expect(hooks.notifier).not.toHaveBeenCalled();
  });

  it("DOES fire when transitioning between terminal statuses", async () => {
    const hooks = makeHooks();
    const result = await maybeFireRunCompletionNotification({
      ...baseArgs,
      newStatus: "failed",
      priorStatus: "completed",
      ...hooks,
    });
    expect(result.ok).toBe(true);
    expect(hooks.notifier).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire for non-terminal writes", async () => {
    const hooks = makeHooks();
    const result = await maybeFireRunCompletionNotification({
      ...baseArgs,
      newStatus: "running",
      priorStatus: null,
      ...hooks,
    });
    expect(result).toEqual({ ok: false, reason: "skipped-non-terminal" });
    expect(hooks.notifier).not.toHaveBeenCalled();
  });

  it("skips org tenants for v0", async () => {
    const hooks = makeHooks();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await maybeFireRunCompletionNotification({
      ...baseArgs,
      tenantId: "org_xyz",
      newStatus: "completed",
      priorStatus: null,
      ...hooks,
    });
    expect(result).toEqual({ ok: false, reason: "skipped-org-tenant" });
    expect(hooks.notifier).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalled();
  });

  it("skips silently when Clerk has no email on file", async () => {
    const hooks = makeHooks();
    hooks.resolveRecipient.mockResolvedValueOnce(null);
    vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await maybeFireRunCompletionNotification({
      ...baseArgs,
      newStatus: "completed",
      priorStatus: null,
      ...hooks,
    });
    expect(result).toEqual({ ok: false, reason: "skipped-no-recipient" });
  });

  it("skips when the recipient resolver throws", async () => {
    const hooks = makeHooks();
    hooks.resolveRecipient.mockRejectedValueOnce(new Error("clerk 5xx"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await maybeFireRunCompletionNotification({
      ...baseArgs,
      newStatus: "completed",
      priorStatus: null,
      ...hooks,
    });
    expect(result).toEqual({ ok: false, reason: "skipped-no-recipient" });
  });

  it("classifies a notifier failure into send-failed", async () => {
    const hooks = makeHooks();
    hooks.notifier.mockResolvedValueOnce({ ok: false, reason: "send-failed" });
    const result = await maybeFireRunCompletionNotification({
      ...baseArgs,
      newStatus: "failed",
      priorStatus: null,
      ...hooks,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("send-failed");
      expect(result.detail).toBe("send-failed");
    }
  });
});
