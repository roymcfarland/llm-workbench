import { NextResponse } from "next/server";

import {
  WorkbenchError,
  assertRunStoreStateStructuralInvariants,
} from "@llm-workbench/runtime";

import { TenantAuthError, requireTenant } from "@/lib/auth/tenant";
import {
  deleteRunForTenant,
  loadRunForTenant,
  saveRunForTenant,
  serializedToState,
  stateToSerialized,
} from "@/lib/supabase/runs-store";

const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MB, matching the demo Express server.
const DESCRIBED_BY = '</api/openapi.json>; rel="describedby"';

function withDescribedBy<T extends Response>(res: T): T {
  res.headers.set("Link", DESCRIBED_BY);
  return res;
}

type Ctx = { params: Promise<{ runId: string }> };

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { tenantId } = await requireTenant();
    const { runId } = await ctx.params;
    const row = await loadRunForTenant(tenantId, runId);
    if (!row) return withDescribedBy(new NextResponse(null, { status: 404 }));
    return withDescribedBy(NextResponse.json(row.state));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { tenantId } = await requireTenant();
    const { runId } = await ctx.params;

    if (!withinSizeBudget(req)) {
      return withDescribedBy(
        NextResponse.json(
          { error: `Body exceeds ${MAX_BODY_BYTES} byte limit` },
          { status: 413 },
        ),
      );
    }

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return withDescribedBy(
        NextResponse.json(
          { error: `Body exceeds ${MAX_BODY_BYTES} byte limit` },
          { status: 413 },
        ),
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return withDescribedBy(
        NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
      );
    }

    let state;
    try {
      state = serializedToState(json);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "invalid run state";
      return withDescribedBy(NextResponse.json({ error: msg }, { status: 400 }));
    }

    if (state.run.id !== runId) {
      return withDescribedBy(
        NextResponse.json(
          { error: "state.run.id must match URL param" },
          { status: 400 },
        ),
      );
    }
    // Belt-and-suspenders: serializedToState already validates, but if a
    // future caller uses this entry point with a pre-built state we still
    // want the invariant check before any write.
    assertRunStoreStateStructuralInvariants(state);

    await saveRunForTenant(tenantId, state);
    return withDescribedBy(new NextResponse(null, { status: 204 }));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { tenantId } = await requireTenant();
    const { runId } = await ctx.params;
    await deleteRunForTenant(tenantId, runId);
    return withDescribedBy(new NextResponse(null, { status: 204 }));
  } catch (e) {
    return errorResponse(e);
  }
}

// Re-export the serializer so the Next type-checker is happy with unused
// imports if a future revision drops one of the operations above.
export { stateToSerialized };

function withinSizeBudget(req: Request): boolean {
  const len = req.headers.get("content-length");
  if (!len) return true; // streaming bodies fall through to the text check below.
  const n = Number(len);
  if (!Number.isFinite(n)) return true;
  return n <= MAX_BODY_BYTES;
}

function errorResponse(e: unknown): Response {
  if (e instanceof TenantAuthError) {
    return withDescribedBy(
      NextResponse.json({ error: e.message }, { status: 401 }),
    );
  }
  if (e instanceof WorkbenchError) {
    return withDescribedBy(
      NextResponse.json({ error: e.message, code: e.code }, { status: 400 }),
    );
  }
  const message = e instanceof Error ? e.message : "Internal error";
  return withDescribedBy(NextResponse.json({ error: message }, { status: 500 }));
}
