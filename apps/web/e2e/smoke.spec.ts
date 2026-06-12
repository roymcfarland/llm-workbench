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

  test("GET / renders under strict CSP without script violations", async ({
    page,
  }) => {
    const cspViolations: string[] = [];
    await page.context().addCookies([
      {
        name: "__clerk_db_jwt",
        value: "e2e-dev-browser",
        domain: "localhost",
        path: "/",
        sameSite: "Lax",
      },
    ]);

    page.on("console", (msg) => {
      if (/Refused to (execute|load)[^]*script/i.test(msg.text())) {
        cspViolations.push(msg.text());
      }
    });

    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    expect(response?.headers()["content-security-policy"]).toContain(
      "'strict-dynamic'",
    );
    await expect(page.locator("body")).toBeVisible();
    expect(cspViolations).toEqual([]);
  });
});
