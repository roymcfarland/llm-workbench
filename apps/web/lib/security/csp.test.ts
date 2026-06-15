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

describe("contentSecurityPolicy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

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
});
