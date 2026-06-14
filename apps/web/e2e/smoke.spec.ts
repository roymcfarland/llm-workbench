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

  test("GET /runs/demo renders the workbench under strict CSP without script or eval violations", async ({
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
      const text = msg.text();
      if (
        /violates the following Content Security Policy/i.test(text) &&
        /script-src/i.test(text)
      ) {
        cspViolations.push(text);
      }
    });

    const response = await page.goto("/runs/demo");

    expect(response?.status()).toBe(200);
    expect(response?.headers()["content-security-policy"]).toContain(
      "'strict-dynamic'",
    );
    await expect(page.getByText("Public demo")).toBeVisible();
    await expect(page.locator("h1").filter({ hasText: /^run_/ })).toBeVisible();
    expect(cspViolations).toEqual([]);
  });

  test("navigating to a new demo run via the header does not hang on hydration", async ({
    page,
  }) => {
    await page.context().addCookies([
      {
        name: "__clerk_db_jwt",
        value: "e2e-dev-browser",
        domain: "localhost",
        path: "/",
        sameSite: "Lax",
      },
    ]);

    await page.goto("/runs/demo?s=ring");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Hydrating run…")).toHaveCount(0);

    await page.getByRole("link", { name: "Demo", exact: true }).first().click();
    await page.waitForURL("**/runs/demo");

    await expect(page.getByText("Hydrating run…")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
