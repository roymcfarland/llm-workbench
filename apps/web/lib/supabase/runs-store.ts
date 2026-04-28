import "server-only";

import {
  WorkbenchError,
  assertRunStoreStateStructuralInvariants,
  type RunStoreState,
  type SavedRunMeta,
} from "@llm-workbench/runtime";

import {
  isTerminalRunStatus,
  maybeFireRunCompletionNotification,
  type MaybeFireArgs,
  type RunCompletionDispatchResult,
} from "../notifications/run-completion";
import { getServiceSupabase } from "./server";

/**
 * Wire format that `HttpRunRepository.serializeState` produces and
 * `deserializeState` consumes. Mirrored exactly so the client's
 * `PUT /runs/:runId` body lands here unchanged.
 */
export type SerializedRun = {
  revision: number;
  run: RunStoreState["run"];
  trace: RunStoreState["trace"];
  artifactsByKey: Array<[string, unknown]>;
  ruleSetsById: Array<[string, unknown]>;
  stepStatus: Array<[string, string]>;
  gateState: Array<[string, unknown]>;
  idempotency: Array<[string, { artifactKey: string; version: number }]>;
};

export type RunsTableRow = {
  id: string;
  tenant_id: string;
  workflow_id: string | null;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  tags: string[] | null;
  state: SerializedRun;
  created_at: string;
  updated_at: string;
};

export function serializedToState(json: unknown): RunStoreState {
  if (!json || typeof json !== "object" || !("run" in (json as Record<string, unknown>))) {
    throw new WorkbenchError(
      "HTTP_INVALID_JSON",
      "Run row is missing a serialized RunStoreState",
    );
  }
  const row = json as SerializedRun;
  const state: RunStoreState = {
    revision: row.revision ?? 0,
    run: row.run,
    trace: Array.isArray(row.trace) ? row.trace : [],
    artifactsByKey: new Map(asEntries(row.artifactsByKey)) as RunStoreState["artifactsByKey"],
    ruleSetsById: new Map(asEntries(row.ruleSetsById)) as RunStoreState["ruleSetsById"],
    stepStatus: new Map(asEntries(row.stepStatus)) as RunStoreState["stepStatus"],
    gateState: new Map(asEntries(row.gateState)) as RunStoreState["gateState"],
    idempotency: new Map(asEntries(row.idempotency)) as RunStoreState["idempotency"],
  };
  assertRunStoreStateStructuralInvariants(state);
  return state;
}

export function stateToSerialized(state: RunStoreState): SerializedRun {
  return {
    revision: state.revision,
    run: state.run,
    trace: state.trace,
    artifactsByKey: [...state.artifactsByKey.entries()],
    ruleSetsById: [...state.ruleSetsById.entries()],
    stepStatus: [...state.stepStatus.entries()],
    gateState: [...state.gateState.entries()],
    idempotency: [...state.idempotency.entries()],
  };
}

function asEntries<T>(v: unknown): Array<[string, T]> {
  return Array.isArray(v) ? (v as Array<[string, T]>) : [];
}

function metaFromRow(row: Pick<RunsTableRow, "id" | "workflow_id" | "started_at" | "ended_at" | "status" | "tags">): SavedRunMeta {
  return {
    id: row.id,
    workflowId: row.workflow_id ?? "",
    startedAt: row.started_at ?? "",
    endedAt: row.ended_at ?? undefined,
    status: row.status ?? "running",
    tags: row.tags ?? undefined,
  };
}

const TABLE = "runs";

export async function listRunsForTenant(
  tenantId: string,
  opts: { limit?: number } = {},
): Promise<SavedRunMeta[]> {
  const limit = Math.max(1, Math.min(500, opts.limit ?? 100));
  const { data, error } = await getServiceSupabase()
    .from(TABLE)
    .select("id, workflow_id, started_at, ended_at, status, tags")
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Supabase list error: ${error.message}`);
  return (data ?? []).map(metaFromRow);
}

export async function loadRunForTenant(
  tenantId: string,
  runId: string,
): Promise<RunsTableRow | null> {
  const { data, error } = await getServiceSupabase()
    .from(TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", runId)
    .maybeSingle();
  if (error) throw new Error(`Supabase load error: ${error.message}`);
  return (data as RunsTableRow | null) ?? null;
}

/**
 * Test hook: the runs-store calls into this for run-completion notifications.
 * Defaults to {@link maybeFireRunCompletionNotification}; tests inject a fake
 * to assert the dispatch shape without exercising Clerk or Resend.
 */
export type RunCompletionDispatcher = (
  args: MaybeFireArgs,
) => Promise<RunCompletionDispatchResult>;

export async function saveRunForTenant(
  tenantId: string,
  state: RunStoreState,
  opts: { dispatchCompletion?: RunCompletionDispatcher } = {},
): Promise<void> {
  // Defense in depth: validate before we write, even though API routes also
  // call this. Keeps hand-rolled callers (server actions, scripts) safe.
  assertRunStoreStateStructuralInvariants(state);
  const serialized = stateToSerialized(state);
  const row: Omit<RunsTableRow, "created_at" | "updated_at"> = {
    id: state.run.id,
    tenant_id: tenantId,
    workflow_id: state.run.workflowId,
    status: state.run.status,
    started_at: state.run.startedAt,
    ended_at: state.run.endedAt ?? null,
    tags: state.run.tags ?? null,
    state: serialized,
  };

  // We need the prior row to detect terminal-state transitions for the
  // notification hook. The select is cheap (PK lookup, status column only)
  // and lets us fire emails idempotently per transition. Skip the lookup
  // entirely when the incoming status isn't terminal — the common case for
  // mid-run writes — to keep the hot path identical to before.
  let priorStatus: string | null = null;
  const incomingStatus = state.run.status;
  if (isTerminalRunStatus(incomingStatus)) {
    const { data, error: priorErr } = await getServiceSupabase()
      .from(TABLE)
      .select("status")
      .eq("tenant_id", tenantId)
      .eq("id", state.run.id)
      .maybeSingle();
    if (priorErr) {
      // Non-fatal: a missing prior row is normal on the first write, but we
      // still want to know if the select itself broke (e.g. RLS). Log and
      // proceed — the notification hook is opt-in and must not block writes.
      console.error("[saveRunForTenant] prior-status select failed", {
        runId: state.run.id,
        message: priorErr.message,
      });
    } else if (data && typeof data.status === "string") {
      priorStatus = data.status;
    }
  }

  const { error } = await getServiceSupabase()
    .from(TABLE)
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(`Supabase save error: ${error.message}`);

  // Fire-and-forget. The dispatcher swallows its own errors and never
  // throws, but we wrap with try/catch + a tail .catch on the returned
  // promise so a future regression cannot tank the put caller.
  const dispatch = opts.dispatchCompletion ?? maybeFireRunCompletionNotification;
  try {
    const pending = dispatch({
      tenantId,
      runId: state.run.id,
      newStatus: incomingStatus,
      priorStatus,
      workflowId: state.run.workflowId,
      startedAt: state.run.startedAt,
      endedAt: state.run.endedAt,
    });
    void pending.catch((err) => {
      console.error("[saveRunForTenant] notification dispatch rejected", {
        runId: state.run.id,
        err: err instanceof Error ? err.message : String(err),
      });
    });
  } catch (err) {
    console.error("[saveRunForTenant] notification dispatch threw", {
      runId: state.run.id,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function deleteRunForTenant(
  tenantId: string,
  runId: string,
): Promise<void> {
  const { error } = await getServiceSupabase()
    .from(TABLE)
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", runId);
  if (error) throw new Error(`Supabase delete error: ${error.message}`);
}
