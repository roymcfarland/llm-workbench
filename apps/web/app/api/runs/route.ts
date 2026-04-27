import { NextResponse } from "next/server";

import { TenantAuthError, requireTenant } from "@/lib/auth/tenant";
import { listRunsForTenant } from "@/lib/supabase/runs-store";

const MAX_LIMIT = 500;
const DESCRIBED_BY = '</api/openapi.json>; rel="describedby"';

function withDescribedBy(res: NextResponse): NextResponse {
  res.headers.set("Link", DESCRIBED_BY);
  return res;
}

export async function GET(req: Request): Promise<Response> {
  try {
    const { tenantId } = await requireTenant();
    const url = new URL(req.url);
    const rawLimit = url.searchParams.get("limit");
    const parsed = rawLimit ? Number(rawLimit) : 100;
    const limit = Number.isFinite(parsed)
      ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)))
      : 100;
    const metas = await listRunsForTenant(tenantId, { limit });
    return withDescribedBy(NextResponse.json(metas));
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return withDescribedBy(NextResponse.json({ error: e.message }, { status: 401 }));
    }
    const message = e instanceof Error ? e.message : "Internal error";
    return withDescribedBy(NextResponse.json({ error: message }, { status: 500 }));
  }
}
