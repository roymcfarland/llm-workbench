import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// SECURITY: This client uses the Supabase service-role key. It MUST never be
// imported into a Client Component or returned over the wire. We rely on
// Clerk + an explicit tenant check at the API/server-action layer to keep
// runs scoped per user/org. See `lib/supabase/runs-store.ts`.
let cached: SupabaseClient | undefined;

export function getServiceSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
