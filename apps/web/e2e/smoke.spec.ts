import { test, expect } from "@playwright/test";

test.describe("Public smoke (no sign-in)", () => {
  test("unmatched dotted paths render a normal 404 without a Clerk error", async ({
    request,
  }) => {
    for (const path of ["/.env", "/some.file.txt"]) {
      const res = await request.get(path);
      expect(res.status()).toBe(404);
      const html = await res.text();
      expect(html).toContain("Not found");
      expect(html).not.toContain('E{\\"digest\\":');
    }
  });

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

  test("GET / loads fonts under CSP without font-src or style-src violations", async ({
    page,
  }) => {
    const cspViolations: string[] = [];
    const fontFailures: string[] = [];
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
        /font-src|style-src/i.test(text)
      ) {
        cspViolations.push(text);
      }
    });
    page.on("requestfailed", (request) => {
      if (request.resourceType() === "font") {
        fontFailures.push(`${request.url()}: ${request.failure()?.errorText}`);
      }
    });
    page.on("response", (response) => {
      if (response.request().resourceType() === "font" && !response.ok()) {
        fontFailures.push(`${response.url()}: HTTP ${response.status()}`);
      }
    });

    const response = await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    expect(response?.status()).toBe(200);
    expect(cspViolations).toEqual([]);
    expect(fontFailures).toEqual([]);
    const loadedFaces = await page.evaluate(
      () =>
        Array.from(document.fonts).filter((face) => face.status === "loaded")
          .length,
    );
    expect(loadedFaces).toBeGreaterThan(0);
  });

  test("GET /runs/demo renders the workbench under strict CSP without script or eval violations", async ({
    page,
  }) => {
    const scriptOrEvalViolations: string[] = [];
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
        (/violates the following Content Security Policy/i.test(text) &&
          /script-src/i.test(text)) ||
        /Refused to evaluate|unsafe-eval|EvalError/i.test(text)
      ) {
        scriptOrEvalViolations.push(text);
      }
    });

    page.on("pageerror", (error) => {
      if (/Refused to evaluate|unsafe-eval|EvalError/i.test(error.message)) {
        scriptOrEvalViolations.push(error.message);
      }
    });

    const response = await page.goto("/runs/demo");
    const csp = response?.headers()["content-security-policy"];

    expect(response?.status()).toBe(200);
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    await expect(page.getByText("Public demo")).toBeVisible();
    await expect(page.locator("h1").filter({ hasText: /^run_/ })).toBeVisible();
    expect(scriptOrEvalViolations).toEqual([]);
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
