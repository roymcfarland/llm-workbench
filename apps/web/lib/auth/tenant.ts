import "server-only";

import { auth } from "@clerk/nextjs/server";

export type TenantContext = {
  userId: string;
  /** Stable key we scope persistence by. Prefers Clerk org, falls back to user. */
  tenantId: string;
};

/**
 * Resolve the caller's tenant identity from Clerk. Throws if unauthenticated.
 *
 * SECURITY: Every API route and server action that touches the runs table
 * must call this first. The Supabase service-role key bypasses RLS, so this
 * function is the single guard that scopes data per Clerk org/user.
 */
export async function requireTenant(): Promise<TenantContext> {
  const { userId, orgId } = await auth();
  if (!userId) {
    throw new TenantAuthError("Authentication required");
  }
  return { userId, tenantId: orgId ?? `user:${userId}` };
}

export class TenantAuthError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "TenantAuthError";
  }
}
