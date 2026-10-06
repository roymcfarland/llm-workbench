// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

async function loadCsp(
  env: Record<string, string> = {},
): Promise<typeof import("./csp")> {
  vi.resetModules();
  // Deterministic by default: no derived Clerk Frontend API host unless a test
  // explicitly provides a publishable key.
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  return import("./csp");
}

function scriptSrc(policy: string): string {
  const directive = policy
    .split("; ")
    .find((part) => part.startsWith("script-src "));
  if (!directive) throw new Error(`Missing script-src directive: ${policy}`);
  return directive;
}

function expectHardenedDirectives(policy: string): void {
  const directives = policy.split("; ");
  expect(directives).toContain("frame-ancestors 'none'");
  expect(directives).toContain("object-src 'none'");
}

function directive(policy: string, name: string): string {
  const value = policy.split("; ").find((part) => part.startsWith(`${name} `));
  if (!value) throw new Error(`Missing ${name} directive: ${policy}`);
  return value;
}

describe("contentSecurityPolicy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    { mode: "production", nonce: "nonce-value" },
    { mode: "production", nonce: undefined },
    { mode: "development", nonce: undefined },
    { mode: "development", nonce: "dev-nonce" },
  ])(
    "keeps fonts and styles local in $mode with nonce $nonce",
    async ({ mode, nonce }) => {
      const { contentSecurityPolicy } = await loadCsp({ NODE_ENV: mode });
      const policy = contentSecurityPolicy(nonce);
      const styleSources = directive(policy, "style-src");
      const fontSources = directive(policy, "font-src");

      expect(styleSources).not.toMatch(/googleapis|gstatic/i);
      expect(fontSources).not.toMatch(/googleapis|gstatic/i);
      expect(styleSources.split(" ")).toEqual(
        expect.arrayContaining(["'self'", "'unsafe-inline'"]),
      );
      expect(fontSources.split(" ")).toEqual(
        expect.arrayContaining(["'self'", "data:"]),
      );
    },
  );

  it("uses nonce plus strict-dynamic without unsafe-eval in production", async () => {
    const { contentSecurityPolicy } = await loadCsp({
      NODE_ENV: "production",
    });

    const directive = scriptSrc(contentSecurityPolicy("nonce-value"));

    expect(directive).toContain("'nonce-nonce-value'");
    expect(directive).toContain("'strict-dynamic'");
    expect(directive).not.toContain("'unsafe-eval'");
  });

  it("keeps unsafe-inline as a CSP2 fallback in production nonce mode", async () => {
    const { contentSecurityPolicy } = await loadCsp({
      NODE_ENV: "production",
    });

    // Nonce-aware browsers ignore this when strict-dynamic is present; older
    // CSP2 browsers use it as the intended fallback.
    expect(scriptSrc(contentSecurityPolicy("nonce-value"))).toContain(
      "'unsafe-inline'",
    );
  });

  it("keeps the permissive development script policy", async () => {
    const { contentSecurityPolicy } = await loadCsp({
      NODE_ENV: "development",
    });

    for (const policy of [
      contentSecurityPolicy(),
      contentSecurityPolicy("dev-nonce"),
    ]) {
      const directive = scriptSrc(policy);
      expect(directive).toContain("'unsafe-eval'");
      expect(directive).not.toContain("'strict-dynamic'");
    }
  });

  it("preserves the legacy production script policy without a nonce", async () => {
    const { contentSecurityPolicy } = await loadCsp({
      NODE_ENV: "production",
    });

    expect(scriptSrc(contentSecurityPolicy())).toBe(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.vercel-scripts.com",
    );
  });

  it("allows the Clerk custom Frontend API domain derived from the publishable key", async () => {
    const pk = `pk_live_${Buffer.from("clerk.llmworkbench.io$").toString("base64")}`;
    const { contentSecurityPolicy } = await loadCsp({
      NODE_ENV: "production",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk,
    });

    const policy = contentSecurityPolicy("nonce-value");
    const directive = (name: string) =>
      policy.split("; ").find((p) => p.startsWith(`${name} `)) ?? "";

    // The *.clerk.* wildcards don't cover the prod custom domain, so it must be
    // allowed explicitly — for the environment fetch (connect), clerk-js, frames.
    expect(directive("connect-src")).toContain("https://clerk.llmworkbench.io");
    expect(directive("connect-src")).toContain("wss://clerk.llmworkbench.io");
    expect(directive("script-src")).toContain("https://clerk.llmworkbench.io");
    expect(directive("frame-src")).toContain("https://clerk.llmworkbench.io");
  });

  it("adds no derived Clerk host when the publishable key is absent", async () => {
    const { contentSecurityPolicy } = await loadCsp({ NODE_ENV: "production" });
    expect(contentSecurityPolicy("nonce-value")).not.toContain(
      "llmworkbench.io",
    );
  });

  it("keeps non-script hardening directives unchanged in both modes", async () => {
    const { contentSecurityPolicy: productionPolicy } = await loadCsp({
      NODE_ENV: "production",
    });
    expectHardenedDirectives(productionPolicy("nonce-value"));
    expectHardenedDirectives(productionPolicy());

    const { contentSecurityPolicy: developmentPolicy } = await loadCsp({
      NODE_ENV: "development",
    });
    expectHardenedDirectives(developmentPolicy());
  });

  it.each(["production", "development"])(
    "allows the Vercel toolbar frame only in preview with NODE_ENV=%s",
    async (mode) => {
      const { contentSecurityPolicy } = await loadCsp({
        NODE_ENV: mode,
        VERCEL_ENV: "preview",
      });

      expect(
        directive(contentSecurityPolicy("nonce-value"), "frame-src").split(" "),
      ).toContain("https://vercel.live");
    },
  );

  it("allows the Vercel toolbar realtime connection in preview", async () => {
    const { contentSecurityPolicy } = await loadCsp({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
    });

    expect(
      directive(contentSecurityPolicy("nonce-value"), "connect-src").split(" "),
    ).toContain("wss://ws-us3.pusher.com");
  });

  it.each(["https://vercel.live", "https://assets.vercel.com"])(
    "allows the Vercel toolbar font source %s in preview",
    async (source) => {
      const { contentSecurityPolicy } = await loadCsp({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
      });

      expect(
        directive(contentSecurityPolicy("nonce-value"), "font-src").split(" "),
      ).toContain(source);
    },
  );

  it.each([
    { mode: "production", vercelEnv: "production" },
    { mode: "production", vercelEnv: undefined },
    { mode: "development", vercelEnv: "development" },
  ])(
    "excludes preview-only toolbar sources with NODE_ENV=$mode and VERCEL_ENV=$vercelEnv",
    async ({ mode, vercelEnv }) => {
      vi.stubEnv("VERCEL_ENV", vercelEnv);
      const { contentSecurityPolicy } = await loadCsp({ NODE_ENV: mode });

      for (const nonce of [undefined, "nonce-value"]) {
        const policy = contentSecurityPolicy(nonce);
        expect(directive(policy, "frame-src").split(" ")).not.toContain(
          "https://vercel.live",
        );
        expect(directive(policy, "font-src").split(" ")).not.toContain(
          "https://vercel.live",
        );
        expect(directive(policy, "font-src").split(" ")).not.toContain(
          "https://assets.vercel.com",
        );
        expect(directive(policy, "connect-src").split(" ")).not.toContain(
          "wss://ws-us3.pusher.com",
        );
        expect(directive(policy, "connect-src").split(" ")).toContain(
          "https://vercel.live",
        );
      }
    },
  );

  it.each([undefined, "nonce-value"])(
    "keeps production and unset policies byte-identical to main with nonce %s",
    async (nonce) => {
      vi.stubEnv("VERCEL_ENV", undefined);
      const { contentSecurityPolicy: unsetPolicy } = await loadCsp({
        NODE_ENV: "production",
        CSP_EXTRA_CONNECT_SRC: "",
      });
      const withoutVercelEnv = unsetPolicy(nonce);
      const { contentSecurityPolicy: productionPolicy } = await loadCsp({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        CSP_EXTRA_CONNECT_SRC: "",
      });

      // Pin the complete pre-change policy: equality between the two envs alone
      // would miss an accidental widening applied to both production and unset.
      const expectedMainPolicy = [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        nonce
          ? "script-src 'self' 'nonce-nonce-value' 'strict-dynamic' 'unsafe-inline' https://*.clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.vercel-scripts.com"
          : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.vercel-scripts.com",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self' data:",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev wss://*.clerk.com https://clerk-telemetry.com https://*.supabase.co wss://*.supabase.co wss://*.supabase.io https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://vercel.live https://*.vercel-insights.com https://vitals.vercel-insights.com https://*.vercel.com https://*.vercel.app https://*.vercel.sh",
        "frame-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com",
        "worker-src 'self' blob:",
        "media-src 'self' blob:",
        "child-src 'self' blob:",
        "upgrade-insecure-requests",
      ].join("; ");

      expect(productionPolicy(nonce)).toBe(withoutVercelEnv);
      expect(withoutVercelEnv).toBe(expectedMainPolicy);
    },
  );

  it.each(["production", "development"])(
    "preserves local font sources and script-src in preview with NODE_ENV=%s",
    async (mode) => {
      vi.stubEnv("VERCEL_ENV", undefined);
      const { contentSecurityPolicy: unsetPolicy } = await loadCsp({
        NODE_ENV: mode,
      });
      const originalScripts = [
        scriptSrc(unsetPolicy()),
        scriptSrc(unsetPolicy("nonce-value")),
      ];
      const { contentSecurityPolicy: previewPolicy } = await loadCsp({
        NODE_ENV: mode,
        VERCEL_ENV: "preview",
      });

      for (const [index, nonce] of [undefined, "nonce-value"].entries()) {
        const policy = previewPolicy(nonce);
        const fontSources = directive(policy, "font-src").split(" ");
        expect(fontSources).toContain("'self'");
        expect(fontSources).toContain("data:");
        expect(scriptSrc(policy)).toBe(originalScripts[index]);
      }
    },
  );
});
