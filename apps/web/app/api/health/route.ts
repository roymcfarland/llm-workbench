export const dynamic = "force-dynamic";

/**
 * Liveness probe for orchestration and proxy allowlisting (`/api/health`).
 */
export async function GET(): Promise<Response> {
  return Response.json({ ok: true as const }, { status: 200 });
}
