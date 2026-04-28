import { test, expect } from "@playwright/test";

test.describe("Public smoke (no sign-in)", () => {
  test("GET /api/health", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  test("GET /llms.txt (route handler, no document handshake)", async ({
    request,
  }) => {
    const res = await request.get("/llms.txt");
    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/LLM Workbench/);
    expect(text).toMatch(/Protocol overview/u);
  });
});
