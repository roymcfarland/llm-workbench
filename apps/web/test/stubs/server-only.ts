// `server-only` is a build-time guard that errors when imported outside the
// React Server runtime. The vitest config aliases it here so server modules
// (lib/supabase/runs-store, lib/auth/tenant, ...) can be unit-tested without
// dragging in the Next.js bundler. The stub is intentionally empty.
export {};
