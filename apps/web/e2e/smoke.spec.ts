import { test, expect } from "@playwright/test";

import {
  PLAYWRIGHT_CLERK_BYPASS_COOKIE,
  PLAYWRIGHT_CLERK_BYPASS_HEADER,
  resolvePlaywrightClerkBypassSecret,
} from "../lib/playwright-clerk-bypass";

import { E2E_ORIGIN } from "./env";

test.describe("Public smoke (no sign-in)", () => {
  test("GET /api/health", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  test("landing page loads", async ({ page }) => {
    const secret = resolvePlaywrightClerkBypassSecret();
    await page.context().addCookies([
      {
        name: PLAYWRIGHT_CLERK_BYPASS_COOKIE,
        value: secret,
        url: E2E_ORIGIN,
      },
    ]);
    await page.setExtraHTTPHeaders({
      [PLAYWRIGHT_CLERK_BYPASS_HEADER]: secret,
    });
    test.setTimeout(60_000);
    await page.goto("/", { waitUntil: "load" });
    await expect(page).toHaveTitle(/LLM Workbench/u, { timeout: 30_000 });
  });
});
