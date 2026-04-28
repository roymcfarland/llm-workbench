import { test, expect } from "@playwright/test";

test.describe("Public smoke (no sign-in)", () => {
  test("GET /api/health", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/LLM Workbench/u);
  });
});
