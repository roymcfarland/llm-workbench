# Closeout: rate limiter reads Vercel KV_* env names

## Summary

Vercel's "Upstash for Redis" Marketplace integration (provisioned as
`upstash-kv-carmine-drawer`, connected to Production/Preview/Development)
injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`, not the native
`UPSTASH_REDIS_REST_*` names the edge rate limiter previously read. Updated
`redisFromEnv()` to accept either scheme (native `UPSTASH_REDIS_REST_*` first,
then the `KV_*` vars, using `||` so an empty string falls through), so the
limiter engages when Redis is provisioned through the integration instead of
silently treating it as unconfigured. No behavior change when neither is set.

## Files Changed

- `apps/web/lib/rate-limit/edge.ts`
- `apps/web/lib/rate-limit/edge.test.ts`
- `CHANGELOG.md`
- `CLOSEOUT.md`

## Verification

- `npm test -w @llm-workbench/web` exits 0: 12 files, 82 tests (was 81; +1 new
  test asserting `KV_*` names configure the limiter, so a production `/api`
  request passes through the limiter rather than failing closed with 503). The
  Upstash SDKs are mocked so the configured path is exercisable without a real
  Redis.
- `npm run typecheck -w @llm-workbench/web` exits 0.
- `npm run lint -w @llm-workbench/web` exits 0.
- The unconfigured tests now zero out BOTH naming schemes (`UPSTASH_*` and
  `KV_*`) so they stay deterministic regardless of the host/CI environment.

## Follow-up (Vercel env, not code)

- This branch's preview deploy already has `KV_*` (Preview env), so the preview
  is the verification surface: `/api/*` should respond (not 503) and rate-limit.
- After merge to production: remove the `RATE_LIMIT_ALLOW_UNCONFIGURED`
  Production env var (currently set, 3d old) so prod fails closed if Redis ever
  disappears, then redeploy for the change to take effect.
