# Playwright smoke (`apps/web`)

These tests assume a production build exists under `apps/web/.next`. CI runs **`npm run build:web`** with the same **`NEXT_PUBLIC_*`** values as Playwright — see `.github/workflows/ci.yml`.

## Ports and hosts

| Variable | Meaning |
|---------|---------|
| `PLAYWRIGHT_WEB_PORT` | TCP port for `next start` (default **`3399`**). Used by `e2e/env.ts`. |
| `NEXT_PUBLIC_SITE_ORIGIN` | Must be `http://localhost:<port>` matching `E2E_ORIGIN` / Playwright’s `baseURL`. CI sets both. |
| `LLM_WB_E2E_DISABLE_DNS_SHIM` | Set to `1` to skip the Node `--import` DNS shim. CI sets this for Playwright: Linux resolves `localhost` and the shim can break Next 16’s internal proxy. |
| `LLM_WB_E2E_DNS_SHIM` | Set automatically by Playwright for `next start`; rewrites `localhost` → `127.0.0.1` at DNS lookup so Next 16’s internal middleware proxy does not hit `ENOTFOUND localhost`. |
| GitHub Actions matrix | Playwright install + smoke run **only on Node 22**; Node 20 still builds and unit-tests the repo. |

Smoke uses **`request` only** (no `page.goto` to `/`). HTML navigations to `/` hit Clerk’s dev handshake with placeholder keys; `GET /llms.txt` hits a **route handler** (plain text) and still exercises `next start` + middleware without a document load.

## Skip starting the server

If you already run `npm run start` (with matching Clerk + origin env):

```bash
export PLAYWRIGHT_SKIP_WEBSERVER=1
npm run test:e2e
```

Use the same **`localhost`** host and **`PLAYWRIGHT_WEB_PORT`** as your running server.

## One-shot helper

Deletes `.next`, builds with smoke env, runs Playwright (override port if needed):

```bash
npm run test:e2e:full -w @llm-workbench/web
```

## Clean `.next` only

```bash
npm run clean:next -w @llm-workbench/web
```

## When things flake locally

| Symptom | What to try |
|---------|---------------|
| `EADDRINUSE` | Something else owns the port — pick another: `PLAYWRIGHT_WEB_PORT=3405 npm run test:e2e:full`. |
| `EMFILE` / too many open files | Quit other heavy apps or raise `ulimit -n` temporarily; reopen Terminal. |
| `ENOENT` on `.next`/manifest | **`npm run clean:next`** then **`npm run test:e2e:full`** (or `npm run build:web` with CI-style env vars). |
| `Failed to proxy http://localhost:…` / `ENOTFOUND localhost` | Usually broken `localhost` resolution; Playwright enables a small DNS shim. Fix `/etc/hosts` (`127.0.0.1 localhost`) or keep the default shim. |
