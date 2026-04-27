import "server-only";

import { getServiceSupabase } from "@/lib/supabase/server";

/**
 * Live count of persisted runs across all tenants. Exposed on the marketing
 * landing page as a single anonymous metric. Wraps the Supabase query in a
 * try/catch so the page renders during local dev / preview builds without a
 * configured database.
 */
export async function getTotalRunsCount(): Promise<number | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  try {
    const { count, error } = await getServiceSupabase()
      .from("runs")
      .select("id", { count: "exact", head: true });
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}
