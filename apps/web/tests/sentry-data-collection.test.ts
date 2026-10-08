import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { init } = vi.hoisted(() => ({ init: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({
  init,
  captureRouterTransitionStart: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  init.mockClear();
  vi.stubEnv("SENTRY_DSN", "https://public@example.com/1");
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.com/1");
});

afterEach(() => vi.unstubAllEnvs());

it.each([
  ["server", () => import("../sentry.server.config")],
  ["edge", () => import("../sentry.edge.config")],
  ["client", () => import("../instrumentation-client")],
] as const)("pins the v10 collection baseline when %s reporting is enabled", async (_, load) => {
  await load();

  expect(init).toHaveBeenCalledTimes(1);
  const options = init.mock.calls[0][0];
  expect(options.enabled).toBe(true);
  expect(options).not.toHaveProperty("sendDefaultPii");
  // All runtimes must opt out explicitly: omitted v11 categories collect data.
  expect(options.dataCollection).toEqual({
    userInfo: false,
    cookies: false,
    httpHeaders: {
      request: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
      response: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
    },
    httpBodies: [],
    urlQueryParams: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    graphQL: { document: false, variables: false },
  });
});
